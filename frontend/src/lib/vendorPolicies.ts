export interface VendorPolicyFields {
  returnPolicy?: string | null;
  returnPolicyAr?: string | null;
  shippingPolicy?: string | null;
  shippingPolicyAr?: string | null;
  exchangePolicy?: string | null;
  exchangePolicyAr?: string | null;
  returnWindowDays?: number | null;
}

export type PolicyKind = 'return' | 'shipping' | 'exchange';

export const POLICY_KINDS: PolicyKind[] = ['return', 'shipping', 'exchange'];
export const POLICY_MAX_LENGTH = 5000;
export const RETURN_WINDOW_MAX_DAYS = 365;

const FIELD: Record<PolicyKind, { en: keyof VendorPolicyFields; ar: keyof VendorPolicyFields }> = {
  return: { en: 'returnPolicy', ar: 'returnPolicyAr' },
  shipping: { en: 'shippingPolicy', ar: 'shippingPolicyAr' },
  exchange: { en: 'exchangePolicy', ar: 'exchangePolicyAr' },
};

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Policy text in the current language, falling back to the other language. */
export const getPolicyText = (vendor: VendorPolicyFields | null | undefined, kind: PolicyKind, isArabic: boolean): string | null => {
  if (!vendor) return null;
  const en = clean(vendor[FIELD[kind].en]);
  const ar = clean(vendor[FIELD[kind].ar]);
  return isArabic ? ar ?? en : en ?? ar;
};

export const getReturnWindowDays = (vendor: VendorPolicyFields | null | undefined): number | null =>
  typeof vendor?.returnWindowDays === 'number' && Number.isInteger(vendor.returnWindowDays) ? vendor.returnWindowDays : null;

export const hasAnyPolicy = (vendor: VendorPolicyFields | null | undefined, isArabic = false): boolean =>
  POLICY_KINDS.some((kind) => !!getPolicyText(vendor, kind, isArabic)) || getReturnWindowDays(vendor) !== null;
