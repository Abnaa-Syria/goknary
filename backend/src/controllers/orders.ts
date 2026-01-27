import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../lib/errors';
import { z } from 'zod';

const createOrderSchema = z.object({
  addressId: z.string().optional(),
  address: z.object({
    fullName: z.string(),
    phone: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string().default('Egypt'),
  }).optional(),
  shippingMethod: z.string().default('Standard'),
  notes: z.string().optional(),
});

// Helper to read guest session id (same header used by cart controller)
const getSessionId = (req: Request): string | null => {
  return (req.headers['x-session-id'] as string | undefined) || null;
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const sessionId = getSessionId(req);
    const { addressId, address, shippingMethod, notes } = createOrderSchema.parse(req.body);

    // Get cart items (for logged-in users we primarily use userId,
    // but also fall back to session-based cart if present)
    const cartWhere =
      userId && sessionId
        ? { OR: [{ userId }, { sessionId }] }
        : userId
        ? { userId }
        : sessionId
        ? { sessionId }
        : { userId: '' }; // will be handled by length check below

    const cartItems = await prisma.cartItem.findMany({
      where: cartWhere,
      include: {
        product: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
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
    let orderAddress;
    if (addressId) {
      const userAddress = await prisma.address.findFirst({
        where: {
          id: addressId,
          userId,
        },
      });
      if (!userAddress) {
        return res.status(404).json({ error: 'Address not found' });
      }
      orderAddress = userAddress;
    } else if (address) {
      orderAddress = address;
    } else {
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

      const shippingCost = subtotal >= 500 ? 0 : 50; // Free shipping over 500 EGP
      const total = subtotal + shippingCost;

      // Create order
      const order = await prisma.order.create({
        data: {
          userId,
          vendorId,
          status: 'PENDING',
          subtotal,
          shippingCost,
          total,
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

      // Update product stock
      for (const item of vendorItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      orders.push(order);
    }

    // Clear cart after order creation (both user and session carts)
    await prisma.cartItem.deleteMany({
      where: cartWhere,
    });

    res.status(201).json({
      message: 'Order created successfully',
      orders: orders.map((order) => ({
        ...order,
        address: JSON.parse(order.addressJson),
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;

    const orders = await prisma.order.findMany({
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
    });

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
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
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
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

