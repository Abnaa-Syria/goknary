export interface ProductImageMeta {
  url: string;
  altEn?: string;
  altAr?: string;
}

interface NamedEntity {
  name?: string | null;
  nameAr?: string | null;
}

interface ProductWithImageMeta extends NamedEntity {
  imageMetadata?: string | ProductImageMeta[] | null;
}

interface VariantWithImageAlt extends NamedEntity {
  imageAlt?: string | null;
  imageAltAr?: string | null;
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** `Product.imageMetadata` arrives as a JSON string (or NULL for legacy products); unreadable data means "no alt". */
export const parseImageMetadata = (raw: unknown): ProductImageMeta[] => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.url === 'string' && entry.url)
    .map((entry) => ({ url: entry.url, altEn: clean(entry.altEn), altAr: clean(entry.altAr) }));
};

const localizedName = (entity: NamedEntity | null | undefined, isArabic: boolean): string => {
  if (!entity) return '';
  const primary = isArabic ? clean(entity.nameAr) : clean(entity.name);
  return primary || (isArabic ? clean(entity.name) : clean(entity.nameAr));
};

/** Image alt for the given locale → localized product name → other-language product name. */
export const getProductImageAlt = (
  product: ProductWithImageMeta | null | undefined,
  url: string | null | undefined,
  isArabic: boolean,
): string => {
  const entry = url ? parseImageMetadata(product?.imageMetadata).find((m) => m.url === url) : undefined;
  const alt = isArabic ? entry?.altAr : entry?.altEn;
  return alt || localizedName(product, isArabic);
};

/** Variant image alt for the locale → localized variant name → localized product name. */
export const getVariantImageAlt = (
  variant: VariantWithImageAlt | null | undefined,
  product: NamedEntity | null | undefined,
  isArabic: boolean,
): string => {
  const alt = isArabic ? clean(variant?.imageAltAr) : clean(variant?.imageAlt);
  if (alt) return alt;
  const variantName = isArabic ? clean(variant?.nameAr) || clean(variant?.name) : clean(variant?.name);
  return variantName || localizedName(product, isArabic);
};
