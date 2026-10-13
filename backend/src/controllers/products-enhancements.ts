import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { publicProductWhere, toPublicProduct } from '../lib/visibility';
import { RECOMMENDED_PRODUCT_ORDER } from '../lib/ranking-config';

export const getRelatedProducts = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const product = await prisma.product.findFirst({
      where: publicProductWhere({ slug }),
      select: { id: true, categoryId: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Origin product not mapped' });
    }

    const related = await prisma.product.findMany({
      where: publicProductWhere({
        categoryId: product.categoryId,
        id: { not: product.id },
      }),
      include: {
        vendor: { select: { storeName: true, slug: true } },
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
      },
      take: 4,
      orderBy: RECOMMENDED_PRODUCT_ORDER
    });

    res.json({ products: related.map(toPublicProduct) });
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
