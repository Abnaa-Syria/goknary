import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getHomeSections = async (req: Request, res: Response) => {
  try {
    // Get banners
    const banners = await prisma.banner.findMany({
      where: {
        status: true,
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } },
        ],
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        ],
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    // Get home sections config
    const sections = await prisma.homeSection.findMany({
      where: {
        status: true,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    // Get products for each section
    const sectionsWithProducts = await Promise.all(
      sections.map(async (section) => {
        let products = [];

        switch (section.type) {
          case 'top_deals':
            products = await prisma.product.findMany({
              where: {
                status: 'ACTIVE',
                discountPrice: { not: null },
              },
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
              orderBy: {
                createdAt: 'desc',
              },
              take: 12,
            });
            break;

          case 'trending':
            products = await prisma.product.findMany({
              where: {
                status: 'ACTIVE',
              },
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
              orderBy: {
                ratingAvg: 'desc',
              },
              take: 12,
            });
            break;

          case 'best_sellers':
            // This would ideally use order data, but for now use rating
            products = await prisma.product.findMany({
              where: {
                status: 'ACTIVE',
              },
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
              orderBy: {
                ratingCount: 'desc',
              },
              take: 12,
            });
            break;

          case 'recommended':
            products = await prisma.product.findMany({
              where: {
                status: 'ACTIVE',
                featured: true,
              },
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
              orderBy: {
                ratingAvg: 'desc',
              },
              take: 12,
            });
            break;

          default:
            products = [];
        }

        return {
          ...section,
          products,
        };
      })
    );

    res.json({
      banners,
      sections: sectionsWithProducts,
    });
  } catch (error) {
    console.error('Error fetching home sections:', error);
    res.status(500).json({ error: 'Failed to fetch home sections' });
  }
};

