import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../lib/errors';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { formatPrice } from '../lib/utils';

const createOrderSchema = z.object({
  addressId: z.string().optional(),
  address: z.any().optional(),
  shippingMethod: z.string().default('Standard').optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().optional()
  })),
});

// Helper to read guest session id (same header used by cart controller)
const getSessionId = (req: Request): string | null => {
  return (req.headers['x-session-id'] as string | undefined) || null;
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    console.log("RECEIVED BODY:", req.body);

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    
    // Explicit parsing with Zod bounds
    const { address, shippingMethod, couponCode, items, notes } = createOrderSchema.parse(req.body);

    const cartWhere = { userId };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Map strict backend products from frontend payload definitions
    const productIds = items.map(item => item.productId);
    const productsData = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        vendor: true,
      },
    });

    const productMap = new Map(productsData.map(p => [p.id, p]));

    // Construct exactly what the calculation sequence expects
    const cartItems = items.map(item => {
      const product = productMap.get(item.productId);
      if (!product) throw new ValidationError(`Mapped Product ${item.productId} could not be resolved`);
      return {
        id: 'runtime-checkout-payload',
        productId: item.productId,
        quantity: item.quantity,
        product,
      };
    });

    // Evaluate Global Subtotals for accurate promotional deductions
    const globalSubtotal = cartItems.reduce((acc, item) => {
      const p = item.product.discountPrice || item.product.price;
      return acc + (p * item.quantity);
    }, 0);

    let globalDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (
        coupon &&
        coupon.status &&
        (!coupon.expiresAt || new Date() < new Date(coupon.expiresAt)) &&
        (!coupon.maxUses || coupon.usedCount < coupon.maxUses) &&
        globalSubtotal >= (coupon.minPurchase || 0)
      ) {
        appliedCoupon = coupon;
        if (coupon.discountType === 'percentage') {
          globalDiscount = (globalSubtotal * coupon.discountValue) / 100;
        } else if (coupon.discountType === 'fixed') {
          globalDiscount = coupon.discountValue;
        }
        globalDiscount = Math.min(globalDiscount, globalSubtotal);
      } else {
        throw new ValidationError('Invalid or expired promotional code bounds applied');
      }
    }

    // Group items by vendor
    const itemsByVendor = new Map<string, typeof cartItems>();
    cartItems.forEach((item) => {
      const vendorId = item.product.vendorId;
      if (!itemsByVendor.has(vendorId)) {
        itemsByVendor.set(vendorId, []);
      }
      itemsByVendor.get(vendorId)!.push(item);
    });

    // Get address
    let orderAddress = address;
    if (!orderAddress) {
      // Fallback if needed, though frontend sends it
      return res.status(400).json({ error: 'Address is required' });
    }

    // Create orders for each vendor (multi-vendor support)
    const orders = [];

    for (const [vendorId, vendorItems] of itemsByVendor.entries()) {
      // Calculate totals
      let subtotal = 0;
      const orderItemsData = vendorItems.map((item) => {
        const price = item.product.discountPrice || item.product.price;
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        // Check stock
        if (item.product.stock < item.quantity) {
          throw new ValidationError(`Insufficient stock for ${item.product.name}`);
        }

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
          discountPrice: item.product.discountPrice,
        };
      });

      const orderShare = globalSubtotal > 0 ? (subtotal / globalSubtotal) : 0;
      const orderDiscountAmount = globalDiscount * orderShare;

      const shippingCost = subtotal >= 500 ? 0 : 50; // Free shipping over 500 EGP
      const total = (subtotal - orderDiscountAmount) + shippingCost;

      // C-01 Fix: Wrap order creation + stock decrement in a single transaction
      // to prevent race conditions / overselling when concurrent orders hit low stock.
      const order = await prisma.$transaction(async (tx) => {
        // Re-verify stock inside the transaction (prevents TOCTOU race)
        for (const item of vendorItems) {
          const freshProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true, name: true },
          });
          if (!freshProduct || freshProduct.stock < item.quantity) {
            throw new ValidationError(
              `Insufficient stock for "${item.product.name}". Only ${freshProduct?.stock ?? 0} left.`
            );
          }
        }

        // Create the order
        const createdOrder = await tx.order.create({
          data: {
            userId,
            vendorId,
            status: 'PENDING',
            subtotal,
            shippingCost,
            total,
            couponCode: appliedCoupon?.code || null,
            discountAmount: orderDiscountAmount,
            addressJson: JSON.stringify(orderAddress),
            shippingMethod: shippingMethod || 'Standard',
            notes,
            items: {
              create: orderItemsData,
            },
            statusHistory: {
              create: {
                status: 'PENDING',
                notes: 'Order created',
              },
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            vendor: {
              select: {
                storeName: true,
                slug: true,
              },
            },
          },
        });

        // Decrement stock atomically inside the same transaction
        for (const item of vendorItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        return createdOrder;
      });

      orders.push(order);

      // --- PHASE 1: VENDOR NOTIFICATION ---
      try {
        const vendor = await prisma.vendor.findUnique({
          where: { id: vendorId },
          select: { userId: true, storeName: true }
        });
        if (vendor?.userId) {
          await prisma.notification.create({
            data: {
              userId: vendor.userId,
              title: 'New Order Received!',
              message: `You have received a new order (${order.id}) totaling ${formatPrice(order.total)}.`,
              type: 'info'
            }
          });
        }
      } catch (err) {
        console.error('Failed to dispatch vendor order notification', err);
      }
    }

    // --- PHASE 1: ADMIN NOTIFICATIONS ---
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true }
      });
      const adminNotifications = admins.map(admin => ({
        userId: admin.id,
        title: 'New Platform Transaction',
        message: `A new order flow was completed. ${orders.length} sub-orders generated.`,
        type: 'info'
      }));
      if (adminNotifications.length > 0) {
        await prisma.notification.createMany({
          data: adminNotifications
        });
      }
    } catch (err) {
      console.error('Failed to dispatch admin root notifications', err);
    }

    // Increment Coupon Utility Use Count
    if (appliedCoupon) {
      await prisma.coupon.update({
        where: { id: appliedCoupon.id },
        data: { usedCount: { increment: 1 } }
      });
    }

    // Clear cart after order creation (both user and session carts)
    await prisma.cartItem.deleteMany({
      where: cartWhere,
    });

    res.status(201).json({
      message: 'Order created successfully',
      orders: orders.map((order) => ({
        ...order,
        // H-09 Fix: safe JSON.parse — malformed addressJson won't crash the endpoint
        address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError || (error as any).name === 'ZodError') {
      console.log("VALIDATION ERROR:", error);
      return res.status(400).json({ message: "Validation Failed", details: (error as any).errors || error });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating order:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown Database Error',
      message: 'Failed to create order' 
    });
  }
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;

    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: true,
                },
              },
            },
          },
          vendor: {
            select: {
              storeName: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    res.json({
      orders: orders.map((order) => ({
        ...order,
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
      })),
      pagination: {
        totalCount: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown Database Error' 
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    storeName: true,
                    slug: true,
                  },
                },
                category: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        vendor: {
          select: {
            storeName: true,
            slug: true,
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
      // H-09 Fix: safe JSON.parse — a corrupt addressJson won't crash the endpoint
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

export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    // Verify order ownership and status
    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new ValidationError(`Order cannot be cancelled in its current state: ${order.status}`);
    }

    // Atomic transaction: update status + increment stock + add history
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Restore stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Add to history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'CANCELLED',
          notes: 'Order cancelled by customer',
        },
      });

      return updated;
    });

    res.json({ message: 'Order cancelled successfully', order: updatedOrder });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

export const returnOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const order = await prisma.order.findFirst({
      where: { id, userId },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status !== 'DELIVERED') {
      throw new ValidationError('Only delivered orders can be returned');
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: 'REFUNDED' }, // Using REFUNDED as the terminal return state
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'REFUNDED',
          notes: `Return requested. Reason: ${reason || 'Not specified'}`,
        },
      });

      return updated;
    });

    res.json({ message: 'Return request processed', order: updatedOrder });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error requesting return:', error);
    res.status(500).json({ error: 'Failed to request return' });
  }
};

export const getOrderStatusHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is owner or admin or vendor of this order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const isOwner = order.userId === userId;
    const isAdmin = req.user.role === 'ADMIN';
    const isVendor = req.user.role === 'VENDOR' && order.vendorId === req.user.id; // User.id is used for vendor lookup in some contexts

    // Fix: correct vendor check if req.user.id is for user, we need to check vendor table
    let authorized = isOwner || isAdmin;
    if (!authorized && req.user.role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
      if (vendor && order.vendorId === vendor.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ history });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching order status history:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
};

