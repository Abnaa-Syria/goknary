import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { generateOTP, hashOTP, verifyOTP } from '../lib/otp';
import { sendOTPEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../lib/email';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  // Bug L-06 Fix: removed VENDOR — users cannot self-register as vendors
  role: z.enum(['CUSTOMER']).default('CUSTOMER'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  userId: z.string().min(1),
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const resendOTPSchema = z.object({
  userId: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const PASSWORD_RESET_EXPIRES_MINUTES = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '60', 10);

const safeParseError = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return error.errors.map((e) => e.message).join(', ');
  }
  return 'An unexpected error occurred';
};

// ─── Register ────────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone } = registerSchema.parse(req.body);

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (!existingUser.emailVerified) {
        // Re-registration attempt on unverified account → resend OTP
        const otp = generateOTP();
        const hashedOTP = await hashOTP(otp);
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        await prisma.user.update({
          where: { id: existingUser.id },
          data: { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
        });

        try {
          await sendOTPEmail(existingUser.email, otp, existingUser.name ?? existingUser.email, OTP_EXPIRES_MINUTES);
        } catch (emailErr) {
          console.error('Failed to resend OTP email:', emailErr);
        }

        res.status(200).json({
          message: 'A new verification code has been sent to your email.',
          userId: existingUser.id,
          requiresVerification: true,
        });
        return;
      }
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP before creating user
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    // Create user (NOT yet verified — no tokens issued)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        phone,
        emailVerified: false,
        otpCode: hashedOTP,
        otpExpiresAt,
        otpAttempts: 0,
      },
    });

    // Send OTP email (non-blocking — don't crash registration if email fails)
    try {
      await sendOTPEmail(email, otp, name, OTP_EXPIRES_MINUTES);
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr);
      // Still return success — user can use resend endpoint
    }

    res.status(201).json({
      message: `A verification code has been sent to ${email}. Please check your inbox.`,
      userId: user.id,
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

// ─── Verify Email (OTP) ───────────────────────────────────────────────────────

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, otp } = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: 'This email is already verified.' });
      return;
    }

    // Check attempt limit
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({
        error: `Too many failed attempts. Please use the resend code option.`,
      });
      return;
    }

    // Check expiry
    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      res.status(400).json({
        error: 'Verification code has expired. Please request a new one.',
        expired: true,
      });
      return;
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, user.otpCode);

    if (!isValid) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: userId },
        data: { otpAttempts: { increment: 1 } },
      });

      const remaining = OTP_MAX_ATTEMPTS - (user.otpAttempts + 1);
      res.status(400).json({
        error: `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'No attempts remaining.'}`,
        attemptsRemaining: remaining,
      });
      return;
    }

    // ✅ OTP is valid — verify the user and issue tokens
    const verifiedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Generate tokens now that user is verified
    const tokenPayload = { id: verifiedUser.id, email: verifiedUser.email, role: verifiedUser.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(verifiedUser.email, verifiedUser.name ?? verifiedUser.email).catch((err) =>
      console.error('Failed to send welcome email:', err)
    );

    res.status(200).json({
      message: 'Email verified successfully! Welcome to GoKnary.',
      user: verifiedUser,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Email verification error:', error);
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

    if (user.emailVerified) {
      res.status(400).json({ error: 'This email is already verified.' });
      return;
    }

    // Generate a fresh OTP and reset attempts
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
    });

    try {
      await sendOTPEmail(user.email, otp, user.name ?? user.email, OTP_EXPIRES_MINUTES);
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr);
      res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
      return;
    }

    res.status(200).json({
      message: `A new verification code has been sent to ${user.email}.`,
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

    // Check if email is verified
    if (!user.emailVerified) {
      // Auto-resend a fresh OTP on login attempt for unverified accounts
      const otp = generateOTP();
      const hashedOTP = await hashOTP(otp);
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: hashedOTP, otpExpiresAt, otpAttempts: 0 },
      });

      sendOTPEmail(user.email, otp, user.name ?? user.email, OTP_EXPIRES_MINUTES).catch((err) =>
        console.error('Failed to send OTP on login:', err)
      );

      res.status(403).json({
        error: 'Please verify your email before logging in.',
        requiresVerification: true,
        userId: user.id,
      });
      return;
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { passwordHash: _pass, otpCode, otpExpiresAt, otpAttempts, ...safeUser } = user;

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

    // Check if token has been blacklisted (used after logout)
    // The existing schema stores SHA-256 hash of the token for fast lookup
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await prisma.refreshTokenBlacklist.findFirst({
      where: { tokenHash },
    });

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

    // Verify user still exists and is verified
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      res.status(401).json({ error: 'User not found or not verified.' });
      return;
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Blacklist the old refresh token (token rotation)
    const cryptoModule = await import('crypto');
    const newTokenHash = cryptoModule.createHash('sha256').update(token).digest('hex');
    await prisma.refreshTokenBlacklist.create({
      data: {
        token,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
    // Bug C-03 Fix: blacklist the refresh token so it can't be reused
    const { refreshToken: token } = req.body;

    if (token && typeof token === 'string') {
      try {
        verifyRefreshToken(token); // only blacklist if it was actually a valid token
        const cryptoMod = await import('crypto');
        const hash = cryptoMod.createHash('sha256').update(token).digest('hex');
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
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        emailVerified: true,
        createdAt: true,
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

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        emailVerified: true,
        createdAt: true,
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

// ─── Change Password (authenticated — all roles) ────────────────────────────

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

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
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

// ─── Forgot Password (public) ─────────────────────────────────────────────────

const GENERIC_RESET_MESSAGE =
  'If an account exists for this email, you will receive password reset instructions shortly.';

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Forgot password request received:', req.body);
    const { email } = forgotPasswordSchema.parse(req.body);
    console.log('Email:', email);
    const user = await prisma.user.findUnique({ where: { email } });
    console.log('User:', user);

    if (!user || !user.emailVerified) {
      res.status(200).json({ message: GENERIC_RESET_MESSAGE });
      return;
    }

    const crypto = await import('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpires },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    sendPasswordResetEmail(user.email, user.name ?? user.email, resetUrl, PASSWORD_RESET_EXPIRES_MINUTES).catch(
      (err) => console.error('Failed to send password reset email:', err)
    );

    res.status(200).json({ message: GENERIC_RESET_MESSAGE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};

// ─── Reset Password with token (public) ───────────────────────────────────────

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    if(!token || !newPassword) {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });


    if (!user) {
      res.status(400).json({
        error: 'This reset link is invalid or has expired. Please request a new one.',
      });
      return;
    }
    const comparePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if(comparePassword) {
      res.status(400).json({ error: 'New password cannot be the same as the current password.' });
      return;
    }
    if(newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }



    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.json({ message: 'Your password has been reset. You can sign in with your new password.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};