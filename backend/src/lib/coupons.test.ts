import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claimCouponUsage, evaluateCoupon } from './coupons';

const coupon = (overrides: Record<string, unknown> = {}) => ({
  id: 'coupon-1', code: 'SAVE10', discountType: 'percentage', discountValue: 10,
  minPurchase: 100, maxUses: 5, usedCount: 0, expiresAt: new Date('2026-12-01T00:00:00Z'),
  status: true, createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

describe('central coupon evaluator', () => {
  it('calculates and caps discounts consistently', () => {
    assert.equal(evaluateCoupon(coupon() as any, 200, new Date('2026-10-13T00:00:00Z')).discountAmount, 20);
    assert.equal(evaluateCoupon(coupon({ discountType: 'fixed', discountValue: 500 }) as any, 200, new Date('2026-10-13T00:00:00Z')).discountAmount, 200);
  });

  it('rejects inactive, expired, exhausted and below-minimum coupons', () => {
    const now = new Date('2026-10-13T00:00:00Z');
    assert.throws(() => evaluateCoupon(coupon({ status: false }) as any, 200, now));
    assert.throws(() => evaluateCoupon(coupon({ expiresAt: new Date('2026-10-12T00:00:00Z') }) as any, 200, now));
    assert.throws(() => evaluateCoupon(coupon({ usedCount: 5 }) as any, 200, now));
    assert.throws(() => evaluateCoupon(coupon() as any, 99, now));
  });

  it('requires an atomic capacity claim before checkout can commit', async () => {
    let where: any;
    const tx = { coupon: { updateMany: async (input: any) => { where = input.where; return { count: 1 }; } } };
    await claimCouponUsage(tx as any, coupon() as any, new Date('2026-10-13T00:00:00Z'));
    assert.deepEqual(where.usedCount, { lt: 5 });
    await assert.rejects(() => claimCouponUsage({ coupon: { updateMany: async () => ({ count: 0 }) } } as any, coupon() as any));
  });
});
