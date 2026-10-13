import { describe, expect, it } from '@jest/globals';
import {
  getPaymentConfirmationState,
  isValidOrderReference,
  shouldClearCartAfterConfirmation,
} from './paymentConfirmation';

describe('payment confirmation state', () => {
  it('keeps confirmed COD orders payment-pending instead of paid', () => {
    const state = getPaymentConfirmationState([
      { status: 'CONFIRMED', paymentMethod: 'COD', paymentStatus: 'PENDING' },
    ]);

    expect(state).toBe('order-confirmed');
    expect(shouldClearCartAfterConfirmation(state)).toBe(true);
  });

  it('does not clear for a pending Kashier payment', () => {
    const state = getPaymentConfirmationState([
      { status: 'PENDING', paymentMethod: 'KASHIER', paymentStatus: 'PENDING' },
    ]);

    expect(state).toBe('payment-pending');
    expect(shouldClearCartAfterConfirmation(state)).toBe(false);
  });

  it('uses the backend paid state for a confirmed Kashier payment', () => {
    const state = getPaymentConfirmationState([
      { status: 'CONFIRMED', paymentMethod: 'KASHIER', paymentStatus: 'PAID' },
    ]);

    expect(state).toBe('payment-confirmed');
    expect(shouldClearCartAfterConfirmation(state)).toBe(true);
  });

  it('does not consider a cancelled late-paid order confirmed', () => {
    expect(
      getPaymentConfirmationState([
        { status: 'CANCELLED', paymentMethod: 'KASHIER', paymentStatus: 'PAID' },
      ])
    ).toBe('payment-pending');
  });

  it('rejects missing and malformed order references', () => {
    expect(isValidOrderReference('')).toBe(false);
    expect(isValidOrderReference('../../orders')).toBe(false);
    expect(isValidOrderReference('cmq57pl050048dh2k9422hpmp')).toBe(true);
  });
});
