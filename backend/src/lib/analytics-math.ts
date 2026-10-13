/**
 * Shared helpers for period-over-period analytics. Nothing here ever returns NaN or Infinity:
 * a missing baseline is reported as `null` with an explicit direction instead.
 */

export type TrendDirection = 'up' | 'down' | 'flat' | 'new' | 'none';

export interface ValueTrend {
  current: number;
  previous: number;
  /** null when there is no previous baseline (previous = 0). */
  changePercent: number | null;
  direction: TrendDirection;
}

export interface RateTrend {
  current: number | null;
  previous: number | null;
  /** Difference in percentage points; null when either side has no rate. */
  changePoints: number | null;
  direction: TrendDirection;
}

const finite = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const round1 = (value: number) => Math.round(value * 10) / 10;
export const round2 = (value: number) => Math.round(value * 100) / 100;

const directionOf = (delta: number): TrendDirection => (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');

/**
 * ((current - previous) / previous) * 100. previous = 0 has no baseline: `new` when the current
 * value is positive, `none` when both are zero.
 */
export const computeChange = (current: number, previous: number): ValueTrend => {
  const c = finite(current);
  const p = finite(previous);
  if (p === 0) {
    return { current: c, previous: p, changePercent: null, direction: c === 0 ? 'none' : 'new' };
  }
  const changePercent = round1(((c - p) / Math.abs(p)) * 100);
  return { current: c, previous: p, changePercent, direction: directionOf(changePercent) };
};

/** Rates are compared in percentage points (a 2% → 3% conversion is +1 pt, not +50%). */
export const computeRateChange = (current: number | null, previous: number | null): RateTrend => {
  if (current === null || previous === null) {
    return { current, previous, changePoints: null, direction: current === null ? 'none' : 'new' };
  }
  const changePoints = round1(current - previous);
  return { current, previous, changePoints, direction: directionOf(changePoints) };
};

/** numerator / denominator × 100, or null when the denominator is 0 (N/A, not a misleading 0%). */
export const safeRate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? round1((finite(numerator) / denominator) * 100) : null;
