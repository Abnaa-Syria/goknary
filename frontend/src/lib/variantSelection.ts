import { VariantAttribute, parseVariantAttributes } from './variants';

/** Customer-facing variant as returned by the public product endpoint (attributes already parsed). */
export interface CustomerVariant {
  id: string;
  name: string;
  nameAr?: string | null;
  price: number;
  discountPrice?: number | null;
  stock: number;
  status?: boolean;
  isDefault?: boolean;
  image?: string | null;
  imageAlt?: string | null;
  imageAltAr?: string | null;
  attributes?: unknown;
  createdAt?: string;
}

export interface OptionValue {
  key: string;
  value: string;
  valueAr?: string;
}

export interface OptionGroup {
  key: string;
  name: string;
  nameAr?: string;
  values: OptionValue[];
}

/**
 * `attributes`: every active variant has the same set of attribute names and a unique combination,
 * so values can be offered per attribute. `list`: anything irregular; each variant is one choice.
 */
export type VariantMatrix =
  | { mode: 'attributes'; groups: OptionGroup[]; valuesByVariant: Map<string, Record<string, string>> }
  | { mode: 'list'; groups: []; valuesByVariant: Map<string, Record<string, string>> };

/** Comparison key only; stored data is never changed. */
export const normalizeOptionText = (text: string | null | undefined) =>
  (text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const attributeKey = (a: VariantAttribute) => normalizeOptionText(a.name) || normalizeOptionText(a.nameAr);
const valueKey = (a: VariantAttribute) => normalizeOptionText(a.value) || normalizeOptionText(a.valueAr);

export const isPurchasableVariant = (v: CustomerVariant | null | undefined): v is CustomerVariant =>
  !!v && v.status !== false && v.stock > 0;

/** Inactive variants are never customer choices; the public API already filters them, this is a second guard. */
export const getActiveVariants = (variants: CustomerVariant[] | null | undefined): CustomerVariant[] =>
  (variants ?? []).filter((v) => v && v.status !== false);

/** Active default, or the first active variant for legacy data without one. Never skips a default for being out of stock. */
export const pickInitialVariant = (variants: CustomerVariant[]): CustomerVariant | null =>
  variants.find((v) => v.isDefault) ?? variants[0] ?? null;

/** Seller creation order, so values appear in the order the seller entered them. */
const byCreation = (variants: CustomerVariant[]) =>
  variants
    .map((v, index) => ({ v, index }))
    .sort((a, b) => {
      const ta = a.v.createdAt ? Date.parse(a.v.createdAt) : NaN;
      const tb = b.v.createdAt ? Date.parse(b.v.createdAt) : NaN;
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
      return a.index - b.index;
    })
    .map(({ v }) => v);

export const buildVariantMatrix = (variants: CustomerVariant[]): VariantMatrix => {
  const list: VariantMatrix = { mode: 'list', groups: [], valuesByVariant: new Map() };
  if (variants.length === 0) return list;

  const ordered = byCreation(variants);
  const groups = new Map<string, OptionGroup>();
  const valuesByVariant = new Map<string, Record<string, string>>();
  const signatures = new Set<string>();
  let expectedKeys: string | null = null;

  for (const variant of ordered) {
    const attributes = parseVariantAttributes(variant.attributes);
    const selection: Record<string, string> = {};
    for (const attribute of attributes) {
      const aKey = attributeKey(attribute);
      const vKey = valueKey(attribute);
      if (!aKey || !vKey || aKey in selection) return list;
      selection[aKey] = vKey;

      let group = groups.get(aKey);
      if (!group) {
        group = { key: aKey, name: attribute.name.trim() || (attribute.nameAr ?? '').trim(), values: [] };
        groups.set(aKey, group);
      }
      if (!group.nameAr && attribute.nameAr?.trim()) group.nameAr = attribute.nameAr.trim();
      let option = group.values.find((o) => o.key === vKey);
      if (!option) {
        option = { key: vKey, value: attribute.value.trim() || (attribute.valueAr ?? '').trim() };
        group.values.push(option);
      }
      if (!option.valueAr && attribute.valueAr?.trim()) option.valueAr = attribute.valueAr.trim();
    }

    const keys = Object.keys(selection).sort().join('|');
    if (!keys) return list;
    if (expectedKeys === null) expectedKeys = keys;
    else if (keys !== expectedKeys) return list;

    const signature = Object.keys(selection).sort().map((k) => `${k}=${selection[k]}`).join('|');
    if (signatures.has(signature)) return list;
    signatures.add(signature);
    valuesByVariant.set(variant.id, selection);
  }

  // Group order follows the default variant's attribute order (what the seller considers primary).
  const reference = pickInitialVariant(variants) ?? ordered[0];
  const order = parseVariantAttributes(reference.attributes).map(attributeKey);
  const sortedGroups = Array.from(groups.values()).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return { mode: 'attributes', groups: sortedGroups, valuesByVariant };
};

export type OptionState =
  /** A real variant exists for this value together with every other current choice. */
  | 'available'
  /** That exact variant exists but has no stock. */
  | 'outOfStock'
  /** No variant combines this value with the other current choices; choosing it switches to a real one. */
  | 'unavailableWithSelection';

export const getOptionState = (
  matrix: VariantMatrix,
  variants: CustomerVariant[],
  selected: CustomerVariant | null,
  groupKey: string,
  value: string,
): OptionState => {
  const current = selected ? matrix.valuesByVariant.get(selected.id) ?? {} : {};
  const exact = variants.find((v) => {
    const values = matrix.valuesByVariant.get(v.id);
    if (!values || values[groupKey] !== value) return false;
    return Object.keys(values).every((k) => k === groupKey || values[k] === current[k]);
  });
  if (!exact) return 'unavailableWithSelection';
  return exact.stock > 0 ? 'available' : 'outOfStock';
};

const compareScores = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};

