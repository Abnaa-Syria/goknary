import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;
const isProduction = () => process.env.NODE_ENV === 'production';

/** Per-IP budget for requesting reset emails / WhatsApp codes (on top of the global /api limiter). */
export const forgotPasswordLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: () => (isProduction() ? 5 : 50),
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Per-IP budget for submitting reset codes/tokens; limits brute force of the 6-digit WhatsApp code. */
export const resetPasswordLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: () => (isProduction() ? 10 : 100),
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
