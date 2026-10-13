/**
 * Every tunable number of vendor analytics (F3) lives here. Rates are percentages (0–100).
 * F4 ranking weights are a separate concern and must not be added here.
 */

export const ANALYTICS_LIMITS = {
  DEFAULT_PERIOD_DAYS: 30,
  MAX_PERIOD_DAYS: 365,
  PRODUCT_TABLE_DEFAULT_LIMIT: 20,
  PRODUCT_TABLE_MAX_LIMIT: 50,
  TOP_LIST_SIZE: 10,
  INVENTORY_LIST_SIZE: 20,
} as const;

export const INSIGHT_THRESHOLDS = {
  /** Unique viewers a product needs before its conversion is judged. */
  MIN_VIEWS_FOR_CONVERSION_INSIGHT: 20,
  /** Fallback "low conversion" line when the vendor has too little data for its own benchmark. */
  LOW_CONVERSION_RATE: 2,
  /** Unique viewers the whole store needs before its own average becomes the benchmark. */
  MIN_VENDOR_VIEWERS_FOR_BENCHMARK: 100,
  /** With enough data, a product is "low conversion" below this share of the store average. */
  VENDOR_BENCHMARK_FACTOR: 0.5,
  /** Delivered units a product needs before its return rate is judged. */
  MIN_SALES_FOR_RETURN_INSIGHT: 5,
  HIGH_RETURN_RATE: 15,
  /** Unique wishlist customers before "wanted but not bought" is reported. */
  MIN_WISHLIST_FOR_INSIGHT: 5,
  /** Purchasing customers below this share of wishlist customers count as low sales. */
  WISHLIST_TO_PURCHASE_MAX_RATIO: 0.2,
  MIN_UNITS_FOR_BEST_SELLER: 3,
  MAX_INSIGHTS_PER_TYPE: 3,
  MAX_INSIGHTS: 12,
} as const;

export const SEARCH_DEMAND = {
  /** Most frequent platform queries considered for matching. */
  CANDIDATE_QUERIES: 300,
  /** A query must be searched at least this many times to be shown (aggregate-only privacy floor). */
  MIN_SEARCHES: 3,
  /** Average results at or below this mark a demand opportunity. */
  LOW_RESULTS: 3,
  MAX_RESULTS: 10,
  /** Most recent catalog products used to build the vendor vocabulary. */
  CATALOG_SAMPLE: 2000,
  MIN_TOKEN_LENGTH: 3,
} as const;
