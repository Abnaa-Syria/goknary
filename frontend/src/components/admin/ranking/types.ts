import { Award, BadgeCheck, Clock, LucideIcon, MessageSquare, MousePointerClick, Package, ShoppingCart, Star } from 'lucide-react';

export type Weights = Record<string, number>;

export type RecomputeStatus = 'success' | 'partial' | 'failed';

export interface RecomputeSummary {
  reason: string;
  status: RecomputeStatus;
  startedAt?: string;
  finishedAt: string;
  durationMs: number;
  productsProcessed: number;
  productsUpdated: number;
  vendorsProcessed: number;
  vendorsUpdated: number;
  errors: string[];
}

export interface RankingConfig {
  weights: Weights;
  defaults: Weights;
  keys: string[];
  maxWeight: number;
  source: 'default' | 'saved' | 'invalid';
  lookbackDays: number;
  recompute: { running: boolean; intervalMinutes: number; lastRun: RecomputeSummary | null };
}

export interface PreviewProduct {
  rank: number;
  productId: string;
  name: string | null;
  nameAr: string | null;
  slug: string | null;
  image: string | null;
  vendor: { id: string; storeName: string } | null;
  inStock: boolean;
  storedScore: number;
  currentWeightsScore: number;
  previewScore: number;
  signals: Record<string, number>;
  contributions: Record<string, number>;
  featuredContribution: number;
}

/** Response of POST /admin/ranking/preview (the vendors list it also returns is not shown on this page). */
export interface PreviewResponse {
  /** Proposed weights the preview was computed with. */
  weights: Weights;
  /** Saved weights behind `currentWeightsScore`. */
  currentWeights: Weights;
  lookbackDays: number;
  productsConsidered: number;
  vendorsConsidered: number;
  products: PreviewProduct[];
}

export const SIGNAL_ICONS: Record<string, LucideIcon> = {
  sales: ShoppingCart,
  conversion: MousePointerClick,
  rating: Star,
  reviewCount: MessageSquare,
  freshness: Clock,
  stock: Package,
  vendorQuality: BadgeCheck,
  featured: Award,
};

export const SIGNAL_LABELS: Record<string, string> = {
  sales: 'Sales',
  conversion: 'Conversion',
  rating: 'Rating',
  reviewCount: 'Review Count',
  freshness: 'Freshness',
  stock: 'Stock',
  vendorQuality: 'Vendor Quality',
  featured: 'Featured',
};

export const SIGNAL_HELP: Record<string, string> = {
  sales: 'Units sold in the lookback window',
  conversion: 'Share of unique viewers who bought',
  rating: 'Average star rating, weighted toward the platform mean',
  reviewCount: 'Number of customer reviews',
  freshness: 'Full boost in the first week, then fades gradually',
  stock: 'In-stock products rank higher; low stock counts less',
  vendorQuality: 'Aggregated seller performance',
  featured: 'A limited ranking boost; does not guarantee first position',
};

export const sumWeights = (keys: string[], weights: Weights) =>
  keys.reduce((sum, key) => sum + (Number(weights[key]) || 0), 0);

/** Share of the total score a weight controls, in percent with one decimal. */
export const weightShare = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);

export const formatScore = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '—');
