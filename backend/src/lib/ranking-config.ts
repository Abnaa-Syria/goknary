import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Every tunable number of the general marketplace ranking (F4) lives here.
 * Signals are 0–1, scores are 0–100. Per-customer personalization is not part of this engine.
 */

export const RANKING_WEIGHT_KEYS = [
  'sales',
  'conversion',
  'rating',
  'reviewCount',
  'freshness',
  'stock',
  'vendorQuality',
  'featured',
] as const;

export type RankingWeightKey = (typeof RANKING_WEIGHT_KEYS)[number];
export type RankingWeights = Record<RankingWeightKey, number>;

/** Relative weights; the engine divides each by their sum, so they need not add up to 100. */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  sales: 25,
  conversion: 20,
  rating: 15,
  reviewCount: 5,
  freshness: 10,
  stock: 5,
  vendorQuality: 15,
  featured: 5,
};

export const MAX_RANKING_WEIGHT = 100;

/** Setting rows (existing key/value table). */
export const RANKING_WEIGHTS_SETTING_KEY = 'ranking_weights';
export const RANKING_LAST_RUN_SETTING_KEY = 'ranking_last_recompute';

/** Sales, views, purchases, returns and cancellations are read from this recent window. */
export const RANKING_LOOKBACK_DAYS = 90;

export const PRODUCT_SIGNAL_RULES = {
  /** Used whenever a signal has too little data to judge (cold start). */
  NEUTRAL: 0.5,
  /** Unique viewers a product needs before its own conversion is trusted. */
  MIN_VIEWS_FOR_RANKING_CONVERSION: 10,
  /** Conversion at this multiple of the platform average (or better) earns the full signal. */
  CONVERSION_FULL_AT_PLATFORM_MULTIPLE: 2,
  /** Bayesian rating: every product starts with this many "virtual" reviews at the platform mean. */
  RATING_PRIOR_REVIEWS: 5,
  /** Prior mean when the platform has no reviews at all. */
  RATING_DEFAULT_MEAN: 3.5,
  /** Full freshness for this many days after creation. */
  FRESHNESS_FULL_DAYS: 7,
  /** After the full period, freshness halves every this many days. */
  FRESHNESS_HALF_LIFE_DAYS: 30,
  /** Freshness never drops below this, so age alone cannot bury a product. */
  FRESHNESS_FLOOR: 0.1,
  /** In stock but at or below the product's own lowStockThreshold. */
  LOW_STOCK_SIGNAL: 0.7,
} as const;

/**
 * Vendor score weights (not admin-editable; based only on raw vendor performance, never product scores).
 * Quality-heavy on purpose: the score becomes the products' vendorQuality signal, and product sales
 * are already counted by the product sales signal, so volume must not hide high returns/cancellations.
 */
export const VENDOR_RANKING_WEIGHTS = {
  sales: 10,
  conversion: 10,
  rating: 15,
  reviewCount: 5,
  returnQuality: 25,
  cancellationQuality: 20,
  stockAvailability: 15,
} as const;

export type VendorSignalKey = keyof typeof VENDOR_RANKING_WEIGHTS;

export const VENDOR_SIGNAL_RULES = {
  /** Unique viewers across the vendor catalog before vendor conversion is trusted. */
  MIN_VIEWERS_FOR_CONVERSION: 30,
  /** Return rate (returned ÷ delivered units) at which return quality reaches 0. */
  RETURN_RATE_ZERO_QUALITY: 0.3,
  /** Cancellation rate (cancelled ÷ all orders) at which cancellation quality reaches 0. */
  CANCELLATION_RATE_ZERO_QUALITY: 0.4,
  /**
   * Sample-size shrinkage: quality = neutral + (raw − neutral) × n / (n + K).
   * One returned order out of one barely moves a new vendor; hundreds of orders count fully.
   */
  RETURN_CONFIDENCE_UNITS: 10,
  CANCELLATION_CONFIDENCE_ORDERS: 10,
} as const;

/** Precomputed general ranking; ties resolve to a fixed order so paginated pages never overlap. */
export const RECOMMENDED_PRODUCT_ORDER: Prisma.ProductOrderByWithRelationInput[] = [
  { rankingScore: 'desc' },
  { ratingAvg: 'desc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];

export const HOME_RANKING = {
  SECTION_SIZE: 12,
  /** Trending = most unique logged-in viewers in this recent window. */
  TRENDING_WINDOW_DAYS: 7,
  /** Best sellers = most delivered, payment-confirmed units in the ranking lookback window. */
  BEST_SELLERS_WINDOW_DAYS: RANKING_LOOKBACK_DAYS,
  /** Grouped candidates fetched before applying visibility, so hidden products cannot shrink a section. */
  CANDIDATES: 60,
} as const;

export const RECOMPUTE = {
  /** Score updates per database transaction. */
  WRITE_CHUNK_SIZE: 100,
  /** Default periodic interval in production when RANKING_RECOMPUTE_INTERVAL_MINUTES is unset. */
  DEFAULT_PRODUCTION_INTERVAL_MINUTES: 60,
  MIN_INTERVAL_MINUTES: 5,
  /** First periodic run waits for the server (and its database connection) to settle. */
  STARTUP_DELAY_MS: 60_000,
  PREVIEW_SIZE: 10,
} as const;

const weightValue = z
  .number({ invalid_type_error: 'Weight must be a number' })
  .finite('Weight must be a finite number')
  .min(0, 'Weight cannot be negative')
  .max(MAX_RANKING_WEIGHT, `Weight cannot exceed ${MAX_RANKING_WEIGHT}`);

/** Every supported key is required and unknown keys are rejected, so a saved config is always complete. */
export const rankingWeightsSchema = z
  .object(
    Object.fromEntries(RANKING_WEIGHT_KEYS.map((key) => [key, weightValue])) as Record<RankingWeightKey, typeof weightValue>
  )
  .strict()
  .refine((weights) => Object.values(weights).some((w) => w > 0), {
    message: 'At least one weight must be greater than 0',
  });

export type WeightsSource = 'default' | 'saved' | 'invalid';

/** Parses the stored Setting value; anything unreadable falls back to defaults instead of failing. */
export const parseStoredWeights = (raw: string | null | undefined): { weights: RankingWeights; source: WeightsSource } => {
  if (raw === null || raw === undefined) return { weights: { ...DEFAULT_RANKING_WEIGHTS }, source: 'default' };
  try {
    const parsed = rankingWeightsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { weights: parsed.data as RankingWeights, source: 'saved' };
  } catch {
    // fall through
  }
  return { weights: { ...DEFAULT_RANKING_WEIGHTS }, source: 'invalid' };
};
