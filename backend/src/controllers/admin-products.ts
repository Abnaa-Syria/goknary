import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../lib/errors';
import { AuthRequest } from '../middleware/auth';
import {
  adminCatalogSelect,
  buildCatalogWhere,
  catalogOrderBy,
  catalogPagination,
  formatCatalogProduct,
  getCatalogSummary,
  parseCatalogQuery,
} from '../lib/product-catalog';
import { getProductCommandCenterData } from '../lib/product-command-center';

const ADMIN_CATALOG_OPTIONS = { allowVendor: true, allowFeatured: true };

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ error: fallback });
};

/**
 * GET /api/admin/products/:id/hub — Operational Product Command Center (Hub)
 */
export const getAdminProductHub = async (req: AuthRequest, res: Response) => {
  try {
    const data = await getProductCommandCenterData(req.params.id, {
      isPlatformStaff: true,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error, 'Failed to load product command center data');
  }
};

/**
 * GET /api/admin/products — every vendor's products with search, filters and server-side pagination.
 * `includeSummary=true` adds marketplace-wide counts (or one vendor's, with `vendorId`), independent of
 * the other filters.
 */
export const getAdminProducts = async (req: AuthRequest, res: Response) => {
  try {
    const query = parseCatalogQuery(req.query as Record<string, unknown>, ADMIN_CATALOG_OPTIONS);
    const where = await buildCatalogWhere({}, query, ADMIN_CATALOG_OPTIONS);

    const [products, total, summary] = await Promise.all([
      prisma.product.findMany({
        where,
        select: adminCatalogSelect,
        orderBy: catalogOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
      query.includeSummary ? getCatalogSummary(query.vendorId ? { vendorId: query.vendorId } : {}) : undefined,
    ]);

    res.json({
      products: products.map(formatCatalogProduct),
      pagination: catalogPagination(query, total),
      ...(summary ? { summary } : {}),
    });
  } catch (error) {
    sendError(res, error, 'Failed to load products');
  }
};

const featuredSchema = z.object({ featured: z.boolean() });

/** PATCH /api/admin/products/:id/featured — explicit featured placement, independent of status. */
export const setProductFeatured = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = featuredSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'featured must be true or false' });

    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Product not found');

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { featured: parsed.data.featured },
      select: { id: true, featured: true, updatedAt: true },
    });
    res.json({ message: product.featured ? 'Product featured' : 'Product no longer featured', product });
  } catch (error) {
    sendError(res, error, 'Failed to update featured placement');
  }
};
