import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../lib/errors';
import { calculateVendorNetEarnings } from '../lib/vendor-earnings';

const createRefundSchema = z.object({
  orderItemId: z.string().min(1),
  reason: z.string().min(3),
});

const vendorUpdateSchema = z.object({
  status: z.enum(['VENDOR_APPROVED', 'VENDOR_REJECTED']),
  notes: z.string().optional(),
});

const adminUpdateSchema = z.object({
  status: z.enum(['ADMIN_APPROVED', 'ADMIN_REJECTED']),
  notes: z.string().optional(),
});

// POST /api/refunds (Customer only)
export const createRefundRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { orderItemId, reason } = createRefundSchema.parse(req.body);

    // Fetch orderItem inside transaction or safely
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: true,
        product: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundError('Order item not found');
    }

    // Verify ownership
    if (orderItem.order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this order' });
    }

    // Verify order status is DELIVERED
    if (orderItem.order.status !== 'DELIVERED') {
      throw new ValidationError('Refunds can only be requested for delivered orders');
    }

    // Check if a refund request already exists (unique constraint will catch it too, but fail early)
    const existing = await prisma.refundRequest.findUnique({
      where: { orderItemId },
    });
    if (existing) {
      throw new ValidationError('A refund request has already been submitted for this item');
    }

    // Calculate refund amount
    const pricePaid = orderItem.discountPrice || orderItem.price;
    const amount = pricePaid * orderItem.quantity;

    // Create the RefundRequest
    const refundRequest = await prisma.refundRequest.create({
      data: {
        orderId: orderItem.orderId,
        orderItemId,
        customerId: req.user.id,
        vendorId: orderItem.order.vendorId,
        reason,
        amount,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Refund request submitted successfully',
      refundRequest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating refund request:', error);
    res.status(500).json({ error: 'Failed to submit refund request' });
  }
};

// GET /api/refunds (Customer, Vendor, Admin)
export const getRefundRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const role = req.user.role;
    let where: any = {};

    if (role === 'CUSTOMER') {
      where.customerId = req.user.id;
    } else if (role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      where.vendorId = vendor.id;
    }
    // ADMIN and STAFF can view all refund requests (where is empty)

    const refunds = await prisma.refundRequest.findMany({
      where,
      include: {
        orderItem: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                images: true,
              },
            },
          },
        },
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ refunds });
  } catch (error) {
    console.error('Error fetching refund requests:', error);
    res.status(500).json({ error: 'Failed to fetch refund requests' });
  }
};

// GET /api/refunds/:id
export const getRefundRequestById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const refund = await prisma.refundRequest.findUnique({
      where: { id },
      include: {
        orderItem: {
          include: {
            product: true,
          },
        },
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundError('Refund request not found');
    }

    // Role-based auth checks
    if (req.user.role === 'CUSTOMER' && refund.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
      if (!vendor || refund.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ refund });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching refund request:', error);
    res.status(500).json({ error: 'Failed to fetch refund request details' });
  }
};

// PATCH /api/refunds/:id/vendor (Vendor only)
export const updateVendorRefundStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { status, notes } = vendorUpdateSchema.parse(req.body);

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    // Strict transaction with locking checks to prevent race conditions on double approval
    const updated = await prisma.$transaction(async (tx) => {
      const refund = await tx.refundRequest.findUnique({
        where: { id },
      });

      if (!refund) {
        throw new NotFoundError('Refund request not found');
      }

      if (refund.vendorId !== vendor.id) {
        throw new ValidationError('Forbidden: You do not own this product return');
      }

      if (refund.status !== 'PENDING') {
        throw new ValidationError(`Cannot update refund request in state: ${refund.status}`);
      }

      return tx.refundRequest.update({
        where: { id },
        data: {
          status,
          vendorNotes: notes || `Vendor updated status to ${status}`,
        },
      });
    });

    res.json({ message: 'Refund status updated by vendor', refund: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating vendor refund status:', error);
    res.status(500).json({ error: 'Failed to update refund request status' });
  }
};

// PATCH /api/refunds/:id/admin (Admin only - updates balances and stock atomically)
export const updateAdminRefundStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { status, notes } = adminUpdateSchema.parse(req.body);

    // Strict interactive transaction with locking to ensure atomic updates and no race conditions
    const result = await prisma.$transaction(async (tx) => {
      const refund = await tx.refundRequest.findUnique({
        where: { id },
        include: {
          orderItem: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!refund) {
        throw new NotFoundError('Refund request not found');
      }

      // Allow admin to process if it's VENDOR_APPROVED or PENDING
      const allowedStates = ['PENDING', 'VENDOR_APPROVED', 'VENDOR_REJECTED'];
      if (!allowedStates.includes(refund.status)) {
        throw new ValidationError(`Refund request has already been finalized with status: ${refund.status}`);
      }

      // Update refund request status
      const updatedRefund = await tx.refundRequest.update({
        where: { id },
        data: {
          status,
          adminNotes: notes || `Admin updated status to ${status}`,
        },
      });

      if (status === 'ADMIN_APPROVED') {
        // 1. Refund the customer by incrementing their walletBalance
        await tx.user.update({
          where: { id: refund.customerId },
          data: {
            walletBalance: { increment: refund.amount },
          },
        });

        // 2. Adjust Vendor's balance
        // Note: Vendor is deducted by the net earnings they received.
        // We find the vendor's commission rate to calculate net deduction.
        const vendor = await tx.vendor.findUnique({
          where: { id: refund.vendorId },
        });

        if (vendor) {
          const { netEarnings } = calculateVendorNetEarnings(refund.amount, vendor.commissionRate);

          await tx.vendor.update({
            where: { id: refund.vendorId },
            data: {
              balance: { decrement: netEarnings },
            },
          });
        }

        // 3. Restore product stock
        await tx.product.update({
          where: { id: refund.orderItem.productId },
          data: {
            stock: { increment: refund.orderItem.quantity },
          },
        });
      }

      return updatedRefund;
    });

    res.json({ message: `Refund request ${status.toLowerCase()} by administrator`, refund: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating admin refund status:', error);
    res.status(500).json({ error: 'Failed to process refund request' });
  }
};
