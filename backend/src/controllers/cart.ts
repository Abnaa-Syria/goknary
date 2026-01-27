import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

// Helper to get session ID from request (for guest users)
const getSessionId = (req: Request): string | null => {
  // For now, we'll use a cookie or generate one
  // In production, you'd use express-session or similar
  return req.headers['x-session-id'] as string | undefined || null;
};

const addToCartSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
});

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.json({ items: [], total: 0 });
    }

    const cartItems = await prisma.cartItem.findMany({
      where: userId ? { userId } : { sessionId },
      include: {
        product: {
          include: {
            vendor: {
              select: {
                id: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate totals
    let subtotal = 0;
    const items = cartItems.map((item) => {
      const price = item.product.discountPrice || item.product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      return {
        id: item.id,
        product: {
          ...item.product,
          images: typeof item.product.images === 'string' 
            ? JSON.parse(item.product.images) 
            : item.product.images,
        },
        quantity: item.quantity,
        price: item.product.price,
        discountPrice: item.product.discountPrice,
        itemTotal,
      };
    });

    res.json({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round(subtotal * 100) / 100, // Shipping will be added in checkout
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    const { productId, quantity } = addToCartSchema.parse(req.body);

    // Verify product exists and is available
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        productId,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    let cartItem;
    if (existingItem) {
      // Update quantity
      const newQuantity = Math.min(existingItem.quantity + quantity, product.stock);
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: {
          product: {
            include: {
              vendor: {
                select: {
                  storeName: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new cart item
      if (!userId && !sessionId) {
        // Generate session ID if guest user
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // In production, set this as a cookie
        res.setHeader('X-Session-Id', newSessionId);
        cartItem = await prisma.cartItem.create({
          data: {
            sessionId: newSessionId,
            productId,
            quantity,
          },
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    storeName: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });
      } else {
        cartItem = await prisma.cartItem.create({
          data: {
            userId: userId || undefined,
            sessionId: sessionId || undefined,
            productId,
            quantity,
          },
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    storeName: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });
      }
    }

    res.json({
      message: 'Item added to cart',
      item: {
        ...cartItem,
        product: {
          ...cartItem.product,
          images: typeof cartItem.product.images === 'string'
            ? JSON.parse(cartItem.product.images)
            : cartItem.product.images,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    // Verify cart item belongs to user/session
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id,
        ...(userId ? { userId } : { sessionId }),
      },
      include: {
        product: true,
      },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (quantity > cartItem.product.stock) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const updated = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
      include: {
        product: {
          include: {
            vendor: {
              select: {
                storeName: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    res.json({
      message: 'Cart item updated',
      item: {
        ...updated,
        product: {
          ...updated.product,
          images: typeof updated.product.images === 'string'
            ? JSON.parse(updated.product.images)
            : updated.product.images,
        },
      },
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

export const removeCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);
    const { id } = req.params;

    // Verify cart item belongs to user/session
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.json({ message: 'Cart is already empty' });
    }

    await prisma.cartItem.deleteMany({
      where: userId ? { userId } : { sessionId },
    });

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};

