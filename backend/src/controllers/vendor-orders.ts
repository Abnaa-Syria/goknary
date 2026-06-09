import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { sendOrderStatusNotification } from '../services/whatsapp.service';
import { isOrderFinanciallyConfirmed, settleOrderOnDelivery } from '../lib/vendor-earnings';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  notes: z.string().optional(),
});

const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const getVendorOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (vendor.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Vendor account is not approved or is suspended' });
    }

    const { page = '1', limit = '20', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { vendorId: vendor.id };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
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
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders: orders.map((order) => ({
        ...order,
        address: JSON.parse(order.addressJson),
        items: order.items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            images: typeof item.product.images === 'string'
              ? JSON.parse(item.product.images)
              : item.product.images,
          },
        })),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const getVendorOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // M-03 Fix: suspended vendors cannot view individual order details
    if (vendor.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Vendor account is not approved or is suspended' });
    }

    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        vendorId: vendor.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            refundRequest: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    res.json({
      ...order,
      // H-09 Fix: safe JSON.parse
      address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
      items: order.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          images: typeof item.product.images === 'string'
            ? JSON.parse(item.product.images)
            : item.product.images,
        },
      })),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { id } = req.params;
    const { status, notes } = updateStatusSchema.parse(req.body);

    // Verify order belongs to vendor
    const order = await prisma.order.findFirst({
      where: {
        id,
        vendorId: vendor.id,
      },
      include: {
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!STATUS_FLOW[order.status]?.includes(status)) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: `Invalid status transition from ${order.status} to ${status}`,
      }]);
    }

    if (status !== 'CANCELLED' && !isOrderFinanciallyConfirmed(order)) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: ['paymentStatus'],
        message: 'Online payment must be paid before processing this order',
      }]);
    }

    // H-08 Fix: wrap status update + history in a single atomic transaction
    // If history creation fails, the status rollback is automatic
    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
        await settleOrderOnDelivery(tx, order, vendor);
      }

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: id },
          select: { productId: true, quantity: true },
        });

        for (const item of orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status,
          notes: notes || `Status updated to ${status}`,
        },
      });

      return updatedOrder;
    });

    // Send WhatsApp order status update notification to the customer
    if (order.user && order.user.phone && order.user.name) {
      sendOrderStatusNotification(
        order.user.phone,
        order.user.name,
        order.id,
        status
      ).catch((err) => console.error('Failed to send WhatsApp status notification:', err));
    }

    res.json({
      message: 'Order status updated successfully',
      order: updated,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

