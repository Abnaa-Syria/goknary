import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publicProductWhere, toPublicProduct } from '../lib/visibility';
import { FINANCIALLY_CONFIRMED_ORDER_WHERE } from '../lib/vendor-earnings';
import { HOME_RANKING, RECOMMENDED_PRODUCT_ORDER } from '../lib/ranking-config';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const sectionInclude = {
  vendor: { select: { storeName: true, slug: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

type SectionProduct = Prisma.ProductGetPayload<{ include: typeof sectionInclude }>;

/** Public products for the given ids, in the given order, available ones first (stable). */
const loadInOrder = async (ids: string[]): Promise<SectionProduct[]> => {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: publicProductWhere({ id: { in: ids } }), include: sectionInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter((row): row is SectionProduct => !!row);
  return [...ordered.filter((p) => p.stock > 0), ...ordered.filter((p) => p.stock <= 0)];
};

const loadRecommended = (take: number, excludeIds: string[] = []) =>
  prisma.product.findMany({
    where: publicProductWhere({ stock: { gt: 0 }, ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}) }),
    include: sectionInclude,
    orderBy: RECOMMENDED_PRODUCT_ORDER,
    take,
  });

/** Best sellers: most units in delivered, payment-confirmed orders of the last BEST_SELLERS_WINDOW_DAYS. No padding. */
const loadBestSellers = async () => {
  const groups = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        status: 'DELIVERED',
        createdAt: { gte: daysAgo(HOME_RANKING.BEST_SELLERS_WINDOW_DAYS) },
        ...FINANCIALLY_CONFIRMED_ORDER_WHERE,
      },
    },
    _sum: { quantity: true },
    orderBy: [{ _sum: { quantity: 'desc' } }, { productId: 'asc' }],
    take: HOME_RANKING.CANDIDATES,
  });
  return (await loadInOrder(groups.map((g) => g.productId))).slice(0, HOME_RANKING.SECTION_SIZE);
};

/**
 * Trending: most product views by logged-in customers in the last TRENDING_WINDOW_DAYS. When fewer
 * products than the section size have recent views, the rest is filled by general ranking score.
 */
const loadTrending = async () => {
  const groups = await prisma.userEvent.groupBy({
    by: ['productId'],
    where: { type: 'PRODUCT_VIEW', createdAt: { gte: daysAgo(HOME_RANKING.TRENDING_WINDOW_DAYS) }, productId: { not: null } },
    _count: { productId: true },
    orderBy: [{ _count: { productId: 'desc' } }, { productId: 'asc' }],
    take: HOME_RANKING.CANDIDATES,
  });
  const trending = (await loadInOrder(groups.map((g) => g.productId).filter((id): id is string => !!id))).slice(
    0,
    HOME_RANKING.SECTION_SIZE
  );
  const missing = HOME_RANKING.SECTION_SIZE - trending.length;
  if (missing <= 0) return trending;
  return [...trending, ...(await loadRecommended(missing, trending.map((p) => p.id)))];
};

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
        let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];

        switch (section.type) {
          case 'top_deals':
            products = await prisma.product.findMany({
              where: {
                status: { in: ['ACTIVE' as any, 'APPROVED' as any] },
                vendor: { status: 'APPROVED' },
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
            products = await loadTrending();
            break;

          case 'best_sellers':
            products = await loadBestSellers();
            break;

          // General (same for every visitor) recommendation by precomputed ranking score.
          case 'recommended':
            products = await loadRecommended(HOME_RANKING.SECTION_SIZE);
            break;

          default:
            products = [];
        }

        return {
          ...section,
          products: products.map(toPublicProduct),
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

