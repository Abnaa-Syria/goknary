import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from './prisma';
import { ValidationError } from './errors';
import { getDescendantCategoryIds, loadAllCategories } from './category-tree';
import { parseImageMetadata, parseStoredImages } from './product-images';
import { PUBLIC_PRODUCT_STATUSES } from './visibility';

/**
 * Operational product lists for the admin and vendor catalogs. Every filter, the search and the
 * pagination run in the database; rows carry only list fields plus a relation count of variants.
 */
export const CATALOG_DEFAULT_LIMIT = 20;
export const CATALOG_MAX_LIMIT = 100;
export const CATALOG_SEARCH_MAX_LENGTH = 100;

export const CATALOG_STOCK_FILTERS = ['all', 'in_stock', 'out_of_stock', 'low_stock'] as const;
export const CATALOG_SORTS = ['newest', 'oldest', 'updated'] as const;

export type CatalogStockFilter = (typeof CATALOG_STOCK_FILTERS)[number];
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export interface CatalogQuery {
  q?: string;
  vendorId?: string;
  status?: ProductStatus;
  categoryId?: string;
  stock: CatalogStockFilter;
  featured?: boolean;
  sort: CatalogSort;
  page: number;
  limit: number;
  includeSummary: boolean;
}

export interface CatalogQueryOptions {
  /** Admin only: filter by vendor and search the store name. */
  allowVendor: boolean;
  /** Admin only: featured placement filter. */
  allowFeatured: boolean;
}

/** Repeated query params (`?status=A&status=B`) use the first value. */
const single = (value: unknown): string => {
  if (Array.isArray(value)) return single(value[0]);
  return typeof value === 'string' ? value.trim() : '';
};

