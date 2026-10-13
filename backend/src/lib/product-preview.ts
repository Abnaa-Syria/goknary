import { Prisma } from '@prisma/client';
import { formatVariantForResponse } from './variants';
import { parseStoredImages } from './product-images';
import { getCategoryAncestors, loadAllCategories } from './category-tree';

/** The vendor fields the customer product page shows (name, store link, policies), plus the account status. */
export const previewVendorSelect = {
  id: true,
  storeName: true,
  storeNameAr: true,
  slug: true,
  rating: true,
  status: true,
  returnPolicy: true,
  returnPolicyAr: true,
  shippingPolicy: true,
  shippingPolicyAr: true,
  exchangePolicy: true,
  exchangePolicyAr: true,
  returnWindowDays: true,
} satisfies Prisma.VendorSelect;

export const previewCategorySelect = { id: true, name: true, nameAr: true, slug: true } satisfies Prisma.CategorySelect;
export const previewBrandSelect = { id: true, name: true, nameAr: true, slug: true } satisfies Prisma.BrandSelect;

/**
 * Customer-shaped product for authenticated previews of any status. `activeVariantsOnly` matches the
 * public product endpoint (inactive variants are never customer choices).
 */
export const previewProductInclude = (activeVariantsOnly: boolean) =>
  ({
    vendor: { select: previewVendorSelect },
    category: { select: previewCategorySelect },
    brand: { select: previewBrandSelect },
    variants: activeVariantsOnly
      ? { where: { status: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }
      : { orderBy: { createdAt: 'asc' } },
  }) satisfies Prisma.ProductInclude;

type PreviewRow = Prisma.ProductGetPayload<{ include: ReturnType<typeof previewProductInclude> }>;

/** Fields that are internal to moderation and ranking; vendors and customers never receive them. */
const INTERNAL_FIELDS = ['reviewedBy', 'rankingScore', 'rankingUpdatedAt', 'lowStockThreshold'] as const;

export const formatPreviewProduct = async (product: PreviewRow, options: { keepInternal?: boolean } = {}) => {
  const ancestors = getCategoryAncestors(await loadAllCategories(), product.categoryId)
    .map(({ id, name, nameAr, slug }) => ({ id, name, nameAr, slug }));
  const base: Record<string, unknown> = { ...product };
  if (!options.keepInternal) INTERNAL_FIELDS.forEach((field) => delete base[field]);
  return {
    ...base,
    images: parseStoredImages(product.images),
    category: product.category ? { ...product.category, ancestors } : null,
    variants: product.variants.map(formatVariantForResponse),
  };
};
