import { Coupon, Prisma } from '@prisma/client';
import { ValidationError } from './errors';

export interface CouponEvaluation {
  coupon: Coupon;
  discountAmount: number;
  finalTotal: number;
}

export function evaluateCoupon(coupon: Coupon | null, subtotal: number, now = new Date()): CouponEvaluation {
  if (!coupon) throw new ValidationError('Promotional code was not found');
  if (!coupon.status) throw new ValidationError('This promotional code is inactive');
  if (coupon.expiresAt && coupon.expiresAt <= now) throw new ValidationError('This promotional code has expired');
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new ValidationError('This promotional code has reached its maximum usage');
  }
  if (subtotal < (coupon.minPurchase ?? 0)) {
    throw new ValidationError(`Cart total must reach ${coupon.minPurchase} to use this promotional code`);
  }

  const raw = coupon.discountType.toLowerCase() === 'percentage'
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;
  const discountAmount = Math.max(0, Math.min(raw, subtotal));
  return { coupon, discountAmount, finalTotal: subtotal - discountAmount };
}

export async function findAndEvaluateCoupon(
  db: Pick<Prisma.TransactionClient, 'coupon'>,
  code: string,
  subtotal: number,
  now = new Date(),
) {
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  return evaluateCoupon(coupon, subtotal, now);
}

/** Atomic capacity claim used inside the checkout transaction. */
export async function claimCouponUsage(tx: Prisma.TransactionClient, coupon: Coupon, now = new Date()) {
  const claimed = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      status: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(coupon.maxUses != null ? { usedCount: { lt: coupon.maxUses } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new ValidationError('Promotional code is no longer available');
  }
}

