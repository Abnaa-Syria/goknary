import { buildDiscountPayload, calculateDiscountPrice } from '../../utils/discount';
import { parseImageMetadata } from '../../utils/imageAlt';

export type ProductType = 'SIMPLE' | 'VARIANTS';
export type StudioRole = 'vendor' | 'admin';
export type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

/** Mirrors the backend limit for image alt text and variant alt columns. */
export const IMAGE_ALT_MAX_LENGTH = 250;

export interface StudioImage {
  key: string;
  url: string | null;
  /** Object URL of the local file while it uploads. */
  previewUrl: string | null;
  status: 'ready' | 'uploading' | 'error';
  error?: string;
  altEn: string;
  altAr: string;
  /** Added in this session (alt text is required before publishing); legacy images only warn. */
  isNew: boolean;
}

export interface VariantAttributeInput {
  name: string;
  nameAr: string;
  value: string;
  valueAr: string;
}

export interface StudioVariant {
  /** Server id; undefined for variants that only exist locally in create mode. */
  id?: string;
  clientKey: string;
  name: string;
  nameAr: string;
  sku: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  image: string | null;
  imageAlt: string;
  imageAltAr: string;
  attributes: VariantAttributeInput[];
  isDefault: boolean;
  status: boolean;
}

export interface ProductFormState {
  name: string;
  nameAr: string;
  slug: string;
  description: string;
  descriptionAr: string;
  categoryId: string;
  brandId: string;
  price: string;
  discountType: '' | 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  stock: string;
  lowStockThreshold: string;
  featured: boolean;
}

export type FieldErrors = Record<string, string>;

export const EMPTY_FORM: ProductFormState = {
  name: '',
  nameAr: '',
  slug: '',
  description: '',
  descriptionAr: '',
  categoryId: '',
  brandId: '',
  price: '',
  discountType: '',
  discountValue: '',
  stock: '',
  lowStockThreshold: '5',
  featured: false,
};

let keySeq = 0;
export const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

export const slugify = (text: string): string =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(new RegExp('[^\\p{L}\\p{N}\\-_]+', 'gu'), '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

const isNonNegativeInteger = (value: string) => /^\d+$/.test(value.trim());

// ─── Images ──────────────────────────────────────────────────────────────────

export const imagesFromProduct = (images: string[], rawMetadata: unknown): StudioImage[] => {
  const metadata = parseImageMetadata(rawMetadata);
  return images.map((url) => {
    const entry = metadata.find((m) => m.url === url);
    return {
      key: nextKey('img'),
      url,
      previewUrl: null,
      status: 'ready' as const,
      altEn: entry?.altEn ?? '',
      altAr: entry?.altAr ?? '',
      isNew: false,
    };
  });
};

export const hasCompleteAlt = (image: StudioImage) => !!image.altEn.trim() && !!image.altAr.trim();

/** The ordered URL list plus alt metadata keyed by URL (the backend drops entries without any alt). */
export const buildImagePayload = (images: StudioImage[]) => {
  const ready = images.filter((image) => image.status === 'ready' && image.url);
  return {
    images: ready.map((image) => image.url as string),
    imageMetadata: ready.map((image) => ({
      url: image.url as string,
      altEn: image.altEn.trim(),
      altAr: image.altAr.trim(),
    })),
  };
};

export interface MediaCheck {
  error: string | null;
  /** New images without both alt texts: blocks publishing. */
  missingAltNew: string[];
  /** Existing images without both alt texts: warning only. */
  missingAltLegacy: string[];
}

export const checkMedia = (images: StudioImage[], t: Translate): MediaCheck => {
  const ready = images.filter((image) => image.status === 'ready' && image.url);
  let error: string | null = null;
  if (images.some((image) => image.status === 'uploading')) {
    error = t('productStudio.media.stillUploading', 'Wait for the images to finish uploading.');
  } else if (images.some((image) => image.status === 'error')) {
    error = t('productStudio.media.failedPending', 'Remove or retry the images that failed to upload.');
  } else if (ready.length === 0) {
    error = t('productStudio.media.required', 'Add at least one product image.');
  }
  return {
    error,
    missingAltNew: ready.filter((image) => image.isNew && !hasCompleteAlt(image)).map((image) => image.key),
    missingAltLegacy: ready.filter((image) => !image.isNew && !hasCompleteAlt(image)).map((image) => image.key),
  };
};

// ─── Pricing / inventory ─────────────────────────────────────────────────────

export const getSimpleDiscountPrice = (form: ProductFormState): number | null => {
  const price = parseFloat(form.price);
  const value = parseFloat(form.discountValue);
  if (!form.discountType || !(price > 0) || !(value > 0)) return null;
  const final = parseFloat(calculateDiscountPrice(price, form.discountType, value));
  return Number.isNaN(final) ? null : final;
};

export const validateBasics = (form: ProductFormState, t: Translate): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = t('productStudio.errors.nameRequired', 'Enter the product name in English.');
  if (!form.categoryId) errors.categoryId = t('productStudio.errors.categoryRequired', 'Choose a category.');
  return errors;
};

