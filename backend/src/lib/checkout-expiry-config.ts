const DEFAULT_TTL_HOURS = 24;
const DEFAULT_SWEEP_MINUTES = 5;
const DEFAULT_BATCH_SIZE = 50;

const boundedNumber = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return value;
};

export const getCheckoutPaymentTtlHours = (env: NodeJS.ProcessEnv = process.env): number =>
  boundedNumber(env.CHECKOUT_PAYMENT_TTL_HOURS, DEFAULT_TTL_HOURS, 1, 168);

export const calculateCheckoutExpiresAt = (
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): Date => new Date(now.getTime() + getCheckoutPaymentTtlHours(env) * 60 * 60 * 1000);

export const getCheckoutExpirySweepMinutes = (env: NodeJS.ProcessEnv = process.env): number => {
  const fallback = env.NODE_ENV === 'production' ? DEFAULT_SWEEP_MINUTES : 0;
  return boundedNumber(env.CHECKOUT_EXPIRY_SWEEP_INTERVAL_MINUTES, fallback, 0, 1440);
};

export const getCheckoutExpiryBatchSize = (env: NodeJS.ProcessEnv = process.env): number =>
  Math.floor(boundedNumber(env.CHECKOUT_EXPIRY_BATCH_SIZE, DEFAULT_BATCH_SIZE, 1, 100));