/**
 * The real variant to select when the customer picks `value` for `groupKey`.
 * Deterministic: keep as many current choices as possible (earlier attributes weigh more on ties),
 * then prefer in-stock, then the default, then seller order. Returns null only if no variant has the value.
 */
export const resolveOptionChoice = (
  matrix: VariantMatrix,
  variants: CustomerVariant[],
  selected: CustomerVariant | null,
  groupKey: string,
  value: string,
): CustomerVariant | null => {
  const current = selected ? matrix.valuesByVariant.get(selected.id) ?? {} : {};
  const otherGroups = matrix.groups.map((g) => g.key).filter((k) => k !== groupKey);
  const ordered = byCreation(variants);

  let best: CustomerVariant | null = null;
  let bestScore: number[] = [];
  for (const variant of ordered) {
    const values = matrix.valuesByVariant.get(variant.id);
    if (!values || values[groupKey] !== value) continue;
    const matches = otherGroups.map((k) => (values[k] === current[k] ? 1 : 0));
    const score = [
      matches.reduce<number>((sum, m) => sum + m, 0),
      ...matches,
      variant.stock > 0 ? 1 : 0,
      variant.isDefault ? 1 : 0,
    ];
    if (!best || compareScores(score, bestScore) > 0) {
      best = variant;
      bestScore = score;
    }
  }
  return best;
};

// ─── Localized display ───────────────────────────────────────────────────────

const pick = (en: string | null | undefined, ar: string | null | undefined, isRTL: boolean) => {
  const primary = (isRTL ? ar : en)?.trim();
  return primary || (isRTL ? en : ar)?.trim() || '';
};

export const getLocalizedOptionName = (group: Pick<OptionGroup, 'name' | 'nameAr'>, isRTL: boolean) =>
  pick(group.name, group.nameAr, isRTL);

export const getLocalizedOptionValue = (option: Pick<OptionValue, 'value' | 'valueAr'>, isRTL: boolean) =>
  pick(option.value, option.valueAr, isRTL);