export const validateSimpleCommerce = (form: ProductFormState, t: Translate): FieldErrors => {
  const errors: FieldErrors = {};
  const price = parseFloat(form.price);
  if (!(price > 0)) errors.price = t('productStudio.errors.pricePositive', 'Price must be greater than 0.');
  if (form.discountType) {
    const value = parseFloat(form.discountValue);
    if (form.discountValue.trim() === '' || Number.isNaN(value) || value < 0) {
      errors.discountValue = t('productStudio.errors.discountValue', 'Discount value must be 0 or more.');
    } else if (form.discountType === 'PERCENTAGE' && value >= 100) {
      errors.discountValue = t('productStudio.errors.discountPercent', 'A percentage discount must be below 100%.');
    } else if (price > 0 && value > 0) {
      const final = getSimpleDiscountPrice(form);
      if (final == null || final <= 0 || final >= price) {
        errors.discountValue = t('productStudio.errors.discountBelowPrice', 'The discounted price must be above 0 and lower than the price.');
      }
    }
  }
  if (!isNonNegativeInteger(form.stock)) errors.stock = t('productStudio.errors.stockInteger', 'Stock must be a whole number of 0 or more.');
  if (!isNonNegativeInteger(form.lowStockThreshold)) {
    errors.lowStockThreshold = t('productStudio.errors.thresholdInteger', 'Low stock threshold must be a whole number of 0 or more.');
  }
  return errors;
};

export const simplePricingPayload = (form: ProductFormState) => {
  const discount = buildDiscountPayload({
    price: form.price,
    discountType: form.discountType,
    discountValue: form.discountValue,
    discountPrice: '',
  });
  return {
    price: parseFloat(form.price),
    ...discount,
    stock: parseInt(form.stock, 10),
  };
};

// ─── Variants ────────────────────────────────────────────────────────────────

/** Same rule as the backend: the active default variant, else the first active one. */
export const getDefaultVariant = (variants: StudioVariant[]) =>
  variants.find((v) => v.status && v.isDefault) ?? variants.find((v) => v.status) ?? null;

export const getVariantSummary = (variants: StudioVariant[]) => {
  const active = variants.filter((v) => v.status);
  return {
    defaultVariant: getDefaultVariant(variants),
    activeCount: active.length,
    totalStock: active.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
  };
};

/** Create mode keeps variants locally; mirror the backend rule of exactly one active default. */
export const withSingleDefault = (list: StudioVariant[], preferredKey?: string): StudioVariant[] => {
  const preferred = list.find((v) => v.clientKey === preferredKey && v.status && v.isDefault);
  const keep = preferred ?? list.find((v) => v.status && v.isDefault) ?? list.find((v) => v.status);
  return list.map((v) => ({ ...v, isDefault: !!keep && v.clientKey === keep.clientKey }));
};

