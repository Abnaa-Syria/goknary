import { INSIGHT_THRESHOLDS as T } from './merchant-analytics-config';
import type { InventorySnapshot, PeriodSummary, ProductMetrics, SearchDemandItem } from './merchant-analytics';

/**
 * Rule-based merchant insights (F3). Pure function over already computed metrics: no AI/ML, no
 * automatic actions (it never creates discounts or changes ranking). Thresholds live in
 * merchant-analytics-config.ts.
 */

export const INSIGHT_TYPES = [
  'HIGH_VIEWS_LOW_CONVERSION',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'HIGH_RETURN_RATE',
  'HIGH_WISHLIST_LOW_SALES',
  'SEARCH_DEMAND_OPPORTUNITY',
  'BEST_SELLER',
  'NOT_ENOUGH_DATA',
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];
export type InsightSeverity = 'high' | 'medium' | 'low' | 'info';

export interface MerchantInsight {
  type: InsightType;
  severity: InsightSeverity;
  productId?: string;
  productName?: string;
  title: string;
  message: string;
  metric: { name: string; value: number | null };
  /** Values used in the message, so the UI can render a localized version. */
  params: Record<string, string | number>;
  suggestedAction: string;
}

export interface InsightProduct extends ProductMetrics {
  name: string;
}

export interface MerchantInsightInput {
  summary: PeriodSummary;
  products: InsightProduct[];
  inventory: InventorySnapshot;
  searchDemand: SearchDemandItem[];
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };

/** The store's own average once it has enough viewers; the fixed floor before that. */
export const lowConversionThreshold = (summary: Pick<PeriodSummary, 'uniqueViewers' | 'conversionRate'>): number =>
  summary.uniqueViewers >= T.MIN_VENDOR_VIEWERS_FOR_BENCHMARK && summary.conversionRate !== null
    ? summary.conversionRate * T.VENDOR_BENCHMARK_FACTOR
    : T.LOW_CONVERSION_RATE;

