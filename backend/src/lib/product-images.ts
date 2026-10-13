import { z } from 'zod';

export const IMAGE_ALT_MAX_LENGTH = 250;

export interface ProductImageMeta {
  url: string;
  altEn?: string;
  altAr?: string;
}

const altText = z.string().trim().max(IMAGE_ALT_MAX_LENGTH).optional().nullable();

export const imageMetadataSchema = z.array(z.object({
  url: z.string().min(1),
  altEn: altText,
  altAr: altText,
}));

/** Variant alt fields: blank strings are stored as NULL so the storefront falls back to names. */
export const variantAltSchema = altText.transform((value) => (value === undefined ? undefined : value || null));

/** `Product.images` as stored (JSON URL list); malformed values yield an empty gallery. */
export const parseStoredImages = (raw: unknown): string[] => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string' && !!url) : [];
};

/** Tolerates NULL, legacy rows and malformed JSON: anything unreadable means "no alt text". */
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
    .map((entry) => ({
      url: entry.url,
      ...(typeof entry.altEn === 'string' && entry.altEn.trim() ? { altEn: entry.altEn.trim() } : {}),
      ...(typeof entry.altAr === 'string' && entry.altAr.trim() ? { altAr: entry.altAr.trim() } : {}),
    }));
};

/**
 * Keeps one entry per URL that is still in the gallery and drops entries without any alt text.
 * Metadata is keyed by URL, so reordering `images` never moves alt text to another image.
 */
export const serializeImageMetadata = (images: string[], entries: unknown): string | null => {
  const urls = new Set(images);
  const seen = new Set<string>();
  const kept = parseImageMetadata(entries).filter((entry) => {
    if (!urls.has(entry.url) || seen.has(entry.url) || (!entry.altEn && !entry.altAr)) return false;
    seen.add(entry.url);
    return true;
  });
  return kept.length ? JSON.stringify(kept) : null;
};
