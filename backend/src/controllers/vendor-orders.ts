import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { z } from 'zod';
import { sendOrderStatusNotification } from '../services/whatsapp.service';
import { notifyCustomerOrderStatus } from '../lib/notify';
import { withoutPaymentReferences } from '../lib/payment-reference';
import { transitionOrderStatus } from '../services/order-state.service';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  notes: z.string().optional(),
});

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
        ...withoutPaymentReferences(order),
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
            refundRequests: { select: { id: true, status: true, quantity: true, amount: true, createdAt: true } },
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
      ...withoutPaymentReferences(order),
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

    const result = await transitionOrderStatus({
      orderId: id,
      toStatus: status,
      notes,
      vendorId: vendor.id,
    });
    const updated = result.order;

    if (result.changed) await notifyCustomerOrderStatus(updated.userId, id, status);

    // Send WhatsApp order status update notification to the customer
    if (result.changed && updated.user && updated.user.phone && updated.user.name) {
      sendOrderStatusNotification(
        updated.user.phone,
        updated.user.name,
        updated.id,
        status
      ).catch((err) => console.error('Failed to send WhatsApp status notification:', err));
    }

    res.json({
      message: 'Order status updated successfully',
      order: withoutPaymentReferences(updated),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (error instanceof ValidationError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};
