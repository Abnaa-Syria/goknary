import {
  PRODUCT_SIGNAL_RULES as P,
  RANKING_WEIGHT_KEYS,
  RankingWeightKey,
  RankingWeights,
  VENDOR_RANKING_WEIGHTS,
  VendorSignalKey,
} from './ranking-config';

/**
 * Pure ranking math (F4). Every signal is clamped to 0–1 and every score to 0–100; missing or
 * non-finite inputs never produce NaN, Infinity or negative values.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const clampUnit = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

const round4 = (value: number) => Math.round(value * 10000) / 10000;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** log1p(value) / log1p(max): 100 units beat 10 units, but not tenfold. 0 when nobody has any. */
export const logNormalize = (value: number, max: number): number => {
  if (!(max > 0) || !(value > 0)) return 0;
  return clampUnit(Math.log1p(value) / Math.log1p(max));
};

/**
 * Conversion = unique purchasers ÷ unique viewers. Below the minimum sample, or when the platform
 * has no conversion baseline yet, the signal is neutral. Otherwise it is relative to the platform
 * average: average → 0.5, `CONVERSION_FULL_AT_PLATFORM_MULTIPLE`× average or more → 1.
 */
export const conversionSignal = (
  purchasers: number,
  viewers: number,
  platformRate: number | null,
  minViewers: number
): number => {
  if (viewers < minViewers || !platformRate || !(platformRate > 0)) return P.NEUTRAL;
  return clampUnit(purchasers / viewers / (platformRate * P.CONVERSION_FULL_AT_PLATFORM_MULTIPLE));
};

/**
 * Bayesian average: (C × platformMean + Σratings) ÷ (C + n), mapped from the 1–5 scale to 0–1.
 * A single 5★ review cannot beat 4.8★ from hundreds of reviews.
 */
export const ratingSignal = (ratingSum: number, reviewCount: number, platformMean: number): number => {
  const c = P.RATING_PRIOR_REVIEWS;
  const n = Math.max(0, reviewCount);
  const average = (c * platformMean + (n > 0 ? ratingSum : 0)) / (c + n);
  return clampUnit((average - 1) / 4);
};

/** 1 for the first FRESHNESS_FULL_DAYS, then halves every FRESHNESS_HALF_LIFE_DAYS, never below the floor. */
export const freshnessSignal = (createdAt: Date, now: Date): number => {
  const ageDays = Math.max(0, (now.getTime() - new Date(createdAt).getTime()) / DAY_MS);
  if (ageDays <= P.FRESHNESS_FULL_DAYS) return 1;
  const decayed = Math.pow(0.5, (ageDays - P.FRESHNESS_FULL_DAYS) / P.FRESHNESS_HALF_LIFE_DAYS);
  return clampUnit(Math.max(P.FRESHNESS_FLOOR, decayed));
};

/** Product.stock is the sellable quantity for plain and variant products alike (F5 keeps it = Σ active variant stock). */
export const stockSignal = (stock: number, lowStockThreshold: number): number => {
  if (!(stock > 0)) return 0;
  if (stock <= Math.max(0, lowStockThreshold)) return P.LOW_STOCK_SIGNAL;
  return 1;
};

/**
 * Quality from a "bad event" rate (returns, cancellations): 1 at 0%, 0 at `zeroAt`. Shrunk toward
 * neutral by sample size n / (n + K), so tiny samples barely move the score.
 */
export const shrunkQuality = (badCount: number, sampleSize: number, zeroAt: number, confidenceK: number): number => {
  if (!(sampleSize > 0)) return P.NEUTRAL;
  const raw = 1 - Math.min(1, badCount / sampleSize / zeroAt);
  const confidence = sampleSize / (sampleSize + confidenceK);
  return clampUnit(P.NEUTRAL + (raw - P.NEUTRAL) * confidence);
};

export interface WeightedScore<K extends string> {
  /** 0–100. */
  score: number;
  signals: Record<K, number>;
  /** weight ÷ Σweights. */
  effectiveWeights: Record<K, number>;
  /** Ranking points each signal added (they sum to the score, up to rounding). */
  contributions: Record<K, number>;
}

const weightedScore = <K extends string>(
  keys: readonly K[],
  rawSignals: Record<K, number>,
  weights: Record<K, number>
): WeightedScore<K> => {
  const safeWeights = keys.map((k) => (Number.isFinite(weights[k]) && weights[k] > 0 ? weights[k] : 0));
  const total = safeWeights.reduce((a, b) => a + b, 0);
  const signals = {} as Record<K, number>;
  const effectiveWeights = {} as Record<K, number>;
  const contributions = {} as Record<K, number>;
  let sum = 0;
  keys.forEach((key, i) => {
    const signal = clampUnit(rawSignals[key]);
    const effective = total > 0 ? safeWeights[i] / total : 0;
    signals[key] = round4(signal);
    effectiveWeights[key] = round4(effective);
    contributions[key] = round2(signal * effective * 100);
    sum += signal * effective;
  });
  return { score: round2(Math.min(100, Math.max(0, sum * 100))), signals, effectiveWeights, contributions };
};

export type ProductSignals = Record<RankingWeightKey, number>;
export type VendorSignals = Record<VendorSignalKey, number>;

export const calculateProductRankingScore = (signals: ProductSignals, weights: RankingWeights) =>
  weightedScore(RANKING_WEIGHT_KEYS, signals, weights);

const VENDOR_KEYS = Object.keys(VENDOR_RANKING_WEIGHTS) as VendorSignalKey[];

export const calculateVendorRankingScore = (signals: VendorSignals) =>
  weightedScore(VENDOR_KEYS, signals, VENDOR_RANKING_WEIGHTS);
