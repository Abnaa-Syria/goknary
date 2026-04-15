import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRelatedProducts = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Origin product not mapped' });
    }

    const related = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        status: { in: ['ACTIVE' as any, 'APPROVED' as any] },
      },
      include: {
        vendor: { select: { storeName: true, slug: true } },
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
      },
      take: 4,
      orderBy: { ratingAvg: 'desc' }
    });

    res.json({ products: related });
  } catch (error) {
    console.error('Error fetching related cross-sell matrix:', error);
    res.status(500).json({ error: 'Failed to extract related items' });
  }
};

export const getRecentProducts = async (req: Request, res: Response) => {
  try {
    const { limit = '8' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const products = await prisma.product.findMany({
      where: {
        status: { in: ['ACTIVE' as any, 'APPROVED' as any] },
      },
      include: {
        vendor: { select: { storeName: true, slug: true } },
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
      },
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ products });
  } catch (error) {
    console.error('Error fetching latest offerings:', error);
    res.status(500).json({ error: 'Failed to synchronize recent entries' });
  }
};