export const variantFromApi = (raw: any): StudioVariant => ({
  id: raw.id,
  clientKey: raw.id ?? nextKey('var'),
  name: raw.name ?? '',
  nameAr: raw.nameAr ?? '',
  sku: raw.sku ?? '',
  price: Number(raw.price) || 0,
  discountPrice: raw.discountPrice != null ? Number(raw.discountPrice) : null,
  stock: Number(raw.stock) || 0,
  image: raw.image ?? null,
  imageAlt: raw.imageAlt ?? '',
  imageAltAr: raw.imageAltAr ?? '',
  attributes: Array.isArray(raw.attributes)
    ? raw.attributes.map((a: any) => ({
        name: a.name ?? '',
        nameAr: a.nameAr ?? '',
        value: a.value ?? '',
        valueAr: a.valueAr ?? '',
      }))
    : [],
  isDefault: !!raw.isDefault,
  status: raw.status !== false,
});

export interface VariantDraft {
  name: string;
  nameAr: string;
  sku: string;
  price: string;
  discountPrice: string;
  stock: string;
  image: string | null;
  imageAlt: string;
  imageAltAr: string;
  attributes: VariantAttributeInput[];
  isDefault: boolean;
  status: boolean;
}

export const emptyAttribute = (): VariantAttributeInput => ({ name: '', nameAr: '', value: '', valueAr: '' });

export const draftFromVariant = (variant: StudioVariant | null, isFirst: boolean): VariantDraft =>
  variant
    ? {
        name: variant.name,
        nameAr: variant.nameAr,
        sku: variant.sku,
        price: String(variant.price),
        discountPrice: variant.discountPrice != null ? String(variant.discountPrice) : '',
        stock: String(variant.stock),
        image: variant.image,
        imageAlt: variant.imageAlt,
        imageAltAr: variant.imageAltAr,
        attributes: variant.attributes.length ? variant.attributes.map((a) => ({ ...a })) : [emptyAttribute()],
        isDefault: variant.isDefault,
        status: variant.status,
      }
    : {
        name: '',
        nameAr: '',
        sku: '',
        price: '',
        discountPrice: '',
        stock: '0',
        image: null,
        imageAlt: '',
        imageAltAr: '',
        attributes: [emptyAttribute()],
        isDefault: isFirst,
        status: true,
      };

export const validateVariantDraft = (draft: VariantDraft, t: Translate): FieldErrors => {
  const errors: FieldErrors = {};
  if (!draft.name.trim()) errors.name = t('productStudio.variants.errors.name', 'Enter the variant name in English.');
  const complete = draft.attributes.filter((a) => a.name.trim() && a.value.trim());
  const partial = draft.attributes.some((a) => (a.name.trim() || a.value.trim() || a.nameAr.trim() || a.valueAr.trim()) && !(a.name.trim() && a.value.trim()));
  if (complete.length === 0) {
    errors.attributes = t('productStudio.variants.errors.attributes', 'Add at least one attribute with a name and a value.');
  } else if (partial) {
    errors.attributes = t('productStudio.variants.errors.attributePartial', 'Each attribute needs an English name and value.');
  }
  const price = parseFloat(draft.price);
  if (!(price > 0)) errors.price = t('productStudio.errors.pricePositive', 'Price must be greater than 0.');
  if (draft.discountPrice.trim() !== '') {
    const discount = parseFloat(draft.discountPrice);
    if (!(discount > 0) || (price > 0 && discount >= price)) {
      errors.discountPrice = t('productStudio.errors.discountBelowPrice', 'The discounted price must be above 0 and lower than the price.');
    }
  }
  if (!isNonNegativeInteger(draft.stock)) errors.stock = t('productStudio.errors.stockInteger', 'Stock must be a whole number of 0 or more.');
  if (draft.imageAlt.length > IMAGE_ALT_MAX_LENGTH || draft.imageAltAr.length > IMAGE_ALT_MAX_LENGTH) {
    errors.imageAlt = t('productStudio.media.altTooLong', 'Alt text can be at most {{max}} characters.', { max: IMAGE_ALT_MAX_LENGTH });
  }
  return errors;
};

