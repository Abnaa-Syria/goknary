import { INSIGHT_THRESHOLDS, ANALYTICS_LIMITS } from './merchant-analytics-config';

/**
 * Every tunable number of discount suggestions (F2). Suggestions are advisory: nothing here or in
 * discount-suggestions.ts changes a price until a vendor or authorized admin approves one.
 * View/conversion/wishlist thresholds reuse the F3 insight thresholds so both screens agree.
 */

export const DISCOUNT_SUGGESTION_REASONS = ['HIGH_VIEWS_LOW_CONVERSION', 'HIGH_WISHLIST_LOW_SALES', 'SLOW_MOVING_STOCK'] as const;
export type DiscountSuggestionReason = (typeof DISCOUNT_SUGGESTION_REASONS)[number];

export const DISCOUNT_SUGGESTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

/** Percentage discounts only, always inside this range. */
export const SUGGESTED_DISCOUNT_PERCENT = { MIN: 5, MAX: 20 } as const;

/** Same activity window as the default F3 analytics period. */
export const SUGGESTION_WINDOW_DAYS = ANALYTICS_LIMITS.DEFAULT_PERIOD_DAYS;

export const HIGH_VIEWS_LOW_CONVERSION = {
  MIN_UNIQUE_VIEWERS: INSIGHT_THRESHOLDS.MIN_VIEWS_FOR_CONVERSION_INSIGHT,
  /** Gap = 1 − conversion ÷ low-conversion line (F3 `lowConversionThreshold`). First matching step wins. */
  STEPS: [
    { minGap: 2 / 3, percent: 15 },
    { minGap: 1 / 3, percent: 10 },
    { minGap: 0, percent: 5 },
  ],
} as const;

export const HIGH_WISHLIST_LOW_SALES = {
  MIN_WISHLIST_CUSTOMERS: INSIGHT_THRESHOLDS.MIN_WISHLIST_FOR_INSIGHT,
  MAX_PURCHASE_RATIO: INSIGHT_THRESHOLDS.WISHLIST_TO_PURCHASE_MAX_RATIO,
  /** Purchasers ÷ wishlist customers below this gets the larger step. */
  STRONG_GAP_RATIO: 0.1,
  STRONG_PERCENT: 10,
  PERCENT: 5,
} as const;

/**
 * There is no stock-received date, so "slow moving" means: the product has existed for MIN_AGE_DAYS,
 * still has healthy stock, and sold at most MAX_UNITS realized units in the last WINDOW_DAYS.
 */
export const SLOW_MOVING_STOCK = {
  MIN_AGE_DAYS: 60,
  WINDOW_DAYS: 60,
  MAX_UNITS: 1,
  MIN_STOCK: 10,
  /** Stock must also be at least this multiple of the product's own lowStockThreshold. */
  MIN_STOCK_THRESHOLD_MULTIPLE: 2,
  NO_SALES_PERCENT: 10,
  FEW_SALES_PERCENT: 5,
} as const;

export const SUGGESTION_COOLDOWN_DAYS = {
  /** The same reason is not suggested again for a product this long after a rejection. */
  REJECTED: 30,
  /** No new suggestion for a product this long after one was approved. */
  APPROVED: 30,
} as const;

export const SUGGESTION_LIST = { DEFAULT_LIMIT: 20, MAX_LIMIT: 50 } as const;

export const SUGGESTION_GENERATION = {
  /** Default periodic interval in production when DISCOUNT_SUGGESTIONS_INTERVAL_HOURS is unset. */
  DEFAULT_PRODUCTION_INTERVAL_HOURS: 24,
  MIN_INTERVAL_HOURS: 1,
  STARTUP_DELAY_MS: 5 * 60_000,
} as const;
