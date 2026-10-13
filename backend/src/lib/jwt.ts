import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

// `jwtid` adds a unique `jti` claim so tokens issued in the same second never collide.
// Tokens issued before `jti` existed carry no such claim and still verify normally.
export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];

  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, secret, { expiresIn, jwtid: randomUUID() });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }

  return jwt.sign(payload, secret, { expiresIn, jwtid: randomUUID() });
};

/**
 * True when a token was issued before the user's last password change/reset, i.e. it belongs to an
 * older session. `iat` has second precision, so compare at that precision: tokens issued in the
 * same second as the change (the new session) stay valid. No change recorded (null) never revokes.
 */
export const isIssuedBeforePasswordChange = (
  iat: number | undefined,
  passwordChangedAt: Date | null | undefined
): boolean => {
  if (!passwordChangedAt) return false;
  if (typeof iat !== 'number') return true;
  return iat < Math.floor(passwordChangedAt.getTime() / 1000);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.verify(token, secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  return jwt.verify(token, secret) as TokenPayload;
};