/** Request body for the variant endpoints (and for inline variants in the create payload). */
export const variantPayload = (draft: VariantDraft | StudioVariant) => {
  const price = typeof draft.price === 'string' ? parseFloat(draft.price) : draft.price;
  const rawDiscount = draft.discountPrice;
  const discountPrice = rawDiscount === '' || rawDiscount == null ? null : Number(rawDiscount);
  return {
    name: draft.name.trim(),
    nameAr: draft.nameAr.trim(),
    sku: draft.sku.trim() || undefined,
    price,
    discountPrice,
    stock: typeof draft.stock === 'string' ? parseInt(draft.stock, 10) : draft.stock,
    image: draft.image || null,
    imageAlt: draft.imageAlt.trim() || null,
    imageAltAr: draft.imageAltAr.trim() || null,
    attributes: draft.attributes
      .filter((a) => a.name.trim() && a.value.trim())
      .map((a) => ({
        name: a.name.trim(),
        value: a.value.trim(),
        ...(a.nameAr.trim() ? { nameAr: a.nameAr.trim() } : {}),
        ...(a.valueAr.trim() ? { valueAr: a.valueAr.trim() } : {}),
      })),
    isDefault: draft.isDefault && draft.status,
    status: draft.status,
  };
};

export const studioVariantFromDraft = (draft: VariantDraft, base?: StudioVariant): StudioVariant => {
  const payload = variantPayload(draft);
  return {
    id: base?.id,
    clientKey: base?.clientKey ?? nextKey('var'),
    name: payload.name,
    nameAr: payload.nameAr,
    sku: payload.sku ?? '',
    price: payload.price,
    discountPrice: payload.discountPrice,
    stock: payload.stock,
    image: payload.image,
    imageAlt: payload.imageAlt ?? '',
    imageAltAr: payload.imageAltAr ?? '',
    attributes: draft.attributes
      .filter((a) => a.name.trim() && a.value.trim())
      .map((a) => ({ name: a.name.trim(), nameAr: a.nameAr.trim(), value: a.value.trim(), valueAr: a.valueAr.trim() })),
    isDefault: payload.isDefault,
    status: payload.status,
  };
};

// ─── Server errors ───────────────────────────────────────────────────────────

export interface ServerErrorMapping {
  fieldErrors: FieldErrors;
  /** Errors for inline create-mode variants, by list index. */
  variantErrors: Record<number, string>;
  messages: string[];
}

/** Maps the backend `{ error, details: [{ path, message }] }` contract onto form fields. */
export const mapServerErrors = (error: any, fallback: string): ServerErrorMapping => {
  const data = error?.response?.data;
  const summary = typeof data?.error === 'string' && data.error ? data.error : fallback;
  const fieldErrors: FieldErrors = {};
  const variantErrors: Record<number, string> = {};
  const messages: string[] = [summary];
  const details = Array.isArray(data?.details) ? data.details : [];
  details.forEach((detail: any) => {
    if (!detail || typeof detail.message !== 'string') return;
    const path: Array<string | number> = Array.isArray(detail.path) ? detail.path : detail.path ? [detail.path] : [];
    const [head, index] = path;
    if (head === 'variants') {
      if (typeof index === 'number') variantErrors[index] = detail.message;
      else fieldErrors.variants = detail.message;
    } else if (head === 'imageMetadata') {
      fieldErrors.images = detail.message;
    } else if (typeof head === 'string') {
      fieldErrors[head] = detail.message;
    }
    if (detail.message !== summary) messages.push(path.length ? `${path.join('.')}: ${detail.message}` : detail.message);
  });
  return { fieldErrors, variantErrors, messages };
};
