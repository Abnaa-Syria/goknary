export const CHECKOUT_ATTEMPT_STORAGE_KEY = 'goknary_checkout_attempt';

interface StoredAttempt {
  key: string;
  fingerprint: string;
}

const canonicalize = (value: any): any => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce<Record<string, any>>((result, key) => {
      if (value[key] !== undefined && key !== 'price' && key !== 'paymentStatus') {
        result[key] = canonicalize(value[key]);
      }
      return result;
    }, {});
  }
  return typeof value === 'string' ? value.trim() : value;
};

export const checkoutPayloadFingerprint = (payload: unknown): string =>
  JSON.stringify(canonicalize(payload));

const newKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `checkout_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export const getCheckoutIdempotencyKey = (payload: unknown): string => {
  const fingerprint = checkoutPayloadFingerprint(payload);
  try {
    const existing = JSON.parse(localStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) || 'null') as StoredAttempt | null;
    if (existing?.key && existing.fingerprint === fingerprint) return existing.key;
  } catch {
    // Replace malformed legacy/local data with a valid attempt below.
  }

  const attempt = { key: newKey(), fingerprint };
  localStorage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  return attempt.key;
};

export const clearCheckoutIdempotencyKey = (): void => {
  localStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
};

