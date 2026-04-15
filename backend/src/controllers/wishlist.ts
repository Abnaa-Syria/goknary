import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const addToWishlistSchema = z.object({
  productId: z.string(),
});

export const getWishlist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
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
            brand: {
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

    const items = wishlistItems.map((item) => ({
      id: item.id,
      product: {
        ...item.product,
        images: typeof item.product.images === 'string' ? JSON.parse(item.product.images) : item.product.images,
      },
      createdAt: item.createdAt,
    }));

    res.json({ items, count: items.length });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
};

export const getWishlistCount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.json({ count: 0 });
    }
    const count = await prisma.wishlistItem.count({
      where: { userId: req.user.id }
    });
    res.json({ count });
  } catch (error) {
    console.error('Error computing wishlist matrix count:', error);
    res.status(500).json({ error: 'Failed to synchronize count data' });
  }
};

export const addToWishlist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { productId } = addToWishlistSchema.parse(req.body);

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if already in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    if (existingItem) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: req.user.id,
        productId,
      },
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
    });

    res.status(201).json({
      id: wishlistItem.id,
      product: {
        ...wishlistItem.product,
        images: typeof wishlistItem.product.images === 'string' ? JSON.parse(wishlistItem.product.images) : wishlistItem.product.images,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const wishlistItem = await prisma.wishlistItem.findUnique({
      where: { id },
    });

    if (!wishlistItem) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    if (wishlistItem.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.wishlistItem.delete({
      where: { id },
    });

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
};

export const removeFromWishlistByProductId = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { productId } = req.params;

    const wishlistItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    if (!wishlistItem) {
      return res.status(404).json({ error: 'Product not in wishlist' });
    }

    await prisma.wishlistItem.delete({
      where: { id: wishlistItem.id },
    });

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
};

export const checkWishlistStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.json({ inWishlist: false });
    }

    const { productId } = req.params;

    const wishlistItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    res.json({ inWishlist: !!wishlistItem });
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    res.status(500).json({ error: 'Failed to check wishlist status' });
  }
};

