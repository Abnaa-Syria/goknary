/**
 * Every tunable number of per-customer personalization (F2) lives here. Signals are 0–1.
 * The general marketplace ranking (F4, ranking-config.ts) is only read, never changed, by F2.
 */

export const RECOMMENDATION_CONTEXTS = ['home', 'product', 'cart'] as const;
export type RecommendationContext = (typeof RECOMMENDATION_CONTEXTS)[number];

/**
 * Strength of one event of each type. Ordered by commitment: a category glance < a product view <
 * putting it in the cart < saving it for later < paying for it. Wishlist sits above cart because
 * cart adds are often transient (comparison, shipping checks) while a wishlist add is a deliberate
 * "I want this". Search is intentionally weak because a query is less reliable than a click.
 * REMOVE_* events are not negative signals: removal often means checkout or list cleanup.
 */
export const EVENT_WEIGHTS = {
  CATEGORY_VIEW: 0.5,
  SEARCH: 0.25,
  PRODUCT_VIEW: 1,
  ADD_TO_CART: 3,
  ADD_TO_WISHLIST: 4,
  PURCHASE: 6,
} as const;

export type InterestEventType = keyof typeof EVENT_WEIGHTS;
export const INTEREST_EVENT_TYPES = Object.keys(EVENT_WEIGHTS) as InterestEventType[];

export const HISTORY = {
  /** Only this recent window of the customer's own events is read. */
  LOOKBACK_DAYS: 90,
  /** Newest events first; older ones beyond this cap are ignored (bounded work per request). */
  MAX_EVENTS: 500,
  /** Interest halves every this many days: weight × 0.5^(ageDays / HALF_LIFE). */
  RECENCY_HALF_LIFE_DAYS: 30,
  /** Short-term window for the recentInterest signal ("what they are looking at right now"). */
  RECENT_INTEREST_DAYS: 14,
  /** Total decayed interest at which personal signals count fully; below it they are blended down. */
  FULL_PERSONALIZATION_AT: 10,
  /** Do not label a cold-start blend as "For You" after a single interaction. */
  PERSONALIZED_LABEL_AT: 3,
} as const;

/** Share of a category's interest passed up to its parent, grandparent… (F6 hierarchy). */
export const CATEGORY_PROPAGATION = [1, 0.5, 0.25] as const;

/** Exact-product penalties (multipliers on the final score). Never applied to a whole category/vendor. */
export const PENALTIES = {
  RETURN_WINDOW_DAYS: 180,
  RETURN_FACTOR: 0.1,
  RECENT_PURCHASE_DAYS: 30,
  RECENT_PURCHASE_FACTOR: 0.6,
} as const;

export const CO_OCCURRENCE = {
  LOOKBACK_DAYS: 90,
  /** Distinct other customers required before a co-viewed / co-purchased pair is trusted. */
  MIN_SUPPORT: 2,
  /** Seed products (current product, cart items or the customer's top products). */
  MAX_SEEDS: 10,
  /** Other customers who interacted with the seeds that are considered. */
  MAX_PEERS: 200,
  /** Grouped (product, customer) rows read for those peers. */
  MAX_PEER_PAIRS: 5000,
  /** Peer interactions that count as "also interacted with". */
  VIEW_EVENT_TYPES: ['PRODUCT_VIEW', 'ADD_TO_CART', 'ADD_TO_WISHLIST'] as string[],
  /** A co-purchase is a stronger complement signal than a co-view. */
  PURCHASE_MULTIPLIER: 2,
  MAX_CANDIDATES: 60,
} as const;

export const CANDIDATES = {
  /** Hard cap on products scored per request. */
  MAX: 200,
  TOP_CATEGORIES: 5,
  PER_CATEGORY: 30,
  /** Same-category / sibling products for the product and cart contexts. */
  RELATED_CATEGORY: 40,
  GLOBAL: 60,
} as const;

/** Relative weights of the personalized score; divided by their sum, so they need not add to 100. */
export const SCORE_WEIGHTS = {
  globalRanking: 30,
  categoryAffinity: 25,
  coOccurrence: 20,
  recentInterest: 15,
  vendorAffinity: 5,
  contextRelevance: 5,
} as const;

export type ScoreSignal = keyof typeof SCORE_WEIGHTS;

/** Context relevance: same category as the context product(s), or a sibling under the same parent. */
export const CONTEXT_RELEVANCE = {
  SAME_CATEGORY: 1,
  SIBLING_CATEGORY: 0.5,
} as const;

export const DIVERSITY = {
  MAX_CONSECUTIVE_SAME_VENDOR: 2,
  MAX_CONSECUTIVE_SAME_CATEGORY: 3,
  /** Soft caps (share of the list) while other relevant products are still available. */
  VENDOR_SHARE: 0.4,
  CATEGORY_SHARE: 0.5,
} as const;

export const LIMITS = {
  DEFAULT: 12,
  MAX: 50,
  RECENTLY_VIEWED_DEFAULT: 12,
  RECENTLY_VIEWED_MAX: 20,
  /** Recently viewed reads this many distinct products before visibility filtering. */
  RECENTLY_VIEWED_CANDIDATES: 60,
  /** Cart product ids accepted from the client as recommendation context only. */
  CART_CONTEXT_MAX_IDS: 20,
  GUEST_PROFILE_MAX_PRODUCTS: 30,
  GUEST_PROFILE_MAX_CATEGORIES: 15,
} as const;

/** Internal explanation of why a product was picked; not sent to customers. */
export type ReasonCode =
  | 'CO_PURCHASED'
  | 'SIMILAR_TO_VIEWED'
  | 'CATEGORY_INTEREST'
  | 'RELATED_CATEGORY'
  | 'POPULAR_FOR_YOU'
  | 'GLOBAL_FALLBACK';
