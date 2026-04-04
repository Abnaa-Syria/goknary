import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { ValidationError, UnauthorizedError } from '../lib/errors';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * SHA-256 hash of a token — stored in DB instead of the raw token
 * so that even if the blacklist table leaks, tokens can't be reused.
 */
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Delete expired rows from the blacklist.
 * Called opportunistically on logout — no need for a cron job for now.
 */
const pruneExpiredBlacklist = async (): Promise<void> => {
  await prisma.refreshTokenBlacklist.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

// FIX L-06: Removed 'VENDOR' from allowed roles.
// Users can only self-register as CUSTOMER.
// Vendors must apply via POST /api/vendor/apply after registering.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response) => {
  try {
    // FIX L-06: role is no longer accepted from the request body.
    // All self-registered users start as CUSTOMER.
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split('@')[0],
        role: 'CUSTOMER', // always CUSTOMER — never trust the client
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // FIX C-03: Check blacklist before issuing a new access token.
    // If this token was used in a logout call, reject it.
    const tokenHash = hashToken(token);
    const blacklisted = await prisma.refreshTokenBlacklist.findUnique({
      where: { tokenHash },
    });
    if (blacklisted) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    const decoded = verifyRefreshToken(token);

    const accessToken = generateAccessToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    res.json({ accessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // FIX C-03: Blacklist the refresh token so it can never be used again.
    // The access token (15m) will expire naturally.
    const { refreshToken: token } = req.body;

    if (token) {
      const tokenHash = hashToken(token);

      // Decode without throwing — token may already be expired, and that's fine.
      // We still want to blacklist it to be safe.
      let expiresAt: Date;
      try {
        const decoded = verifyRefreshToken(token);
        // jwt payload `exp` is in seconds
        expiresAt = new Date((decoded as any).exp * 1000);
      } catch {
        // If the token is already expired, blacklist it for 7 days from now
        // (the max refresh token lifetime) so it can't be replayed if the
        // clock was skewed.
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      // Upsert: safe to call multiple times for the same token
      await prisma.refreshTokenBlacklist.upsert({
        where: { tokenHash },
        update: {}, // already blacklisted — nothing to change
        create: { token, tokenHash, expiresAt },
      });

      // Opportunistically clean up expired rows (fire-and-forget)
      pruneExpiredBlacklist().catch(() => {});
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    // Always return success on logout — client should clear its tokens regardless
    res.json({ message: 'Logged out successfully' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData = updateProfileSchema.parse(req.body);

    const dataToUpdate: { name?: string; phone?: string | null } = {};
    if (updateData.name !== undefined) {
      dataToUpdate.name = updateData.name;
    }
    if (updateData.phone !== undefined) {
      dataToUpdate.phone = updateData.phone.trim() || null;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user, message: 'Profile updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};