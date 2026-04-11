import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const applyCoupon = async (req: Request, res: Response) => {
  try {
    const { code, cartTotal } = req.body;
    
    if (!code || cartTotal === undefined) {
      return res.status(400).json({ error: 'Promo code and cart total required for cryptographic validation' });
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

    if (!coupon) {
      return res.status(404).json({ error: 'Promo sequence invalid or non-existent in our matrix' });
    }

    if (!coupon.status) {
      return res.status(400).json({ error: 'This promo code has been deactivated by governance' });
    }

    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      return res.status(400).json({ error: 'This promotional artifact has expired' });
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'This promo code has reached its maximum utilization capacity' });
    }

    if (coupon.minPurchase && cartTotal < coupon.minPurchase) {
      return res.status(400).json({ 
        error: `Cart total must reach ${coupon.minPurchase} to initialize this promo sequence` 
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (cartTotal * coupon.discountValue) / 100;
    } else if (coupon.discountType === 'fixed') {
      discountAmount = coupon.discountValue;
    }

    // Ensure we don't discount more than the subtotal
    discountAmount = Math.min(discountAmount, cartTotal);

    res.json({
      message: 'Valid promo sequence detected',
      discountAmount,
      finalTotal: cartTotal - discountAmount,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });
  } catch (error) {
    console.error('Error applying coupon sequence:', error);
    res.status(500).json({ error: 'Failed to process promotional algorithm' });
  }
};
