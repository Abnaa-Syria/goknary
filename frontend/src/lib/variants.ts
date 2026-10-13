export interface VariantAttribute {
  name: string;
  nameAr?: string;
  value: string;
  valueAr?: string;
}

/** Purchase-time variant snapshot stored on order items (`OrderItem.variantInfo`). */
export interface VariantSnapshot {
  variantId?: string;
  sku?: string;
  name?: string;
  nameAr?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  imageAltAr?: string | null;
  attributeList: VariantAttribute[];
}

const toAttributeList = (raw: unknown): VariantAttribute[] => {
  if (Array.isArray(raw)) {
    return raw
      .filter((a) => a && typeof a === 'object' && a.name != null && a.value != null)
      .map((a) => ({
        name: String(a.name),
        value: String(a.value),
        nameAr: a.nameAr ? String(a.nameAr) : undefined,
        valueAr: a.valueAr ? String(a.valueAr) : undefined,
      }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v != null && typeof v !== 'object')
      .map(([name, v]) => ({ name, value: String(v) }));
  }
  return [];
};

export const parseVariantAttributes = (raw: unknown): VariantAttribute[] => {
  if (typeof raw === 'string') {
    try {
      return toAttributeList(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return toAttributeList(raw);
};

/** Returns null for orders placed before variants were snapshotted, or for malformed data. */
export const parseVariantSnapshot = (raw: unknown): VariantSnapshot | null => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const v = value as Record<string, any>;
  const attributeList = parseVariantAttributes(v.attributeList ?? v.attributes);
  if (!v.variantId && !v.sku && !v.name && attributeList.length === 0) return null;

  return {
    variantId: v.variantId,
    sku: v.sku,
    name: v.name,
    nameAr: v.nameAr,
    image: v.image,
    imageAlt: v.imageAlt,
    imageAltAr: v.imageAltAr,
    attributeList,
  };
};

/** Localized variant name, falling back to the other language. */
export const getLocalizedVariantName = (
  variant: { name?: string | null; nameAr?: string | null } | null | undefined,
  isRTL: boolean
): string => {
  if (!variant) return '';
  const primary = (isRTL ? variant.nameAr : variant.name)?.trim();
  return primary || (isRTL ? variant.name : variant.nameAr)?.trim() || '';
};

/** Localized attribute name/value pairs, falling back to English where Arabic is missing. */
export const getLocalizedVariantAttributes = (attributes: VariantAttribute[], isRTL: boolean) =>
  attributes.map((a) => ({
    name: (isRTL && a.nameAr?.trim()) || a.name,
    value: (isRTL && a.valueAr?.trim()) || a.value,
  }));

export const formatVariantAttributes = (attributes: VariantAttribute[], isRTL: boolean): string =>
  attributes
    .map((a) => {
      const name = isRTL && a.nameAr ? a.nameAr : a.name;
      const value = isRTL && a.valueAr ? a.valueAr : a.value;
      return `${name}: ${value}`;
    })
    .join(' · ');

/** Human-readable label for a variant: its attributes, or its name when it has none. */
export const getVariantLabel = (
  variant: { name?: string; nameAr?: string | null; attributes?: unknown; attributeList?: VariantAttribute[] } | null | undefined,
  isRTL: boolean
): string => {
  if (!variant) return '';
  const attributes = variant.attributeList ?? parseVariantAttributes(variant.attributes);
  if (attributes.length > 0) return formatVariantAttributes(attributes, isRTL);
  return (isRTL && variant.nameAr ? variant.nameAr : variant.name) || '';
};
