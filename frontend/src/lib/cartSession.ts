export const CART_SESSION_KEY = 'cart_session_id';
export const LEGACY_CART_SESSION_KEY = 'cartSessionId';

export const getCartSessionId = (): string | null => {
  const current = localStorage.getItem(CART_SESSION_KEY);
  if (current) return current;

  const legacy = localStorage.getItem(LEGACY_CART_SESSION_KEY);
  if (!legacy) return null;

  localStorage.setItem(CART_SESSION_KEY, legacy);
  localStorage.removeItem(LEGACY_CART_SESSION_KEY);
  return legacy;
};

export const ensureCartSessionId = (): string => {
  const existing = getCartSessionId();
  if (existing) return existing;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  localStorage.setItem(CART_SESSION_KEY, sessionId);
  return sessionId;
};

export const clearCartSessionId = (): void => {
  localStorage.removeItem(CART_SESSION_KEY);
  localStorage.removeItem(LEGACY_CART_SESSION_KEY);
};

