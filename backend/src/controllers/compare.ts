import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

// Helper to get session ID from request (for guest users)
const getSessionId = (req: Request): string | null => {
  return req.headers['x-session-id'] as string | undefined || null;
};

const addToCompareSchema = z.object({
  productId: z.string(),
});

export const getCompare = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.json({ items: [], count: 0 });
    }

    const compareItems = await prisma.compareItem.findMany({
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

    const items = compareItems.map((item) => ({
      id: item.id,
      product: {
        ...item.product,
        images: typeof item.product.images === 'string' ? JSON.parse(item.product.images) : item.product.images,
      },
      createdAt: item.createdAt,
    }));

    res.json({ items, count: items.length });
  } catch (error) {
    console.error('Error fetching compare list:', error);
    res.status(500).json({ error: 'Failed to fetch compare list' });
  }
};

export const addToCompare = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.status(401).json({ error: 'Session required' });
    }

    const { productId } = addToCompareSchema.parse(req.body);

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check current count (max 4 products for comparison)
    const currentCount = await prisma.compareItem.count({
      where: userId ? { userId } : { sessionId },
    });

    if (currentCount >= 4) {
      return res.status(400).json({ error: 'Maximum 4 products can be compared at once' });
    }

    // Check if already in compare
    const existingItem = userId
      ? await prisma.compareItem.findUnique({
          where: {
            userId_productId: {
              userId,
              productId,
            },
          },
        })
      : await prisma.compareItem.findUnique({
          where: {
            sessionId_productId: {
              sessionId: sessionId!,
              productId,
            },
          },
        });

    if (existingItem) {
      return res.status(400).json({ error: 'Product already in compare list' });
    }

    const compareItem = await prisma.compareItem.create({
      data: {
        userId: userId || undefined,
        sessionId: sessionId || undefined,
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
            brand: {
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
      id: compareItem.id,
      product: {
        ...compareItem.product,
        images: typeof compareItem.product.images === 'string' ? JSON.parse(compareItem.product.images) : compareItem.product.images,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error adding to compare:', error);
    res.status(500).json({ error: 'Failed to add to compare' });
  }
};

export const removeFromCompare = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    const { id } = req.params;

    const compareItem = await prisma.compareItem.findUnique({
      where: { id },
    });

    if (!compareItem) {
      return res.status(404).json({ error: 'Compare item not found' });
    }

    if (userId && compareItem.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!userId && compareItem.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.compareItem.delete({
      where: { id },
    });

    res.json({ message: 'Item removed from compare list' });
  } catch (error) {
    console.error('Error removing from compare:', error);
    res.status(500).json({ error: 'Failed to remove from compare' });
  }
};

export const clearCompare = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.status(401).json({ error: 'Session required' });
    }

    await prisma.compareItem.deleteMany({
      where: userId ? { userId } : { sessionId },
    });

    res.json({ message: 'Compare list cleared' });
  } catch (error) {
    console.error('Error clearing compare list:', error);
    res.status(500).json({ error: 'Failed to clear compare list' });
  }
};