const positiveInt = (value: unknown, fallback: number, max?: number) => {
  const parsed = Number.parseInt(single(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
};

const oneOf = <T extends string>(value: string, allowed: readonly T[], label: string): T => {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new ValidationError(`Invalid ${label}. Must be one of: ${allowed.join(', ')}`);
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const optionalId = (value: unknown, label: string) => {
  const id = single(value);
  if (!id || id === 'all') return undefined;
  if (!ID_PATTERN.test(id)) throw new ValidationError(`Invalid ${label}`);
  return id;
};

/** Unknown params are ignored; malformed page/limit fall back to defaults; bad enum values are a 400. */
export const parseCatalogQuery = (query: Record<string, unknown>, options: CatalogQueryOptions): CatalogQuery => {
  const q = single(query.q).replace(/\s+/g, ' ').slice(0, CATALOG_SEARCH_MAX_LENGTH);

  const rawStatus = single(query.status).toUpperCase();
  const status = rawStatus && rawStatus !== 'ALL'
    ? oneOf(rawStatus, Object.values(ProductStatus), 'status')
    : undefined;

  const rawStock = single(query.stock).toLowerCase();
  const stock = rawStock ? oneOf(rawStock, CATALOG_STOCK_FILTERS, 'stock filter') : 'all';

  const rawSort = single(query.sort).toLowerCase();
  const sort = rawSort ? oneOf(rawSort, CATALOG_SORTS, 'sort') : 'newest';

  let featured: boolean | undefined;
  const rawFeatured = single(query.featured).toLowerCase();
  if (options.allowFeatured && rawFeatured && rawFeatured !== 'all') {
    if (rawFeatured !== 'true' && rawFeatured !== 'false') {
      throw new ValidationError('Invalid featured filter. Must be true or false');
    }
    featured = rawFeatured === 'true';
  }

  return {
    ...(q ? { q } : {}),
    ...(options.allowVendor ? { vendorId: optionalId(query.vendorId, 'vendorId') } : {}),
    status,
    categoryId: optionalId(query.categoryId, 'categoryId'),
    stock,
    featured,
    sort,
    page: positiveInt(query.page, 1),
    limit: positiveInt(query.limit, CATALOG_DEFAULT_LIMIT, CATALOG_MAX_LIMIT),
    includeSummary: single(query.includeSummary) === 'true',
  };
};

/** Same low-stock rule as merchant analytics: in stock and at or below the product's own threshold. */
const stockWhere = (stock: CatalogStockFilter): Prisma.ProductWhereInput | null => {
  switch (stock) {
    case 'in_stock':
      return { stock: { gt: 0 } };
    case 'out_of_stock':
      return { stock: { lte: 0 } };
    case 'low_stock':
      return { stock: { gt: 0, lte: prisma.product.fields.lowStockThreshold } };
    default:
      return null;
  }
};

/** Operational identity search (no relevance ranking): names, SKUs (product or variant), slug, id. */
const searchWhere = (q: string, includeVendor: boolean): Prisma.ProductWhereInput => ({
  OR: [
    { id: q },
    { name: { contains: q } },
    { nameAr: { contains: q } },
    { sku: { contains: q } },
    { slug: { contains: q } },
    { variants: { some: { sku: { contains: q } } } },
    ...(includeVendor
      ? [{ vendor: { storeName: { contains: q } } }, { vendor: { storeNameAr: { contains: q } } }]
      : []),
  ],
});

/**
 * `scope` is the caller's visibility (a vendor's own products, or everything for admins). A parent
 * category includes its subcategories, the same rule the storefront listing uses.
 */
export const buildCatalogWhere = async (
  scope: Prisma.ProductWhereInput,
  query: CatalogQuery,
  options: CatalogQueryOptions,
): Promise<Prisma.ProductWhereInput> => {
  const and: Prisma.ProductWhereInput[] = [scope];
  if (query.vendorId) and.push({ vendorId: query.vendorId });
  if (query.status) and.push({ status: query.status });
  if (query.featured !== undefined) and.push({ featured: query.featured });
  if (query.categoryId) {
    const categoryIds = getDescendantCategoryIds(await loadAllCategories(), [query.categoryId]);
    and.push({ categoryId: { in: categoryIds } });
  }
  const stock = stockWhere(query.stock);
  if (stock) and.push(stock);
  if (query.q) and.push(searchWhere(query.q, options.allowVendor));
  return { AND: and };
};

export const catalogOrderBy = (sort: CatalogSort): Prisma.ProductOrderByWithRelationInput[] => {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    case 'updated':
      return [{ updatedAt: 'desc' }, { id: 'desc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
};

export const catalogSelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  vendorId: true,
  name: true,
  nameAr: true,
  slug: true,
  sku: true,
  images: true,
  imageMetadata: true,
  price: true,
  discountPrice: true,
  stock: true,
  lowStockThreshold: true,
  hasVariants: true,
  status: true,
  featured: true,
  rejectionReason: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, nameAr: true, slug: true } },
  brand: { select: { id: true, name: true, nameAr: true } },
  _count: { select: { variants: true } },
});

export const adminCatalogSelect = Prisma.validator<Prisma.ProductSelect>()({
  ...catalogSelect,
  vendor: { select: { id: true, storeName: true, storeNameAr: true, slug: true, status: true } },
});

type CatalogRow = Prisma.ProductGetPayload<{ select: typeof catalogSelect }>;

/** Main image with its alt text only; legacy or malformed image JSON yields no image instead of an error. */
export const formatCatalogProduct = <T extends CatalogRow>(product: T) => {
  const { images, imageMetadata, _count, ...rest } = product;
  const gallery = parseStoredImages(images);
  const image = gallery[0] ?? null;
  const alt = image ? parseImageMetadata(imageMetadata).find((entry) => entry.url === image) : undefined;
  return {
    ...rest,
    image,
    imageAlt: alt?.altEn ?? null,
    imageAltAr: alt?.altAr ?? null,
    imageCount: gallery.length,
    variantCount: _count.variants,
  };
};

export interface CatalogSummary {
  total: number;
  live: number;
  pending: number;
  rejected: number;
  draft: number;
  inactive: number;
  outOfStock: number;
  lowStock: number;
}

/** Counts for the whole scope (not the current filters or page): one grouped query plus two stock counts. */
export const getCatalogSummary = async (scope: Prisma.ProductWhereInput): Promise<CatalogSummary> => {
  const [byStatus, outOfStock, lowStock] = await Promise.all([
    prisma.product.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    prisma.product.count({ where: { AND: [scope, stockWhere('out_of_stock')!] } }),
    prisma.product.count({ where: { AND: [scope, stockWhere('low_stock')!] } }),
  ]);
  const count = (statuses: ProductStatus[]) =>
    byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
  return {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    live: count(PUBLIC_PRODUCT_STATUSES),
    pending: count(['PENDING']),
    rejected: count(['REJECTED']),
    draft: count(['DRAFT']),
    inactive: count(['INACTIVE']),
    outOfStock,
    lowStock,
  };
};

export const catalogPagination = (query: CatalogQuery, total: number) => ({
  page: query.page,
  limit: query.limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / query.limit)),
});
