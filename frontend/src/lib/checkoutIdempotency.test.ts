import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  clearCheckoutIdempotencyKey,
  getCheckoutIdempotencyKey,
} from './checkoutIdempotency';

const payload = {
  address: { city: 'Cairo', state: 'Cairo' },
  shippingMethod: 'Standard',
  paymentMethod: 'KASHIER',
  items: [{ productId: 'product-1', variantId: 'variant-1', quantity: 1, price: 99 }],
};

describe('checkout idempotency key lifecycle', () => {
  beforeEach(() => localStorage.clear());

  it('reuses one key after a timeout/retry with the same material payload', () => {
    const first = getCheckoutIdempotencyKey(payload);
    expect(getCheckoutIdempotencyKey({ ...payload, items: [{ ...payload.items[0], price: 120 }] })).toBe(first);
  });

  it('creates a new key when cart, address, or payment method changes', () => {
    const first = getCheckoutIdempotencyKey(payload);
    const changed = getCheckoutIdempotencyKey({ ...payload, items: [{ ...payload.items[0], quantity: 2 }] });
    expect(changed).not.toBe(first);
  });

  it('clears the key only after checkout confirmation', () => {
    getCheckoutIdempotencyKey(payload);
    clearCheckoutIdempotencyKey();
    expect(localStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)).toBeNull();
  });
});
