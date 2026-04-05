import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Generate a cryptographically random 6-digit numeric OTP.
 */
export const generateOTP = (): string => {
  // Use crypto.randomInt for uniform distribution (avoids modulo bias)
  const otp = crypto.randomInt(100000, 999999);
  return otp.toString();
};

/**
 * Hash an OTP using bcrypt before storing in the database.
 * Cost factor 10 is intentionally lower than password hashing —
 * OTPs expire quickly so we optimize for speed not endurance.
 */
export const hashOTP = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, 10);
};

/**
 * Verify a raw OTP against a bcrypt hash.
 */
export const verifyOTP = async (raw: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(raw, hash);
};
