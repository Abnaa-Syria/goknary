import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { generateOTP, hashOTP, verifyOTP } from '../lib/otp';
import { sendWhatsAppOTP, sendWhatsAppPasswordReset } from '../lib/whatsapp';

// ─── Validation Schemas ───────────────────────────────────────────────────────

/**
 * E.164 phone regex: +[country code][number], total 8–15 digits
 * Accepts +20xxxxxxxxxx, +1xxxxxxxxxx, etc.
 */
const phoneRegex = /^\+[1-9]\d{7,14}$/;

const registerSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
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
  newPassword:     z.string().min(8).max(128),
});

// Password reset via WhatsApp OTP
const forgotPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Phone must be in international format, e.g. +201012345678'),
});

const verifyResetOtpSchema = z.object({
  phone:       z.string().regex(phoneRegex),
  otp:         z.string().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OTP_EXPIRES_MINUTES     = parseInt(process.env.OTP_EXPIRES_MINUTES     || '10', 10);
const OTP_MAX_ATTEMPTS        = parseInt(process.env.OTP_MAX_ATTEMPTS         || '5',  10);

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
        const otp          = generateOTP();
        const hashedOTP    = await hashOTP(otp);
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        await prisma.user.update({
          where: { id: existingByEmail.id },
          data:  { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
        });

        try {
          if (existingByEmail.phone) {
            await sendWhatsAppOTP(existingByEmail.phone, otp, OTP_EXPIRES_MINUTES);
          }
        } catch (wa) {
          console.error('[WhatsApp] Failed to resend OTP:', wa);
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
        const otp          = generateOTP();
        const hashedOTP    = await hashOTP(otp);
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        await prisma.user.update({
          where: { id: existingByPhone.id },
          data:  { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
        });

        try {
          await sendWhatsAppOTP(phone, otp, OTP_EXPIRES_MINUTES);
        } catch (wa) {
          console.error('[WhatsApp] Failed to resend OTP:', wa);
        }

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
    const otp            = generateOTP();
    const hashedOTP      = await hashOTP(otp);
    const otpExpiresAt   = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        phone,
        emailVerified:  false,
        phoneVerified:  false,
        otpCode:        hashedOTP,
        otpExpiresAt,
        otpAttempts:    0,
      },
    });

    // Send OTP via WhatsApp (non-blocking — registration succeeds even if WA is down)
    try {
      await sendWhatsAppOTP(phone, otp, OTP_EXPIRES_MINUTES);
    } catch (wa) {
      console.error('[WhatsApp] Failed to send OTP on register:', wa);
    }

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

    // Attempt limit
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({
        error: 'Too many failed attempts. Please use the resend code option.',
      });
      return;
    }

    // Expiry check
    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      res.status(400).json({
        error:   'Verification code has expired. Please request a new one.',
        expired: true,
      });
      return;
    }

    const isValid = await verifyOTP(otp, user.otpCode);

    if (!isValid) {
      await prisma.user.update({
        where: { id: userId },
        data:  { otpAttempts: { increment: 1 } },
      });
      const remaining = OTP_MAX_ATTEMPTS - (user.otpAttempts + 1);
      res.status(400).json({
        error:            `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'No attempts remaining.'}`,
        attemptsRemaining: remaining,
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

    const otp          = generateOTP();
    const hashedOTP    = await hashOTP(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data:  { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
    });

    try {
      await sendWhatsAppOTP(user.phone, otp, OTP_EXPIRES_MINUTES);
    } catch (wa) {
      console.error('[WhatsApp] Failed to resend OTP:', wa);
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

    const user = await prisma.user.findUnique({ where: { email } });

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
      const otp          = generateOTP();
      const hashedOTP    = await hashOTP(otp);
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data:  { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
      });

      if (user.phone) {
        sendWhatsAppOTP(user.phone, otp, OTP_EXPIRES_MINUTES).catch((err) =>
          console.error('[WhatsApp] Failed to send OTP on login:', err)
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
      ...safeUser
    } = user as any;

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

    if (!token) {
      res.status(400).json({ error: 'Refresh token is required.' });
      return;
    }

    const crypto    = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await prisma.refreshTokenBlacklist.findFirst({ where: { tokenHash } });

    if (blacklisted) {
      res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
      return;
    }

    let payload: { id: string; email: string; role: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where:  { id: payload.id },
      select: { id: true, email: true, role: true, phoneVerified: true, emailVerified: true },
    });

    if (!user || (!user.phoneVerified && !user.emailVerified)) {
      res.status(401).json({ error: 'User not found or not verified.' });
      return;
    }

    const tokenPayload    = { id: user.id, email: user.email, role: user.role };
    const newAccessToken  = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Rotate: blacklist the old token
    await prisma.refreshTokenBlacklist.create({
      data: {
        token,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (token && typeof token === 'string') {
      try {
        verifyRefreshToken(token);
        const cryptoMod = await import('crypto');
        const hash      = cryptoMod.createHash('sha256').update(token).digest('hex');
        await prisma.refreshTokenBlacklist.create({
          data: {
            token,
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      } catch {
        // Token invalid or already expired — nothing to blacklist
      }
    }

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
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
      data:  { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
};

// ─── Forgot Password — Request OTP via WhatsApp ───────────────────────────────

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  // Generic response to prevent phone enumeration
  const GENERIC_MSG = 'If a verified account exists for this number, you will receive a WhatsApp message with a reset code.';

  try {
    const { phone } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || !user.phoneVerified) {
      res.status(200).json({ message: GENERIC_MSG });
      return;
    }

    const otp            = generateOTP();
    const hashedOTP      = await hashOTP(otp);
    const otpExpiresAt   = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        passwordResetOtp:        hashedOTP,
        passwordResetOtpExpires: otpExpiresAt,
      },
    });

    sendWhatsAppPasswordReset(phone, otp, OTP_EXPIRES_MINUTES).catch((err) =>
      console.error('[WhatsApp] Failed to send password reset OTP:', err)
    );

    res.status(200).json({ message: GENERIC_MSG });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};

// ─── Reset Password — Verify WhatsApp OTP + set new password ─────────────────

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, newPassword } = verifyResetOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      res.status(400).json({ error: 'No account found for this WhatsApp number.' });
      return;
    }

    if (!user.passwordResetOtp || !user.passwordResetOtpExpires) {
      res.status(400).json({ error: 'No reset code found. Please request a new one.' });
      return;
    }

    if (user.passwordResetOtpExpires < new Date()) {
      res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
      return;
    }

    const isValid = await verifyOTP(otp, user.passwordResetOtp);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid reset code.' });
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
        passwordResetOtp:        null,
        passwordResetOtpExpires: null,
        passwordResetToken:      null,
        passwordResetExpires:    null,
      },
    });

    res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};