import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  generateAccessToken,
  generateRefreshToken,
  isIssuedBeforePasswordChange,
  verifyRefreshToken,
} from '../lib/jwt';
import { describeEmailError, isEmailConfigured, sendPasswordResetEmail } from '../lib/email';
import { mergeGuestCartIntoUserCart } from './cart';
import { sendOTP, sendResetOTP } from '../services/whatsapp.service';

// ─── Validation Schemas ───────────────────────────────────────────────────────

/**
 * E.164 phone regex: +[country code][number], total 8–15 digits
 * Accepts +20xxxxxxxxxx, +1xxxxxxxxxx, etc.
 */
const phoneRegex = /^\+[1-9]\d{7,14}$/;

/** Single password rule for register, change-password and both reset flows. */
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);

const registerSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: passwordSchema,
  phone:    z.string().regex(phoneRegex, 'Phone must be in international format, e.g. +201012345678'),
  role:     z.enum(['CUSTOMER']).default('CUSTOMER'),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const verifyPhoneSchema = z.object({
  userId: z.string().min(1),
  otp:    z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const resendOTPSchema = z.object({
  userId: z.string().min(1),
});

const updateProfileSchema = z.object({
  name:   z.string().min(2).max(100).optional(),
  email:  z.string().email().optional(),
  phone:  z.string().regex(phoneRegex, 'Invalid phone format').optional(),
  avatar: z.string().url().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     passwordSchema,
});

// Password reset: email link (new) or WhatsApp OTP (legacy). The body decides the flow.
const forgotPasswordEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

const forgotPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Phone must be in international format, e.g. +201012345678'),
});

const resetPasswordTokenSchema = z.object({
  token:       z.string().trim().regex(/^[a-f0-9]{64}$/i, 'This reset link is invalid or has expired.'),
  newPassword: passwordSchema,
});

