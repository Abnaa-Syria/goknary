import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { findAndEvaluateCoupon } from '../lib/coupons';
import { ValidationError } from '../lib/errors';

export const applyCoupon = async (req: Request, res: Response) => {
  try {
    const { code, cartTotal } = z.object({
      code: z.string().min(1).max(50),
      cartTotal: z.number().nonnegative(),
    }).parse(req.body);
    // Preview only. The authoritative checkout recalculates subtotal and reclaims usage atomically.
    const { coupon, discountAmount, finalTotal } = await findAndEvaluateCoupon(prisma, code, cartTotal);

    res.json({
      message: 'Valid promo sequence detected',
      discountAmount,
      finalTotal,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Promo code and a valid cart total are required' });
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    console.error('Error applying coupon sequence:', error);
    res.status(500).json({ error: 'Failed to process promotional algorithm' });
  }
};
