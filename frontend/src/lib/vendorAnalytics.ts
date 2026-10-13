import type { TFunction } from 'i18next';

/** Shapes returned by GET /api/vendor/analytics (F3). Rates are percentages or null (N/A). */
export type TrendDirection = 'up' | 'down' | 'flat' | 'new' | 'none';

export interface ValueTrend {
  current: number;
  previous: number;
  changePercent: number | null;
  direction: TrendDirection;
}

export interface RateTrend {
  current: number | null;
  previous: number | null;
  changePoints: number | null;
  direction: TrendDirection;
}

export interface StatTrend {
  value: number;
  isPositive: boolean;
  label?: string;
  neutral?: boolean;
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;

/**
 * Badge for a period-over-period change. `higherIsBetter = false` for metrics where growth is bad
 * (returns, cancellations). Without a baseline the badge says so instead of showing a percentage.
 */
export const toStatTrend = (
  trend: ValueTrend | RateTrend | undefined,
  t: TFunction,
  higherIsBetter = true
): StatTrend | undefined => {
  if (!trend) return undefined;
  if (trend.direction === 'none') {
    return { value: 0, isPositive: true, neutral: true, label: t('vendor.analyticsPage.noPreviousData', 'No previous data') };
  }
  if (trend.direction === 'new') {
    return { value: 0, isPositive: true, neutral: true, label: t('vendor.analyticsPage.newBaseline', 'New') };
  }
  const change = 'changePercent' in trend ? trend.changePercent : trend.changePoints;
  if (change === null) return undefined;
  const label = 'changePercent' in trend
    ? `${signed(change)}%`
    : t('vendor.analyticsPage.points', '{{value}} pts', { value: signed(change) });
  if (trend.direction === 'flat') return { value: 0, isPositive: true, neutral: true, label };
  const isUp = trend.direction === 'up';
  return { value: Math.abs(change), isPositive: higherIsBetter ? isUp : !isUp, label };
};

export const formatRate = (value: number | null | undefined, t: TFunction) =>
  value === null || value === undefined ? t('vendor.analyticsPage.notAvailable', 'N/A') : `${value}%`;
