/**
 * Shared Product Catalog logic for the admin and vendor catalogs: list types, URL state and the
 * status → action rules. Action rules mirror the backend transitions in lib/product-moderation.ts,
 * so the UI never offers a change the server would refuse.
 */

export type ProductStatus = 'DRAFT' | 'PENDING' | 'REJECTED' | 'ACTIVE' | 'APPROVED' | 'INACTIVE';

export const PRODUCT_STATUSES: ProductStatus[] = ['DRAFT', 'PENDING', 'REJECTED', 'ACTIVE', 'APPROVED', 'INACTIVE'];
export const STOCK_FILTERS = ['in_stock', 'low_stock', 'out_of_stock'] as const;
export const CATALOG_SORTS = ['newest', 'oldest', 'updated'] as const;
export const CATALOG_PAGE_SIZE = 20;

export type StockFilter = (typeof STOCK_FILTERS)[number];
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export interface CatalogProduct {
  id: string;
  vendorId: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  sku: string;
  image: string | null;
  imageAlt?: string | null;
  imageAltAr?: string | null;
  price: number;
  discountPrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  variantCount: number;
  status: ProductStatus;
  featured: boolean;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; nameAr?: string | null } | null;
  brand?: { id: string; name: string; nameAr?: string | null } | null;
  vendor?: { id: string; storeName: string; storeNameAr?: string | null; slug: string; status: string } | null;
}

export interface CatalogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

export interface CatalogFilters {
  q: string;
  vendorId: string;
  status: string;
  categoryId: string;
  stock: string;
  featured: string;
  sort: CatalogSort;
  page: number;
}

export type CatalogFilterKey = 'vendorId' | 'status' | 'categoryId' | 'stock' | 'featured';

const FILTER_KEYS: CatalogFilterKey[] = ['vendorId', 'status', 'categoryId', 'stock', 'featured'];

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | '' =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : '';

/** Reads catalog state from the URL; unknown values are dropped instead of reaching the API. */
export const filtersFromSearchParams = (params: URLSearchParams, allowed: CatalogFilterKey[]): CatalogFilters => {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const has = (key: CatalogFilterKey) => allowed.includes(key);
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    vendorId: has('vendorId') ? params.get('vendorId') ?? '' : '',
    status: has('status') ? oneOf(params.get('status'), PRODUCT_STATUSES) : '',
    categoryId: has('categoryId') ? params.get('categoryId') ?? '' : '',
    stock: has('stock') ? oneOf(params.get('stock'), STOCK_FILTERS) : '',
    featured: has('featured') ? oneOf(params.get('featured'), ['true', 'false'] as const) : '',
    sort: oneOf(params.get('sort'), CATALOG_SORTS) || 'newest',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
};

/** Only non-default values go into the URL, so a clean catalog has a clean address. */
export const filtersToSearchParams = (filters: CatalogFilters): URLSearchParams => {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set('q', q);
  FILTER_KEYS.forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
};

/** Query params for the list endpoint (same names as the URL, plus the page size). */
export const filtersToApiParams = (filters: CatalogFilters, limit = CATALOG_PAGE_SIZE) => {
  const params: Record<string, string | number> = { page: filters.page, limit, sort: filters.sort };
  const q = filters.q.trim();
  if (q) params.q = q;
  FILTER_KEYS.forEach((key) => {
    if (filters[key]) params[key] = filters[key];
  });
  return params;
};

export const countActiveFilters = (filters: CatalogFilters) =>
  FILTER_KEYS.filter((key) => !!filters[key]).length + (filters.q.trim() ? 1 : 0);

export const isLiveStatus = (status: string) => status === 'ACTIVE' || status === 'APPROVED';

export type InventoryState = 'in_stock' | 'low_stock' | 'out_of_stock';

/** Same rule as the backend stock filter: low stock is in stock and at or below the product's own threshold. */
export const getInventoryState = (product: Pick<CatalogProduct, 'stock' | 'lowStockThreshold'>): InventoryState => {
  if (product.stock <= 0) return 'out_of_stock';
  if (product.stock <= product.lowStockThreshold) return 'low_stock';
  return 'in_stock';
};

export const hasCatalogDiscount = (product: Pick<CatalogProduct, 'price' | 'discountPrice'>) =>
  product.discountPrice != null && product.discountPrice > 0 && product.discountPrice < product.price;

export const getLocalizedProductName = (product: Pick<CatalogProduct, 'name' | 'nameAr'>, isArabic: boolean) =>
  (isArabic && product.nameAr?.trim()) || product.name;

/** Catalog thumbnail alt: the image's alt in the current language, else the localized product name. */
export const getCatalogImageAlt = (product: CatalogProduct, isArabic: boolean) =>
  (isArabic ? product.imageAltAr : product.imageAlt)?.trim() || getLocalizedProductName(product, isArabic);

export type CatalogActionId =
  | 'preview'
  | 'viewInStore'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'submit'
  | 'resubmit'
  | 'returnToDraft'
  | 'hide'
  | 'republish'
  | 'sendForReview'
  | 'feature'
  | 'unfeature'
  | 'delete';

export interface AdminCapabilities {
  canUpdate: boolean;
  canDelete: boolean;
}

/** Admin/staff actions; the first entries are shown as buttons, the rest go into the row menu. */
export const getAdminActions = (product: Pick<CatalogProduct, 'status' | 'featured'>, caps: AdminCapabilities): CatalogActionId[] => {
  const actions: CatalogActionId[] = [];
  if (product.status === 'PENDING' && caps.canUpdate) actions.push('approve', 'reject');
  actions.push('preview');
  if (caps.canUpdate) {
    actions.push('edit');
    if (isLiveStatus(product.status)) actions.push('hide');
    if (product.status === 'INACTIVE') actions.push('republish');
    actions.push(product.featured ? 'unfeature' : 'feature');
  }
  if (caps.canDelete) actions.push('delete');
  return actions;
};

/** Vendor actions follow the vendor lifecycle; publishing always goes through review. */
export const getVendorActions = (product: Pick<CatalogProduct, 'status'>): CatalogActionId[] => {
  switch (product.status) {
    case 'DRAFT':
      return ['submit', 'preview', 'edit', 'delete'];
    case 'PENDING':
      return ['preview', 'edit', 'returnToDraft', 'delete'];
    case 'REJECTED':
      return ['resubmit', 'preview', 'edit', 'delete'];
    case 'ACTIVE':
    case 'APPROVED':
      return ['edit', 'viewInStore', 'hide', 'delete'];
    case 'INACTIVE':
      return ['sendForReview', 'preview', 'edit', 'delete'];
    default:
      return ['edit'];
  }
};

export const DESTRUCTIVE_ACTIONS: CatalogActionId[] = ['reject', 'hide', 'delete'];

/** Backend `errorAr` is shown in Arabic; otherwise `error`, then the caller's fallback. */
export const getApiErrorMessage = (error: any, isArabic: boolean, fallback: string): string => {
  const data = error?.response?.data;
  return (isArabic && data?.errorAr) || data?.error || data?.message || fallback;
};
