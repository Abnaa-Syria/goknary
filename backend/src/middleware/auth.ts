import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: string;
    };

    let permissions: string[] = [];

    if (decoded.role === 'STAFF') {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          customRole: { select: { permissions: true } },
        },
      });

      if (dbUser?.customRole?.permissions) {
        try {
          permissions = JSON.parse(dbUser.customRole.permissions);
        } catch {
          permissions = [];
        }
      }
    }

    req.user = {
      ...decoded,
      permissions,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

/**
 * Granular permission gate.
 *
 * - ADMIN:  always passes — full bypass.
 * - VENDOR: always passes — their access is already scoped by authorize()
 *           and controller-level ownership checks.
 * - STAFF:  passes only if their CustomRole includes the permission.
 * - Others: 403.
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ADMIN — full bypass
    if (req.user.role === 'ADMIN') return next();

    // VENDOR — bypass (authorize + controller ownership already guard them)
    if (req.user.role === 'VENDOR') return next();

    // STAFF — must have the explicit permission
    if (req.user.role === 'STAFF' && req.user.permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      error: 'Insufficient permissions',
      required: permission,
    });
  };
};