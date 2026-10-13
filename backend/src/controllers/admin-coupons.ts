import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { writeAdminAudit } from '../lib/audit-log';

const couponSchema = z.object({
  code: z.string().min(3).max(50),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  minPurchase: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

export const createCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const data = couponSchema.parse(req.body);
    
    const existing = await prisma.coupon.findUnique({ where: { code: data.code.toUpperCase() } });
    if (existing) {
      return res.status(400).json({ error: 'Promo code already exists' });
    }

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const coupon = await prisma.$transaction(async (tx) => {
      const created = await tx.coupon.create({ data: { ...data, code: data.code.toUpperCase() } });
      await writeAdminAudit(tx, { actor: req.user!, action: 'COUPON_CREATED', entityType: 'COUPON', entityId: created.id, metadata: { code: created.code } });
      return created;
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

export const getAdminCoupons = async (req: AuthRequest, res: Response) => {
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

export const updateAdminCoupon = async (req: AuthRequest, res: Response) => {
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

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const coupon = await prisma.$transaction(async (tx) => {
      const updated = await tx.coupon.update({ where: { id }, data });
      await writeAdminAudit(tx, { actor: req.user!, action: 'COUPON_UPDATED', entityType: 'COUPON', entityId: id, metadata: { fields: Object.keys(data) } });
      return updated;
    });

    res.json({ message: 'Coupon matrix parameterized', coupon });
  } catch (error) {
    console.error('Error updating admin coupon:', error);
    res.status(500).json({ error: 'Failed to reconfigure promotional artifact' });
  }
};

export const deleteAdminCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.delete({ where: { id } });
      await writeAdminAudit(tx, { actor: req.user!, action: 'COUPON_DELETED', entityType: 'COUPON', entityId: id, metadata: { code: coupon.code } });
    });
    res.json({ message: 'Promotional artifact permanently disintegrated' });
  } catch (error) {
    console.error('Error deleting admin coupon:', error);
    res.status(500).json({ error: 'Disintegration failure' });
  }
};
