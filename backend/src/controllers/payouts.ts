import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { ValidationError } from '../lib/errors';
import { calculatePendingEarnings } from '../lib/vendor-earnings';

const createPayoutSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  paymentDetails: z.string().min(1),
});

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

    const { amount, paymentMethod, paymentDetails } = createPayoutSchema.parse(req.body);

    // Strict transaction with locking checks to prevent double-spending / race conditions
    const payout = await prisma.$transaction(async (tx) => {
      // Fetch latest vendor balance inside transaction
      const currentVendor = await tx.vendor.findUnique({
        where: { id: vendor.id },
        select: { id: true, balance: true },
      });

      if (!currentVendor || currentVendor.balance < amount) {
        throw new ValidationError('Insufficient available balance for this withdrawal');
      }

      // Decrement the vendor balance atomically
      await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          balance: { decrement: amount },
        },
      });

      // Create the payout request
      return tx.payoutRequest.create({
        data: {
          vendorId: vendor.id,
          amount,
          paymentMethod,
          paymentDetails,
          status: 'PENDING',
        },
      });
    });

    res.status(201).json({ message: 'Payout request submitted successfully', payout });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
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

    const updatedPayout = await prisma.$transaction(async (tx) => {
      // Check payout request
      const payout = await tx.payoutRequest.findUnique({
        where: { id },
      });

      if (!payout) {
        throw new ValidationError('Payout request not found');
      }

      if (payout.status !== 'PENDING') {
        throw new ValidationError('Payout request has already been processed');
      }

      // Update payout status
      const updated = await tx.payoutRequest.update({
        where: { id },
        data: { status, notes },
      });

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

      return updated;
    });

    res.json({ message: `Payout request ${status.toLowerCase()} successfully`, payout: updatedPayout });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating payout status:', error);
    res.status(500).json({ error: 'Failed to update payout status' });
  }
};
