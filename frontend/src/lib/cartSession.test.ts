import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  CART_SESSION_KEY,
  LEGACY_CART_SESSION_KEY,
  clearCartSessionId,
  ensureCartSessionId,
  getCartSessionId,
} from './cartSession';

describe('cart session storage', () => {
  beforeEach(() => localStorage.clear());

  it('uses the canonical key as the source of truth', () => {
    localStorage.setItem(CART_SESSION_KEY, 'canonical-session');
    localStorage.setItem(LEGACY_CART_SESSION_KEY, 'legacy-session');
    expect(getCartSessionId()).toBe('canonical-session');
  });

  it('migrates an existing legacy key without changing its session id', () => {
    localStorage.setItem(LEGACY_CART_SESSION_KEY, 'existing-guest-cart');
    expect(getCartSessionId()).toBe('existing-guest-cart');
    expect(localStorage.getItem(CART_SESSION_KEY)).toBe('existing-guest-cart');
    expect(localStorage.getItem(LEGACY_CART_SESSION_KEY)).toBeNull();
  });

  it('creates one stable session id when neither key exists', () => {
    const first = ensureCartSessionId();
    expect(ensureCartSessionId()).toBe(first);
    expect(localStorage.getItem(CART_SESSION_KEY)).toBe(first);
  });

  it('clears canonical and legacy keys only when explicitly requested', () => {
    localStorage.setItem(CART_SESSION_KEY, 'canonical-session');
    localStorage.setItem(LEGACY_CART_SESSION_KEY, 'legacy-session');
    clearCartSessionId();
    expect(localStorage.getItem(CART_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CART_SESSION_KEY)).toBeNull();
  });
});
