import { describe, expect, it } from '@jest/globals';
import reducer, { clearCartState, fetchCart } from './cartSlice';

describe('cart hydration state', () => {
  it('does not treat the initial empty state as a hydrated cart', () => {
    expect(reducer(undefined, { type: 'unknown' }).hydrationStatus).toBe('idle');
  });

  it('marks the cart as hydrated only after a successful initial fetch', () => {
    const loadingState = reducer(undefined, fetchCart.pending('request-id', undefined));
    expect(loadingState.hydrationStatus).toBe('loading');

    const hydratedState = reducer(
      loadingState,
      fetchCart.fulfilled(
        { items: [], subtotal: 0, total: 0, itemCount: 0 },
        'request-id',
        undefined
      )
    );
    expect(hydratedState.hydrationStatus).toBe('succeeded');
  });

  it('records a failed hydration without claiming the cart is empty', () => {
    const failedState = reducer(
      undefined,
      fetchCart.rejected(new Error('network'), 'request-id', undefined, 'Failed to fetch cart')
    );
    expect(failedState.hydrationStatus).toBe('failed');
    expect(failedState.items).toEqual([]);
  });

  it('treats an explicit local clear as a known empty cart', () => {
    expect(reducer(undefined, clearCartState()).hydrationStatus).toBe('succeeded');
  });
});
