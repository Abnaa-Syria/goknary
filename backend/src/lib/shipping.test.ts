import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateShippingCost, calculateCheckoutShipping } from './shipping';

describe('checkout shipping', () => {
  it('uses the active governorate rate below the global free-shipping threshold', () => {
    assert.equal(calculateCheckoutShipping(499, 500, 72.5), 72.5);
    assert.equal(calculateCheckoutShipping(500, 500, 72.5), 0);
  });

  it('uses the storefront fallback when no governorate rate exists', () => {
    assert.equal(calculateCheckoutShipping(100, 500, null), 50);
  });

  it('allocates one shipping charge across vendor orders without duplication', () => {
    const allocations = allocateShippingCost(50, [300, 200, 100]);
    assert.deepEqual(allocations, [25, 16.67, 8.33]);
    assert.equal(allocations.reduce((sum, value) => sum + value, 0), 50);
  });
});
