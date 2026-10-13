export type GuestInterestType = 'PRODUCT_VIEW' | 'CATEGORY_VIEW';

interface StoredInterest { id: string; at: number }
interface GuestRecommendationProfile { products: StoredInterest[]; categories: StoredInterest[] }

const STORAGE_KEY = 'goknary_guest_recommendation_profile_v1';
const MAX_PRODUCTS = 30;
const MAX_CATEGORIES = 15;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const emptyProfile = (): GuestRecommendationProfile => ({ products: [], categories: [] });

const isStoredInterest = (value: unknown): value is StoredInterest => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredInterest>;
  return typeof item.id === 'string' && item.id.length > 0 && Number.isFinite(item.at);
};

const readProfile = (now = Date.now()): GuestRecommendationProfile => {
  if (typeof window === 'undefined') return emptyProfile();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return emptyProfile();
    const fresh = (items: unknown) =>
      (Array.isArray(items) ? items.filter(isStoredInterest) : [])
        .filter((item) => now - item.at <= MAX_AGE_MS)
        .sort((a, b) => b.at - a.at);
    return { products: fresh(parsed.products), categories: fresh(parsed.categories) };
  } catch {
    return emptyProfile();
  }
};

const writeProfile = (profile: GuestRecommendationProfile) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* optional */ }
};

export const recordGuestInterest = (type: GuestInterestType, id: string, now = Date.now()): void => {
  if (!id) return;
  const profile = readProfile(now);
  const key = type === 'PRODUCT_VIEW' ? 'products' : 'categories';
  const limit = key === 'products' ? MAX_PRODUCTS : MAX_CATEGORIES;
  profile[key] = [{ id, at: now }, ...profile[key].filter((item) => item.id !== id)].slice(0, limit);
  writeProfile(profile);
};

export const getGuestRecommendationContext = (now = Date.now()) => {
  const profile = readProfile(now);
  return { productIds: profile.products.map((item) => item.id), categoryIds: profile.categories.map((item) => item.id) };
};

export const GUEST_RECOMMENDATION_STORAGE_KEY = STORAGE_KEY;
