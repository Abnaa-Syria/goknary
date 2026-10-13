import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { ValidationError } from '../lib/errors';
import { calculatePendingEarnings } from '../lib/vendor-earnings';
import { formatPrice } from '../lib/utils';
import { NotificationType, notifyVendor } from '../lib/notify';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../lib/errors';
import { writeAdminAudit } from '../lib/audit-log';

const createPayoutSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  paymentDetails: z.string().min(1),
});

export const payoutFingerprint = (input: z.infer<typeof createPayoutSchema>) =>
  createHash('sha256').update(JSON.stringify({
    amount: Math.round(input.amount * 100),
    paymentMethod: input.paymentMethod.trim().toUpperCase(),
    paymentDetails: input.paymentDetails.trim(),
  })).digest('hex');

const updatePayoutSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
});

// GET /api/vendor/wallet (Vendor available/pending/withdrawn balance)
export const getVendorWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true,
        balance: true,
        pendingBalance: true,
        withdrawnAmount: true,
        commissionRate: true,
      },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const pendingEarnings = await calculatePendingEarnings(vendor.id, vendor.commissionRate);
    const pendingPayouts = await prisma.payoutRequest.aggregate({
      where: {
        vendorId: vendor.id,
        status: 'PENDING',
      },
      _sum: {
        amount: true,
      },
    });

    res.json({
      balance: vendor.balance,
      withdrawnAmount: vendor.withdrawnAmount,
      pendingPayoutAmount: Math.round((pendingPayouts._sum.amount || 0) * 100) / 100,
      pendingBalance: Math.round(pendingEarnings * 100) / 100,
      pendingEarnings: Math.round(pendingEarnings * 100) / 100,
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet info' });
  }
};

// GET /api/vendor/payouts (List payout requests for vendor)
export const getVendorPayouts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });

    const payouts = await prisma.payoutRequest.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ payouts });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ error: 'Failed to fetch payout requests' });
  }
};

// POST /api/vendor/payouts (Create payout request with Concurrency Guard)
export const createPayoutRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });

    const input = createPayoutSchema.parse(req.body);
    const { amount, paymentMethod, paymentDetails } = input;
    const idempotencyKey = z.string().min(8).max(128).parse(req.header('Idempotency-Key'));
    const requestFingerprint = payoutFingerprint(input);

    const replay = await prisma.payoutRequest.findFirst({ where: { vendorId: vendor.id, idempotencyKey } });
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint) {
        throw new ConflictError('Idempotency key was already used for a different payout request');
      }
      return res.status(200).json({ message: 'Payout request already submitted', payout: replay, replayed: true });
    }

    // Strict transaction with locking checks to prevent double-spending / race conditions
    let payout;
    try {
      payout = await prisma.$transaction(async (tx) => {
        // The unique key is claimed before any balance mutation. A racing retry rolls back cleanly.
        const created = await tx.payoutRequest.create({
          data: {
            vendorId: vendor.id,
            amount,
            paymentMethod,
            paymentDetails,
            idempotencyKey,
            requestFingerprint,
            status: 'PENDING',
          },
        });

        const debit = await tx.vendor.updateMany({
          where: { id: vendor.id, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (debit.count !== 1) {
          throw new ValidationError('Insufficient available balance for this withdrawal');
        }
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await prisma.payoutRequest.findFirst({ where: { vendorId: vendor.id, idempotencyKey } });
        if (raced && raced.requestFingerprint === requestFingerprint) {
          return res.status(200).json({ message: 'Payout request already submitted', payout: raced, replayed: true });
        }
        throw new ConflictError('Idempotency key was already used for a different payout request');
      }
      throw error;
    }

    res.status(201).json({ message: 'Payout request submitted successfully', payout });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof ConflictError) {
      return res.status(error.statusCode).json({ error: error.message, code: 'IDEMPOTENCY_KEY_REUSE' });
    }
    console.error('Error creating payout request:', error);
    res.status(500).json({ error: 'Failed to submit payout request' });
  }
};

// GET /api/admin/payouts (List all payout requests)
export const getAdminPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const payouts = await prisma.payoutRequest.findMany({
      include: {
        vendor: {
          select: {
            storeName: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ payouts });
  } catch (error) {
    console.error('Error fetching admin payouts:', error);
    res.status(500).json({ error: 'Failed to fetch payout requests' });
  }
};

// PATCH /api/admin/payouts/:id (Approve/Reject payout request with Concurrency Guard)
export const updatePayoutStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = updatePayoutSchema.parse(req.body);

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const actor = req.user;
    const updatedPayout = await prisma.$transaction(async (tx) => {
      // Check payout request
      const payout = await tx.payoutRequest.findUnique({
        where: { id },
      });

      if (!payout) {
        throw new ValidationError('Payout request not found');
      }

      const claimed = await tx.payoutRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, notes, processedBy: actor.id, processedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictError('Payout request has already been processed');

      if (status === 'APPROVED') {
        // If approved, lock the withdrawn amount increment
        await tx.vendor.update({
          where: { id: payout.vendorId },
          data: {
            withdrawnAmount: { increment: payout.amount },
          },
        });
      } else if (status === 'REJECTED') {
        // If rejected, refund the amount back to vendor available balance
        await tx.vendor.update({
          where: { id: payout.vendorId },
          data: {
            balance: { increment: payout.amount },
          },
        });
      }

      await writeAdminAudit(tx, {
        actor,
        action: `PAYOUT_${status}`,
        entityType: 'PAYOUT',
        entityId: id,
        metadata: { vendorId: payout.vendorId, amount: payout.amount, previousStatus: payout.status, status },
      });

      return tx.payoutRequest.findUniqueOrThrow({ where: { id } });
    });

    const payoutApproved = status === 'APPROVED';
    const amountText = formatPrice(updatedPayout.amount);
    await notifyVendor(updatedPayout.vendorId, {
      type: NotificationType.PAYOUT_STATUS_CHANGED,
      title: payoutApproved ? 'Payout approved' : 'Payout rejected',
      titleAr: payoutApproved ? 'تمت الموافقة على طلب السحب' : 'تم رفض طلب السحب',
      message: payoutApproved
        ? `Your payout request of ${amountText} was approved.`
        : `Your payout request of ${amountText} was rejected and the amount returned to your balance.${notes ? ` Note: ${notes}` : ''}`,
      messageAr: payoutApproved
        ? `تمت الموافقة على طلب سحب بقيمة ${amountText}.`
        : `تم رفض طلب سحب بقيمة ${amountText} وتم إرجاع المبلغ لرصيدك.${notes ? ` ملاحظة: ${notes}` : ''}`,
      link: '/vendor/payouts',
      entityType: 'PAYOUT',
      entityId: updatedPayout.id,
    });

    res.json({ message: `Payout request ${status.toLowerCase()} successfully`, payout: updatedPayout });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof ConflictError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating payout status:', error);
    res.status(500).json({ error: 'Failed to update payout status' });
  }
};