const verifyResetOtpSchema = z.object({
  phone:       z.string().regex(phoneRegex),
  otp:         z.string().length(6).regex(/^\d{6}$/),
  newPassword: passwordSchema,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OTP_EXPIRES_MINUTES     = parseInt(process.env.OTP_EXPIRES_MINUTES     || '10', 10);
const OTP_MAX_ATTEMPTS        = parseInt(process.env.OTP_MAX_ATTEMPTS         || '5',  10);

const generateLocalOTP = (): string => randomInt(100000, 1000000).toString();

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const PASSWORD_RESET_TOKEN_TTL_MS = PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000;
// Repeat reset requests for the same account inside this window are answered but not re-sent.
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;

const REFRESH_BLACKLIST_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// Blacklist rows only need to live as long as the token itself could still verify.
const refreshTokenExpiry = (token: string): Date => {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + REFRESH_BLACKLIST_FALLBACK_MS);
};

/**
 * Claims a refresh token for single use. Returns false when the token was
 * already blacklisted (e.g. a concurrent refresh with the same token won).
 */
const claimRefreshToken = async (token: string, tokenHash: string): Promise<boolean> => {
  try {
    await prisma.refreshTokenBlacklist.create({
      data: { token, tokenHash, expiresAt: refreshTokenExpiry(token) },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
};

const revokeRefreshToken = async (token: string, tokenHash: string): Promise<void> => {
  await prisma.refreshTokenBlacklist.upsert({
    where:  { tokenHash },
    update: {},
    create: { token, tokenHash, expiresAt: refreshTokenExpiry(token) },
  });
};

// Prisma error messages can echo query arguments, which here would include the raw refresh token.
const describeErrorWithoutArgs = (error: unknown): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `Prisma ${error.code}`;
  if (error instanceof Error) {
    return error.name.startsWith('PrismaClient') ? error.name : `${error.name}: ${error.message}`;
  }
  return 'Unknown error';
};

const safeParseError = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return error.errors.map((e) => e.message).join(', ');
  }
  return 'An unexpected error occurred';
};

// ─── Register ────────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, role } = registerSchema.parse(req.body);

    // ── Check for existing email ─────────────────────────────────────────────
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      if (!existingByEmail.phoneVerified) {
        // Re-registration on unverified account → fresh OTP to same phone
        const otpCode = generateLocalOTP();
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        await prisma.user.update({
          where: { id: existingByEmail.id },
          data:  { otpCode, otpExpiresAt, otpAttempts: 0 },
        });

        if (existingByEmail.phone) {
          sendOTP(existingByEmail.phone, otpCode).catch((wa) => {
            console.error('[Twilio WhatsApp] Failed to resend OTP:', wa);
          });
        }

        res.status(200).json({
          message:              'A new verification code has been sent to your WhatsApp.',
          userId:               existingByEmail.id,
          requiresVerification: true,
        });
        return;
      }
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // ── Check for existing phone ─────────────────────────────────────────────
    const existingByPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingByPhone) {
      if (!existingByPhone.phoneVerified) {
        // Same phone, different email, unverified → resend
        const otpCode = generateLocalOTP();
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        await prisma.user.update({
          where: { id: existingByPhone.id },
          data:  { otpCode, otpExpiresAt, otpAttempts: 0 },
        });

        sendOTP(phone, otpCode).catch((wa) => {
          console.error('[Twilio WhatsApp] Failed to resend OTP:', wa);
        });

        res.status(200).json({
          message:              'A new verification code has been sent to your WhatsApp.',
          userId:               existingByPhone.id,
          requiresVerification: true,
        });
        return;
      }
      res.status(409).json({ error: 'This WhatsApp number is already registered.' });
      return;
    }

    // ── Create new user ──────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);
    const otpCode = generateLocalOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        phone,
        emailVerified:  false,
        phoneVerified:  false,
        otpCode,
        otpExpiresAt,
        otpAttempts:    0,
      },
    });

    // Send OTP via WhatsApp (non-blocking — registration succeeds even if WA is down)
    sendOTP(phone, otpCode).catch((wa) => {
      console.error('[Twilio WhatsApp] Failed to send OTP on register:', wa);
    });

    res.status(201).json({
      message:              `A verification code has been sent to your WhatsApp number ${phone}.`,
      userId:               user.id,
      requiresVerification: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid registration data', details: error.errors });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ─── Verify Phone (OTP) ───────────────────────────────────────────────────────

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, otp } = verifyPhoneSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.phoneVerified) {
      res.status(400).json({ error: 'This account is already verified.' });
      return;
    }

    if (!user.phone) {
      res.status(400).json({ error: 'No WhatsApp number on file. Please re-register.' });
      return;
    }

    // Verify OTP locally
    if (!user.otpCode || !user.otpExpiresAt) {
      res.status(400).json({ error: 'No verification code was sent or it has expired.' });
      return;
    }

    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      return;
    }

    if (new Date() > user.otpExpiresAt) {
      res.status(400).json({ error: 'Verification code has expired.' });
      return;
    }

    const isValid = user.otpCode === otp;

    if (!isValid) {
      await prisma.user.update({
        where: { id: userId },
        data: { otpAttempts: { increment: 1 } },
      });
      res.status(400).json({
        error: 'Invalid verification code.',
      });
      return;
    }

    // ✅ Valid OTP — verify and issue tokens
    const verifiedUser = await prisma.user.update({
      where: { id: userId },
      data:  {
        phoneVerified:  true,
        emailVerified:  true, // keep in sync for middleware checks
        otpCode:        null,
        otpExpiresAt:   null,
        otpAttempts:    0,
      },
      select: {
        id:           true,
        name:         true,
        email:        true,
        role:         true,
        phone:        true,
        avatar:       true,
        phoneVerified: true,
        emailVerified: true,
        createdAt:    true,
      },
    });

    const tokenPayload = { id: verifiedUser.id, email: verifiedUser.email, role: verifiedUser.role };
    const accessToken  = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // M-03 Fix: Merge guest cart into user account upon verification
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      await mergeGuestCartIntoUserCart(sessionId, verifiedUser.id);
    }

    res.status(200).json({
      message: 'Phone verified successfully! Welcome to GoKanary.',
      user:    verifiedUser,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────

export const resendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = resendOTPSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.phoneVerified) {
      res.status(400).json({ error: 'This account is already verified.' });
      return;
    }

    if (!user.phone) {
      res.status(400).json({ error: 'No WhatsApp number on file. Please re-register.' });
      return;
    }

    const otpCode = generateLocalOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data:  { otpCode, otpExpiresAt, otpAttempts: 0 },
    });

    try {
      const result = await sendOTP(user.phone, otpCode);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send OTP via Twilio.');
      }
    } catch (wa: any) {
      console.error('[Twilio WhatsApp] Failed to resend OTP:', wa);
      res.status(500).json({ error: 'Failed to send WhatsApp message. Please try again.' });
      return;
    }

    res.status(200).json({
      message: `A new verification code has been sent to ${user.phone}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend code. Please try again.' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customRole: {
          select: { id: true, name: true, permissions: true },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check phone verification
    if (!user.phoneVerified) {
      // Auto-resend a fresh OTP
      const otpCode = generateLocalOTP();
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data:  { otpCode, otpExpiresAt, otpAttempts: 0 },
      });

      if (user.phone) {
        sendOTP(user.phone, otpCode).catch((err) =>
          console.error('[Twilio WhatsApp] Failed to send OTP on login:', err)
        );
      }

      res.status(403).json({
        error:                'Please verify your WhatsApp number before logging in.',
        requiresVerification: true,
        userId:               user.id,
      });
      return;
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken  = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const {
      passwordHash: _pass,
      otpCode,
      otpExpiresAt,
      otpAttempts,
      passwordResetToken,
      passwordResetExpires,
      passwordResetOtp,
      passwordResetOtpExpires,
      passwordResetAttempts,
      passwordChangedAt,
      customRoleId: _crid,
      ...safeUser
    } = user as any;

    // M-03 Fix: Merge guest cart into user account upon login
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      await mergeGuestCartIntoUserCart(sessionId, user.id);
    }

    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid login data', details: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Refresh token is required.' });
      return;
    }

    const tokenHash   = hashToken(token);
    const blacklisted = await prisma.refreshTokenBlacklist.findFirst({ where: { tokenHash } });

    if (blacklisted) {
      res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
      return;
    }

    let payload: { id: string; email: string; role: string; iat?: number };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where:  { id: payload.id },
      select: { id: true, email: true, role: true, phoneVerified: true, emailVerified: true, passwordChangedAt: true },
    });

    if (!user || (!user.phoneVerified && !user.emailVerified)) {
      res.status(401).json({ error: 'User not found or not verified.' });
      return;
    }

    if (isIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt)) {
      res.status(401).json({ error: 'Your password was changed. Please log in again.' });
      return;
    }

    // Rotate: the old token is single-use, so only one concurrent refresh may win.
    const claimed = await claimRefreshToken(token, tokenHash);
    if (!claimed) {
      res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
      return;
    }

    const tokenPayload    = { id: user.id, email: user.email, role: user.role };
    const newAccessToken  = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Token refresh error:', describeErrorWithoutArgs(error));
    res.status(500).json({ error: 'Token refresh failed.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (token && typeof token === 'string') {
      let isValid = false;
      try {
        verifyRefreshToken(token);
        isValid = true;
      } catch {
        // Token invalid or already expired — nothing to blacklist
      }

      if (isValid) {
        await revokeRefreshToken(token, hashToken(token));
      }
    }

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', describeErrorWithoutArgs(error));
    res.status(500).json({ error: 'Logout failed.' });
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id:           true,
        name:         true,
        email:        true,
        role:         true,
        phone:        true,
        avatar:       true,
        phoneVerified: true,
        emailVerified: true,
        createdAt:    true,
        vendor: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            status: true,
          },
        },
        customRole: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const updateData = updateProfileSchema.parse(req.body);
    const data: any  = { ...updateData };

    if (updateData.email) {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (currentUser && currentUser.email !== updateData.email) {
        data.emailVerified = false;
      }
    }

    const updatedUser = await prisma.user.update({
      where:  { id: req.user.id },
      data,
      select: {
        id:           true,
        name:         true,
        email:        true,
        role:         true,
        phone:        true,
        avatar:       true,
        phoneVerified: true,
        emailVerified: true,
        createdAt:    true,
      },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid profile data', details: error.errors });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const samePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (samePassword) {
      res.status(400).json({ error: 'New password cannot be the same as the current password.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data:  {
        passwordHash,
        passwordResetToken:      null,
        passwordResetExpires:    null,
        passwordResetOtp:        null,
        passwordResetOtpExpires: null,
        passwordResetAttempts:   0,
        passwordChangedAt:       new Date(),
      },
    });

    // Every older session is now revoked; this device continues with a fresh pair.
    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    res.json({
      message:      'Password updated successfully.',
      accessToken:  generateAccessToken(tokenPayload),
      refreshToken: generateRefreshToken(tokenPayload),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
};

// ─── Forgot Password — email link (new) or WhatsApp OTP (legacy) ──────────────

const EMAIL_RESET_MSG = 'If an account exists, password reset instructions have been sent.';
const PHONE_RESET_MSG = 'If a verified account exists for this number, you will receive a WhatsApp message with a reset code.';
const RESET_SUCCESS_MSG = 'Your password has been reset. You can now sign in with your new password.';
const INVALID_RESET_LINK_MSG = 'This reset link is invalid or has expired. Please request a new one.';

const issuedWithinCooldown = (expiresAt: Date | null, ttlMs: number): boolean =>
  !!expiresAt && expiresAt.getTime() - ttlMs + PASSWORD_RESET_RESEND_COOLDOWN_MS > Date.now();

/** Fixed env base URL (never the request Host header). Non-production falls back to the local frontend. */
const getFrontendBaseUrl = (): string | null => {
  const raw = process.env.FRONTEND_URL?.trim()
    || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return raw.replace(/\/+$/, '');
  } catch {
    return null;
  }
};

/** Sends after the response so timing doesn't reveal whether the account exists. */
const deliverPasswordResetEmail = async (userId: string, to: string, tokenHash: string, resetUrl: string) => {
  try {
    await sendPasswordResetEmail({ to, resetUrl, expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES });
    console.info(`[auth] Password reset email sent (user ${userId})`);
  } catch (error) {
    console.error(`[auth] Password reset email failed (user ${userId}): ${describeEmailError(error)}`);
    // An undelivered token is useless; drop it unless a newer request already replaced it.
    await prisma.user
      .updateMany({
        where: { id: userId, passwordResetToken: tokenHash },
        data:  { passwordResetToken: null, passwordResetExpires: null },
      })
      .catch((cleanupError) =>
        console.error('[auth] Failed to clear undelivered reset token:', describeErrorWithoutArgs(cleanupError))
      );
  }
};

const requestEmailReset = async (body: unknown, res: Response): Promise<void> => {
  const { email } = forgotPasswordEmailSchema.parse(body);

  const frontendUrl = getFrontendBaseUrl();
  if (!isEmailConfigured() || !frontendUrl) {
    console.error('[auth] Email password reset requested but SMTP_HOST/SMTP_FROM/FRONTEND_URL is not configured');
    res.status(503).json({
      error: 'Password reset by email is temporarily unavailable. Please try again later or reset via WhatsApp.',
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where:  { email },
    select: { id: true, email: true, phoneVerified: true, emailVerified: true, passwordResetExpires: true },
  });

  const eligible = !!user?.email && (user.phoneVerified || user.emailVerified);
  if (!user || !eligible || issuedWithinCooldown(user.passwordResetExpires, PASSWORD_RESET_TOKEN_TTL_MS)) {
    res.status(200).json({ message: EMAIL_RESET_MSG });
    return;
  }

  const rawToken  = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      passwordResetToken:   tokenHash,
      passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  });

  res.status(200).json({ message: EMAIL_RESET_MSG });
  void deliverPasswordResetEmail(user.id, user.email, tokenHash, `${frontendUrl}/reset-password?token=${rawToken}`);
};

const requestPhoneReset = async (body: unknown, res: Response): Promise<void> => {
  const { phone } = forgotPasswordSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { phone } });

  if (
    !user ||
    !user.phoneVerified ||
    issuedWithinCooldown(user.passwordResetOtpExpires, OTP_EXPIRES_MINUTES * 60 * 1000)
  ) {
    res.status(200).json({ message: PHONE_RESET_MSG });
    return;
  }

  const otpCode = generateLocalOTP();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      passwordResetOtp:        otpCode,
      passwordResetOtpExpires: otpExpiresAt,
      passwordResetAttempts:   0,
    },
  });

  sendResetOTP(phone, otpCode).catch((err) =>
    console.error('[Twilio WhatsApp] Failed to send password reset OTP:', err)
  );

  res.status(200).json({ message: PHONE_RESET_MSG });
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.body && typeof req.body === 'object' && 'email' in req.body) {
      await requestEmailReset(req.body, res);
    } else {
      await requestPhoneReset(req.body, res);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Forgot password error:', describeErrorWithoutArgs(error));
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};

// ─── Reset Password — email token (new) or WhatsApp OTP (legacy) ──────────────

const passwordChangeData = (passwordHash: string) => ({
  passwordHash,
  passwordResetToken:      null,
  passwordResetExpires:    null,
  passwordResetOtp:        null,
  passwordResetOtpExpires: null,
  passwordResetAttempts:   0,
  passwordChangedAt:       new Date(),
});

const otpMatches = (stored: string, given: string): boolean => {
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

const resetWithToken = async (body: unknown, res: Response): Promise<void> => {
  const { token, newPassword } = resetPasswordTokenSchema.parse(body);
  const tokenHash = hashToken(token.toLowerCase());

  const user = await prisma.user.findFirst({
    where:  { passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() } },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    res.status(400).json({ error: INVALID_RESET_LINK_MSG });
    return;
  }

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    res.status(400).json({ error: 'New password cannot be the same as the current password.' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Conditional on the token still being stored, so a concurrent second use cannot also succeed.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() } },
    data:  passwordChangeData(passwordHash),
  });
  if (count === 0) {
    res.status(400).json({ error: INVALID_RESET_LINK_MSG });
    return;
  }

  console.info(`[auth] Password reset via email link (user ${user.id})`);
  res.json({ message: RESET_SUCCESS_MSG });
};

const resetWithPhoneOtp = async (body: unknown, res: Response): Promise<void> => {
  const { phone, otp, newPassword } = verifyResetOtpSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user || !user.passwordResetOtp || !user.passwordResetOtpExpires) {
    res.status(400).json({ error: 'No reset code was sent or it has expired.' });
    return;
  }

  if (new Date() > user.passwordResetOtpExpires) {
    res.status(400).json({ error: 'Reset code has expired.' });
    return;
  }

  if (!otpMatches(user.passwordResetOtp, otp)) {
    const { passwordResetAttempts } = await prisma.user.update({
      where:  { id: user.id },
      data:   { passwordResetAttempts: { increment: 1 } },
      select: { passwordResetAttempts: true },
    });
    if (passwordResetAttempts >= OTP_MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data:  { passwordResetOtp: null, passwordResetOtpExpires: null },
      });
      res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      return;
    }
    res.status(400).json({ error: 'Invalid reset code.' });
    return;
  }

  const samePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (samePassword) {
    res.status(400).json({ error: 'New password cannot be the same as the current password.' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, passwordResetOtp: user.passwordResetOtp },
    data:  passwordChangeData(passwordHash),
  });
  if (count === 0) {
    res.status(400).json({ error: 'No reset code was sent or it has expired.' });
    return;
  }

  console.info(`[auth] Password reset via WhatsApp code (user ${user.id})`);
  res.json({ message: RESET_SUCCESS_MSG });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.body && typeof req.body === 'object' && 'token' in req.body) {
      await resetWithToken(req.body, res);
    } else {
      await resetWithPhoneOtp(req.body, res);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Reset password error:', describeErrorWithoutArgs(error));
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};