export const generateMerchantInsights = (input: MerchantInsightInput): MerchantInsight[] => {
  const { summary, products, inventory, searchDemand } = input;
  const insights: MerchantInsight[] = [];
  const conversionLine = lowConversionThreshold(summary);

  for (const item of inventory.outOfStock) {
    insights.push({
      type: 'OUT_OF_STOCK',
      severity: 'high',
      productId: item.productId,
      productName: item.name,
      title: 'Out of stock',
      message: `"${item.name}" is out of stock, so customers cannot buy it.`,
      metric: { name: 'stock', value: item.stock },
      params: { product: item.name, stock: item.stock },
      suggestedAction: 'Restock this product or update its inventory.',
    });
  }

  for (const item of inventory.lowStock) {
    insights.push({
      type: 'LOW_STOCK',
      severity: 'medium',
      productId: item.productId,
      productName: item.name,
      title: 'Running low on stock',
      message: `"${item.name}" has only ${item.stock} left (alert level ${item.lowStockThreshold}).`,
      metric: { name: 'stock', value: item.stock },
      params: { product: item.name, stock: item.stock, threshold: item.lowStockThreshold },
      suggestedAction: 'Restock soon to avoid missing sales.',
    });
  }

  const byPriority = <K extends keyof ProductMetrics>(key: K) =>
    [...products].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));

  for (const p of byPriority('uniqueViewers')) {
    if (p.uniqueViewers < T.MIN_VIEWS_FOR_CONVERSION_INSIGHT || p.conversionRate === null) continue;
    if (p.conversionRate >= conversionLine) continue;
    insights.push({
      type: 'HIGH_VIEWS_LOW_CONVERSION',
      severity: 'medium',
      productId: p.productId,
      productName: p.name,
      title: 'Many views, few purchases',
      message: `"${p.name}" had ${p.views} views from ${p.uniqueViewers} customers but only ${p.purchasingCustomers} bought it (${p.conversionRate}% conversion).`,
      metric: { name: 'conversionRate', value: p.conversionRate },
      params: {
        product: p.name,
        views: p.views,
        viewers: p.uniqueViewers,
        purchasers: p.purchasingCustomers,
        rate: p.conversionRate,
      },
      suggestedAction: 'Review the price, photos and description, or consider a promotion.',
    });
  }

  for (const p of byPriority('returnRate')) {
    if (p.unitsSold < T.MIN_SALES_FOR_RETURN_INSIGHT || p.returnRate === null || p.returnRate <= T.HIGH_RETURN_RATE) continue;
    insights.push({
      type: 'HIGH_RETURN_RATE',
      severity: 'high',
      productId: p.productId,
      productName: p.name,
      title: 'High return rate',
      message: `${p.returnedQuantity} of ${p.unitsSold} delivered units of "${p.name}" were returned (${p.returnRate}%).`,
      metric: { name: 'returnRate', value: p.returnRate },
      params: { product: p.name, returned: p.returnedQuantity, sold: p.unitsSold, rate: p.returnRate },
      suggestedAction: 'Check return reasons, product quality and whether the description matches the item.',
    });
  }

  for (const p of byPriority('wishlistCustomers')) {
    if (p.wishlistCustomers < T.MIN_WISHLIST_FOR_INSIGHT) continue;
    if (p.purchasingCustomers >= p.wishlistCustomers * T.WISHLIST_TO_PURCHASE_MAX_RATIO) continue;
    insights.push({
      type: 'HIGH_WISHLIST_LOW_SALES',
      severity: 'low',
      productId: p.productId,
      productName: p.name,
      title: 'Wanted but not bought',
      message: `${p.wishlistCustomers} customers added "${p.name}" to their wishlist, but only ${p.purchasingCustomers} bought it.`,
      metric: { name: 'wishlistCustomers', value: p.wishlistCustomers },
      params: { product: p.name, wishlist: p.wishlistCustomers, purchasers: p.purchasingCustomers },
      suggestedAction: 'Customers are interested: review the price or consider a promotion.',
    });
  }

  for (const demand of searchDemand) {
    if (!demand.lowResults) continue;
    insights.push({
      type: 'SEARCH_DEMAND_OPPORTUNITY',
      severity: 'low',
      title: 'Search demand opportunity',
      message: `Customers searched for "${demand.query}" ${demand.searches} times and found ${demand.averageResults} products on average.`,
      metric: { name: 'searches', value: demand.searches },
      params: { query: demand.query, searches: demand.searches, results: demand.averageResults },
      suggestedAction: 'You sell related items: consider adding matching products or using these words in titles.',
    });
  }

  const best = byPriority('unitsSold')[0];
  if (best && best.unitsSold >= T.MIN_UNITS_FOR_BEST_SELLER) {
    insights.push({
      type: 'BEST_SELLER',
      severity: 'info',
      productId: best.productId,
      productName: best.name,
      title: 'Best seller',
      message: `"${best.name}" is your best seller with ${best.unitsSold} units delivered in this period.`,
      metric: { name: 'unitsSold', value: best.unitsSold },
      params: { product: best.name, units: best.unitsSold },
      suggestedAction: 'Keep it in stock and feature it in your store.',
    });
  }

  if (summary.uniqueViewers < T.MIN_VIEWS_FOR_CONVERSION_INSIGHT && summary.unitsSold < T.MIN_SALES_FOR_RETURN_INSIGHT) {
    insights.push({
      type: 'NOT_ENOUGH_DATA',
      severity: 'info',
      title: 'Not enough data yet',
      message: 'There is not enough customer activity in this period for reliable performance insights.',
      metric: { name: 'uniqueViewers', value: summary.uniqueViewers },
      params: { viewers: summary.uniqueViewers },
      suggestedAction: 'Share your store and keep products in stock; insights appear as activity grows.',
    });
  }

  const perType = new Map<InsightType, number>();
  return insights
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .filter((insight) => {
      const count = perType.get(insight.type) ?? 0;
      if (count >= T.MAX_INSIGHTS_PER_TYPE) return false;
      perType.set(insight.type, count + 1);
      return true;
    })
    .slice(0, T.MAX_INSIGHTS);
};
