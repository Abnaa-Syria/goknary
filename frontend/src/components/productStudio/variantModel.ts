import { StudioVariant, VariantAttributeInput, nextKey, withSingleDefault } from './studioModel';

// ─── Naming ──────────────────────────────────────────────────────────────────

const completeAttributes = (attributes: VariantAttributeInput[]) =>
  attributes.filter((a) => a.name.trim() && a.value.trim());

/** "256 GB / Black" from the attribute values; Arabic uses Arabic values where given. */
export const suggestVariantName = (attributes: VariantAttributeInput[]) => {
  const complete = completeAttributes(attributes);
  return {
    name: complete.map((a) => a.value.trim()).join(' / '),
    nameAr: complete.map((a) => a.valueAr.trim() || a.value.trim()).join(' / '),
  };
};

// ─── Duplicate combinations ──────────────────────────────────────────────────

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/** Order-insensitive key for a set of attribute pairs (English name + value). */
export const attributeSignature = (attributes: VariantAttributeInput[]) =>
  completeAttributes(attributes)
    .map((a) => `${normalize(a.name)}=${normalize(a.value)}`)
    .sort()
    .join('|');

export const findDuplicateCombination = (
  variants: StudioVariant[],
  attributes: VariantAttributeInput[],
  excludeKey?: string,
) => {
  const signature = attributeSignature(attributes);
  if (!signature) return null;
  return variants.find((v) => v.clientKey !== excludeKey && attributeSignature(v.attributes) === signature) ?? null;
};

// ─── Availability, filters ───────────────────────────────────────────────────

export type VariantAvailability = 'available' | 'outOfStock' | 'inactive';

export const getVariantAvailability = (variant: Pick<StudioVariant, 'status' | 'stock'>): VariantAvailability => {
  if (!variant.status) return 'inactive';
  return variant.stock > 0 ? 'available' : 'outOfStock';
};

export interface VariantFilters {
  query: string;
  status: 'all' | 'active' | 'inactive';
  stock: 'all' | 'inStock' | 'outOfStock';
  defaultOnly: boolean;
}

export const EMPTY_VARIANT_FILTERS: VariantFilters = { query: '', status: 'all', stock: 'all', defaultOnly: false };

export const hasActiveFilters = (filters: VariantFilters) =>
  !!filters.query.trim() || filters.status !== 'all' || filters.stock !== 'all' || filters.defaultOnly;

export const filterVariants = (variants: StudioVariant[], filters: VariantFilters) => {
  const query = normalize(filters.query);
  return variants.filter((v) => {
    if (query) {
      const haystack = [v.name, v.nameAr, v.sku, ...v.attributes.flatMap((a) => [a.value, a.valueAr])].map(normalize).join(' ');
      if (!haystack.includes(query)) return false;
    }
    if (filters.status === 'active' && !v.status) return false;
    if (filters.status === 'inactive' && v.status) return false;
    if (filters.stock === 'inStock' && !(v.stock > 0)) return false;
    if (filters.stock === 'outOfStock' && v.stock > 0) return false;
    if (filters.defaultOnly && !(v.status && v.isDefault)) return false;
    return true;
  });
};

// ─── Generator ───────────────────────────────────────────────────────────────

export interface GeneratorValue {
  key: string;
  value: string;
  valueAr: string;
}

export interface GeneratorDimension {
  key: string;
  name: string;
  nameAr: string;
  values: GeneratorValue[];
}

/** Above this many combinations the generator asks for explicit confirmation (UX guard, not a business rule). */
export const GENERATOR_CONFIRM_THRESHOLD = 50;

export const emptyDimension = (): GeneratorDimension => ({ key: nextKey('dim'), name: '', nameAr: '', values: [] });

export const generatorValue = (value: string, valueAr = ''): GeneratorValue => ({ key: nextKey('val'), value: value.trim(), valueAr: valueAr.trim() });

/** Dimensions that take part in generation: a name and at least one value. */
export const usableDimensions = (dimensions: GeneratorDimension[]) =>
  dimensions.filter((d) => d.name.trim() && d.values.some((v) => v.value.trim()));

/** Product of the value counts, computed without building the combinations. */
export const countCombinations = (dimensions: GeneratorDimension[]) => {
  const usable = usableDimensions(dimensions);
  if (usable.length === 0) return 0;
  return usable.reduce((total, d) => total * d.values.filter((v) => v.value.trim()).length, 1);
};

/** Cartesian product; the first dimension varies slowest (64 GB/Black, 64 GB/Silver, 128 GB/Black, …). */
export const generateCombinations = (dimensions: GeneratorDimension[]): VariantAttributeInput[][] => {
  const usable = usableDimensions(dimensions);
  if (usable.length === 0) return [];
  return usable.reduce<VariantAttributeInput[][]>(
    (combos, dimension) => combos.flatMap((combo) => dimension.values
      .filter((v) => v.value.trim())
      .map((v) => [...combo, {
        name: dimension.name.trim(),
        nameAr: dimension.nameAr.trim(),
        value: v.value.trim(),
        valueAr: v.valueAr.trim(),
      }])),
    [[]],
  );
};

export interface GeneratedPlan {
  variants: StudioVariant[];
  /** Combinations skipped because an existing variant already has them. */
  skipped: number;
}

/**
 * Turns combinations into variants (price shared, stock as given, active, no discount, no image, SKU left for
 * the backend). Combinations that already exist are skipped. If the product has no active default yet, the
 * first generated variant becomes the default.
 */
export const planGeneratedVariants = (
  combinations: VariantAttributeInput[][],
  existing: StudioVariant[],
  shared: { price: number; stock: number },
): GeneratedPlan => {
  const taken = new Set(existing.map((v) => attributeSignature(v.attributes)).filter(Boolean));
  const variants: StudioVariant[] = [];
  let skipped = 0;
  combinations.forEach((attributes) => {
    const signature = attributeSignature(attributes);
    if (taken.has(signature)) {
      skipped += 1;
      return;
    }
    taken.add(signature);
    const { name, nameAr } = suggestVariantName(attributes);
    variants.push({
      id: undefined,
      clientKey: nextKey('var'),
      name,
      nameAr,
      sku: '',
      price: shared.price,
      discountPrice: null,
      stock: shared.stock,
      image: null,
      imageAlt: '',
      imageAltAr: '',
      attributes,
      isDefault: false,
      status: true,
    });
  });
  const hasDefault = existing.some((v) => v.status && v.isDefault);
  if (!hasDefault && variants.length > 0) variants[0] = { ...variants[0], isDefault: true };
  return { variants, skipped };
};

/** Local (create-mode) merge that keeps exactly one active default. */
export const mergeGenerated = (existing: StudioVariant[], generated: StudioVariant[]) =>
  withSingleDefault([...existing, ...generated]);
