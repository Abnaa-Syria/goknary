import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const couponSchema = z.object({
  code: z.string().min(3).max(50),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  minPurchase: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const data = couponSchema.parse(req.body);
    
    const existing = await prisma.coupon.findUnique({ where: { code: data.code.toUpperCase() } });
    if (existing) {
      return res.status(400).json({ error: 'Promo code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
      }
    });

    res.status(201).json({ message: 'Promo code forged successfully', coupon });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Failed to forge promotional artifact' });
  }
};

export const getAdminCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ coupons });
  } catch (error) {
    console.error('Error fetching admin coupons:', error);
    res.status(500).json({ error: 'Network disruption accessing marketing matrix' });
  }
};

export const updateAdminCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, code, discountType, discountValue, expiresAt, maxUses, minPurchase } = req.body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (code) data.code = code.toUpperCase();
    if (discountType) data.discountType = discountType;
    if (discountValue !== undefined) data.discountValue = Number(discountValue);
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (maxUses !== undefined) data.maxUses = maxUses ? Number(maxUses) : null;
    if (minPurchase !== undefined) data.minPurchase = minPurchase ? Number(minPurchase) : null;

    const coupon = await prisma.coupon.update({
      where: { id },
      data
    });

    res.json({ message: 'Coupon matrix parameterized', coupon });
  } catch (error) {
    console.error('Error updating admin coupon:', error);
    res.status(500).json({ error: 'Failed to reconfigure promotional artifact' });
  }
};

export const deleteAdminCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.coupon.delete({ where: { id } });
    res.json({ message: 'Promotional artifact permanently disintegrated' });
  } catch (error) {
    console.error('Error deleting admin coupon:', error);
    res.status(500).json({ error: 'Disintegration failure' });
  }
};
