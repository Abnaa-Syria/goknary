import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { RefundKind } from './refund-workflow';
import { COMPLETED_REFUND_STATUSES, isConfirmedPurchase, isRealizedSale } from './merchant-analytics';
import { PUBLIC_VENDOR_STATUS, publicProductWhere } from './visibility';
import {
  DEFAULT_RANKING_WEIGHTS,
  PRODUCT_SIGNAL_RULES,
  RANKING_LAST_RUN_SETTING_KEY,
  RANKING_LOOKBACK_DAYS,
  RANKING_WEIGHTS_SETTING_KEY,
  RECOMPUTE,
  RankingWeightKey,
  RankingWeights,
  VENDOR_SIGNAL_RULES,
  VendorSignalKey,
  WeightsSource,
  parseStoredWeights,
} from './ranking-config';
import {
  WeightedScore,
  calculateProductRankingScore,
  calculateVendorRankingScore,
  conversionSignal,
  freshnessSignal,
  logNormalize,
  ratingSignal,
  shrunkQuality,
  stockSignal,
} from './ranking-signals';

/**
 * General marketplace ranking (F4). Reads the sources of truth directly (no internal HTTP):
 * Orders/OrderItems (same realized-sale and confirmed-purchase rules as F3), RefundRequests,
 * UserEvent views, Review rows, Products and Vendors.
 *
 * Order of work, which rules out circular dependencies:
 *   1. aggregate raw metrics with grouped/batched queries;
 *   2. score vendors from raw vendor metrics only;
 *   3. score products, using the freshly computed vendor score as the vendorQuality signal.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'unknown error');

// ─── Config ──────────────────────────────────────────────────────────────────

export const loadRankingWeights = async (): Promise<{ weights: RankingWeights; source: WeightsSource }> => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: RANKING_WEIGHTS_SETTING_KEY } });
    const result = parseStoredWeights(row?.value);
    if (result.source === 'invalid') {
      console.warn('[ranking] Stored ranking_weights is invalid; using default weights.');
    }
    return result;
  } catch (err) {
    console.warn('[ranking] Could not read ranking_weights; using default weights:', errorMessage(err));
    return { weights: { ...DEFAULT_RANKING_WEIGHTS }, source: 'default' };
  }
};

export const saveRankingWeights = (weights: RankingWeights) => {
  const value = JSON.stringify(weights);
  return prisma.setting.upsert({
    where: { key: RANKING_WEIGHTS_SETTING_KEY },
    update: { value },
    create: { key: RANKING_WEIGHTS_SETTING_KEY, value },
  });
};

// ─── Raw metrics ─────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  vendorId: string;
  stock: number;
  lowStockThreshold: number;
  featured: boolean;
  createdAt: Date;
  rankingScore: number;
}

interface ProductRaw {
  unitsSold: number;
  purchasers: Set<string>;
  uniqueViewers: number;
  reviewCount: number;
  ratingSum: number;
}

interface VendorRaw {
  unitsSold: number;
  returnedUnits: number;
  orders: number;
  cancelledOrders: number;
  purchasers: Set<string>;
  uniqueViewers: number;
  reviewCount: number;
  ratingSum: number;
  liveProducts: number;
  inStockProducts: number;
}

export interface RankingInputs {
  now: Date;
  from: Date;
  products: ProductRow[];
  vendors: Array<{ id: string; rankingScore: number }>;
  productRaw: Map<string, ProductRaw>;
  vendorRaw: Map<string, VendorRaw>;
}

const newProductRaw = (): ProductRaw => ({ unitsSold: 0, purchasers: new Set(), uniqueViewers: 0, reviewCount: 0, ratingSum: 0 });
const newVendorRaw = (): VendorRaw => ({
  unitsSold: 0,
  returnedUnits: 0,
  orders: 0,
  cancelledOrders: 0,
  purchasers: new Set(),
  uniqueViewers: 0,
  reviewCount: 0,
  ratingSum: 0,
  liveProducts: 0,
  inStockProducts: 0,
});

/** Seven grouped/batched reads for the whole marketplace; nothing runs once per product or vendor. */
export const loadRankingInputs = async (now: Date = new Date()): Promise<RankingInputs> => {
  const from = new Date(now.getTime() - RANKING_LOOKBACK_DAYS * DAY_MS);
  const since = { gte: from };

  const [vendors, products, orders, completedReturns, productViewPairs, vendorViewPairs, reviewGroups] =
    await Promise.all([
      prisma.vendor.findMany({ where: { status: PUBLIC_VENDOR_STATUS }, select: { id: true, rankingScore: true } }),
      prisma.product.findMany({
        where: publicProductWhere(),
        select: { id: true, vendorId: true, stock: true, lowStockThreshold: true, featured: true, createdAt: true, rankingScore: true },
      }),
      prisma.order.findMany({
        where: { createdAt: since, vendor: { status: PUBLIC_VENDOR_STATUS } },
        select: {
          id: true,
          userId: true,
          vendorId: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          items: { select: { productId: true, quantity: true } },
        },
      }),
      prisma.refundRequest.findMany({
        where: { kind: RefundKind.RETURN, status: { in: COMPLETED_REFUND_STATUSES }, order: { createdAt: since } },
        select: { orderId: true, vendorId: true, quantity: true },
      }),
      prisma.userEvent.groupBy({
        by: ['productId', 'userId'],
        where: { type: 'PRODUCT_VIEW', createdAt: since, productId: { not: null } },
        _count: { _all: true },
      }),
      prisma.userEvent.groupBy({
        by: ['vendorId', 'userId'],
        where: { type: 'PRODUCT_VIEW', createdAt: since, vendorId: { not: null } },
        _count: { _all: true },
      }),
      // Ratings come from Review rows (lifetime), not seed-able Product/Vendor rating columns.
      prisma.review.groupBy({
        by: ['productId'],
        where: { product: publicProductWhere() },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

  const productRaw = new Map<string, ProductRaw>();
  const vendorRaw = new Map<string, VendorRaw>(vendors.map((v) => [v.id, newVendorRaw()]));
  const productOf = (id: string) => {
    let entry = productRaw.get(id);
    if (!entry) {
      entry = newProductRaw();
      productRaw.set(id, entry);
    }
    return entry;
  };

  const productVendor = new Map<string, string>();
  for (const product of products) {
    productVendor.set(product.id, product.vendorId);
    productOf(product.id);
    const vendor = vendorRaw.get(product.vendorId);
    if (vendor) {
      vendor.liveProducts++;
      if (product.stock > 0) vendor.inStockProducts++;
    }
  }

  const realizedOrderIds = new Set<string>();
  for (const order of orders) {
    const vendor = vendorRaw.get(order.vendorId);
    if (!vendor) continue;
    vendor.orders++;
    if (order.status === 'CANCELLED') vendor.cancelledOrders++;
    if (isConfirmedPurchase(order)) {
      vendor.purchasers.add(order.userId);
      for (const item of order.items) productOf(item.productId).purchasers.add(order.userId);
    }
    if (isRealizedSale(order)) {
      realizedOrderIds.add(order.id);
      for (const item of order.items) {
        productOf(item.productId).unitsSold += item.quantity;
        vendor.unitsSold += item.quantity;
      }
    }
  }

  for (const refund of completedReturns) {
    if (!realizedOrderIds.has(refund.orderId)) continue;
    const vendor = vendorRaw.get(refund.vendorId);
    if (vendor) vendor.returnedUnits += refund.quantity;
  }

  for (const row of productViewPairs) {
    if (row.productId) productOf(row.productId).uniqueViewers++;
  }
  for (const row of vendorViewPairs) {
    const vendor = row.vendorId ? vendorRaw.get(row.vendorId) : undefined;
    if (vendor) vendor.uniqueViewers++;
  }

  for (const group of reviewGroups) {
    const count = group._count._all;
    const sum = (group._avg.rating ?? 0) * count;
    const product = productOf(group.productId);
    product.reviewCount += count;
    product.ratingSum += sum;
    const vendorId = productVendor.get(group.productId);
    const vendor = vendorId ? vendorRaw.get(vendorId) : undefined;
    if (vendor) {
      vendor.reviewCount += count;
      vendor.ratingSum += sum;
    }
  }

  return { now, from, products, vendors, productRaw, vendorRaw };
};

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface ProductRanking extends WeightedScore<RankingWeightKey> {
  productId: string;
  vendorId: string;
  storedScore: number;
  inStock: boolean;
}

export interface VendorRanking extends WeightedScore<VendorSignalKey> {
  vendorId: string;
  storedScore: number;
}

export interface RankingResult {
  vendors: VendorRanking[];
  products: ProductRanking[];
}

/** Σpurchasers ÷ Σviewers over the entities that pass the minimum sample; null when none do. */
const pooledConversion = (rows: Array<{ purchasers: number; viewers: number }>, minViewers: number): number | null => {
  let purchasers = 0;
  let viewers = 0;
  for (const row of rows) {
    if (row.viewers < minViewers) continue;
    purchasers += row.purchasers;
    viewers += row.viewers;
  }
  return viewers > 0 ? purchasers / viewers : null;
};

const byScoreThenId = <T extends { score: number }>(id: (row: T) => string) => (a: T, b: T) =>
  b.score - a.score || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0);

/** Pure and deterministic: the same inputs and weights always give the same scores and order. */
export const scoreRankingInputs = (inputs: RankingInputs, weights: RankingWeights): RankingResult => {
  let totalRatingSum = 0;
  let totalReviews = 0;
  for (const raw of inputs.productRaw.values()) {
    totalRatingSum += raw.ratingSum;
    totalReviews += raw.reviewCount;
  }
  const ratingMean = totalReviews > 0 ? totalRatingSum / totalReviews : PRODUCT_SIGNAL_RULES.RATING_DEFAULT_MEAN;

  // 2. Vendors — raw vendor performance only.
  const vendorEntries = inputs.vendors.map((v) => ({ vendor: v, raw: inputs.vendorRaw.get(v.id) ?? newVendorRaw() }));
  const maxVendorUnits = Math.max(0, ...vendorEntries.map((e) => e.raw.unitsSold));
  const maxVendorReviews = Math.max(0, ...vendorEntries.map((e) => e.raw.reviewCount));
  const vendorConversionBase = pooledConversion(
    vendorEntries.map((e) => ({ purchasers: e.raw.purchasers.size, viewers: e.raw.uniqueViewers })),
    VENDOR_SIGNAL_RULES.MIN_VIEWERS_FOR_CONVERSION
  );

  const vendors: VendorRanking[] = vendorEntries.map(({ vendor, raw }) => ({
    vendorId: vendor.id,
    storedScore: vendor.rankingScore,
    ...calculateVendorRankingScore({
      sales: logNormalize(raw.unitsSold, maxVendorUnits),
      conversion: conversionSignal(
        raw.purchasers.size,
        raw.uniqueViewers,
        vendorConversionBase,
        VENDOR_SIGNAL_RULES.MIN_VIEWERS_FOR_CONVERSION
      ),
      rating: ratingSignal(raw.ratingSum, raw.reviewCount, ratingMean),
      reviewCount: logNormalize(raw.reviewCount, maxVendorReviews),
      returnQuality: shrunkQuality(
        raw.returnedUnits,
        raw.unitsSold,
        VENDOR_SIGNAL_RULES.RETURN_RATE_ZERO_QUALITY,
        VENDOR_SIGNAL_RULES.RETURN_CONFIDENCE_UNITS
      ),
      cancellationQuality: shrunkQuality(
        raw.cancelledOrders,
        raw.orders,
        VENDOR_SIGNAL_RULES.CANCELLATION_RATE_ZERO_QUALITY,
        VENDOR_SIGNAL_RULES.CANCELLATION_CONFIDENCE_ORDERS
      ),
      stockAvailability: raw.liveProducts > 0 ? raw.inStockProducts / raw.liveProducts : PRODUCT_SIGNAL_RULES.NEUTRAL,
    }),
  }));
  const vendorScore = new Map(vendors.map((v) => [v.vendorId, v.score]));

  // 3. Products — may use the vendor score computed above, never the other way round.
  const productEntries = inputs.products.map((p) => ({ product: p, raw: inputs.productRaw.get(p.id) ?? newProductRaw() }));
  const maxUnits = Math.max(0, ...productEntries.map((e) => e.raw.unitsSold));
  const maxReviews = Math.max(0, ...productEntries.map((e) => e.raw.reviewCount));
  const minViews = PRODUCT_SIGNAL_RULES.MIN_VIEWS_FOR_RANKING_CONVERSION;
  const productConversionBase = pooledConversion(
    productEntries.map((e) => ({ purchasers: e.raw.purchasers.size, viewers: e.raw.uniqueViewers })),
    minViews
  );

  const products: ProductRanking[] = productEntries.map(({ product, raw }) => {
    const vendorRank = vendorScore.get(product.vendorId);
    return {
      productId: product.id,
      vendorId: product.vendorId,
      storedScore: product.rankingScore,
      inStock: product.stock > 0,
      ...calculateProductRankingScore(
        {
          sales: logNormalize(raw.unitsSold, maxUnits),
          conversion: conversionSignal(raw.purchasers.size, raw.uniqueViewers, productConversionBase, minViews),
          rating: ratingSignal(raw.ratingSum, raw.reviewCount, ratingMean),
          reviewCount: logNormalize(raw.reviewCount, maxReviews),
          freshness: freshnessSignal(product.createdAt, inputs.now),
          stock: stockSignal(product.stock, product.lowStockThreshold),
          vendorQuality: vendorRank === undefined ? PRODUCT_SIGNAL_RULES.NEUTRAL : vendorRank / 100,
          featured: product.featured ? 1 : 0,
        },
        weights
      ),
    };
  });

  vendors.sort(byScoreThenId((v: VendorRanking) => v.vendorId));
  products.sort(byScoreThenId((p: ProductRanking) => p.productId));
  return { vendors, products };
};

// ─── Recompute ───────────────────────────────────────────────────────────────

export interface RecomputeSummary {
  reason: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  productsProcessed: number;
  productsUpdated: number;
  vendorsProcessed: number;
  vendorsUpdated: number;
  errors: string[];
}

export class RankingRecomputeInProgressError extends Error {
  constructor() {
    super('A ranking recompute is already running');
  }
}

let running: Promise<RecomputeSummary> | null = null;
let lastSummary: RecomputeSummary | null = null;

const sameScore = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

/**
 * One UPDATE … CASE statement per chunk. Raw SQL so the ranking write does not bump the row's
 * `updatedAt` (Prisma's @updatedAt), which other screens use as "last edited".
 */
const writeScores = async (
  table: 'products' | 'vendors',
  rows: Array<{ id: string; score: number }>,
  at: Date,
  errors: string[]
): Promise<number> => {
  let updated = 0;
  for (let i = 0; i < rows.length; i += RECOMPUTE.WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + RECOMPUTE.WRITE_CHUNK_SIZE);
    const cases = Prisma.join(
      chunk.map((row) => Prisma.sql`WHEN ${row.id} THEN ${row.score}`),
      ' '
    );
    const ids = Prisma.join(chunk.map((row) => row.id));
    try {
      await prisma.$executeRaw`UPDATE ${Prisma.raw(`\`${table}\``)} SET ranking_score = CASE id ${cases} END, ranking_updated_at = ${at} WHERE id IN (${ids})`;
      updated += chunk.length;
    } catch (err) {
      const batch = i / RECOMPUTE.WRITE_CHUNK_SIZE + 1;
      console.error(`[ranking] Failed to write ${table} scores (batch ${batch}):`, errorMessage(err));
      errors.push(`Failed to write ${chunk.length} ${table} scores (batch ${batch}); they keep their previous scores.`);
    }
  }
  return updated;
};

const persistSummary = async (summary: RecomputeSummary) => {
  lastSummary = summary;
  try {
    const value = JSON.stringify(summary);
    await prisma.setting.upsert({
      where: { key: RANKING_LAST_RUN_SETTING_KEY },
      update: { value },
      create: { key: RANKING_LAST_RUN_SETTING_KEY, value },
    });
  } catch (err) {
    console.warn('[ranking] Could not store the recompute summary:', errorMessage(err));
  }
};

const runRecompute = async (options: RecomputeOptions): Promise<RecomputeSummary> => {
  const started = new Date();
  const errors: string[] = [];
  const finish = async (fields: Omit<RecomputeSummary, 'reason' | 'startedAt' | 'finishedAt' | 'durationMs' | 'errors' | 'status'>) => {
    const finished = new Date();
    const failedEverything = errors.length > 0 && fields.productsUpdated === 0 && fields.vendorsUpdated === 0;
    const summary: RecomputeSummary = {
      reason: options.reason ?? 'manual',
      status: errors.length === 0 ? 'success' : failedEverything ? 'failed' : 'partial',
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
      ...fields,
      errors,
    };
    await persistSummary(summary);
    return summary;
  };

  let result: RankingResult;
  try {
    const [{ weights }, inputs] = await Promise.all([loadRankingWeights(), loadRankingInputs(started)]);
    result = scoreRankingInputs(inputs, weights);
  } catch (err) {
    console.error('[ranking] Failed to load ranking data:', errorMessage(err));
    errors.push('Failed to load ranking data; existing scores were kept.');
    return finish({ productsProcessed: 0, productsUpdated: 0, vendorsProcessed: 0, vendorsUpdated: 0 });
  }

  // Everything is computed before the first write; a failing batch leaves only its own rows on old scores.
  const isFull = !options.productIds && !options.vendorIds;
  const productScope = options.productIds ? new Set(options.productIds) : null;
  const vendorScope = options.vendorIds ? new Set(options.vendorIds) : null;
  const vendorsInScope = result.vendors.filter((v) => isFull || vendorScope?.has(v.vendorId));
  const productsInScope = result.products.filter((p) => isFull || productScope?.has(p.productId));

  const vendorsUpdated = await writeScores(
    'vendors',
    vendorsInScope.filter((v) => !sameScore(v.score, v.storedScore)).map((v) => ({ id: v.vendorId, score: v.score })),
    started,
    errors
  );
  const productsUpdated = await writeScores(
    'products',
    productsInScope.filter((p) => !sameScore(p.score, p.storedScore)).map((p) => ({ id: p.productId, score: p.score })),
    started,
    errors
  );

  return finish({
    productsProcessed: productsInScope.length,
    productsUpdated,
    vendorsProcessed: vendorsInScope.length,
    vendorsUpdated,
  });
};

export interface RecomputeOptions {
  /** Limit writes to these products (normalization still uses the whole marketplace). */
  productIds?: string[];
  vendorIds?: string[];
  reason?: string;
}

/** Full recompute when no ids are given. Never overlaps with another run in this process. */
export const recomputeRankingScores = async (options: RecomputeOptions = {}): Promise<RecomputeSummary> => {
  if (running) throw new RankingRecomputeInProgressError();
  running = runRecompute(options);
  try {
    return await running;
  } finally {
    running = null;
  }
};

export const getLastRecompute = async (): Promise<RecomputeSummary | null> => {
  if (lastSummary) return lastSummary;
  try {
    const row = await prisma.setting.findUnique({ where: { key: RANKING_LAST_RUN_SETTING_KEY } });
    return row ? (JSON.parse(row.value) as RecomputeSummary) : null;
  } catch {
    return null;
  }
};

export const isRecomputeRunning = () => running !== null;

// ─── Preview ─────────────────────────────────────────────────────────────────

const firstImage = (images: string | null): string | null => {
  if (!images) return null;
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
  } catch {
    return null;
  }
};

/** Scores with proposed weights in memory only: nothing is saved and no score is written. */
export const previewRanking = async (proposed: RankingWeights) => {
  const [{ weights: currentWeights }, inputs] = await Promise.all([loadRankingWeights(), loadRankingInputs()]);
  const proposedResult = scoreRankingInputs(inputs, proposed);
  const currentResult = scoreRankingInputs(inputs, currentWeights);
  const currentScore = new Map(currentResult.products.map((p) => [p.productId, p.score]));
  const top = proposedResult.products.slice(0, RECOMPUTE.PREVIEW_SIZE);
  const topVendors = proposedResult.vendors.slice(0, RECOMPUTE.PREVIEW_SIZE);

  const [cards, vendorCards] = await Promise.all([
    top.length
      ? prisma.product.findMany({
          where: { id: { in: top.map((p) => p.productId) } },
          select: { id: true, name: true, nameAr: true, slug: true, images: true, vendor: { select: { id: true, storeName: true } } },
        })
      : Promise.resolve([]),
    topVendors.length
      ? prisma.vendor.findMany({
          where: { id: { in: topVendors.map((v) => v.vendorId) } },
          select: { id: true, storeName: true },
        })
      : Promise.resolve([]),
  ]);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const vendorName = new Map(vendorCards.map((v) => [v.id, v.storeName]));

  return {
    weights: proposed,
    currentWeights,
    lookbackDays: RANKING_LOOKBACK_DAYS,
    productsConsidered: proposedResult.products.length,
    vendorsConsidered: proposedResult.vendors.length,
    products: top.map((p, index) => {
      const card = cardById.get(p.productId);
      return {
        rank: index + 1,
        productId: p.productId,
        name: card?.name ?? null,
        nameAr: card?.nameAr ?? null,
        slug: card?.slug ?? null,
        image: firstImage(card?.images ?? null),
        vendor: card?.vendor ? { id: card.vendor.id, storeName: card.vendor.storeName } : null,
        inStock: p.inStock,
        storedScore: p.storedScore,
        currentWeightsScore: currentScore.get(p.productId) ?? 0,
        previewScore: p.score,
        signals: p.signals,
        contributions: p.contributions,
        featuredContribution: p.contributions.featured,
      };
    }),
    vendors: topVendors.map((v, index) => ({
      rank: index + 1,
      vendorId: v.vendorId,
      storeName: vendorName.get(v.vendorId) ?? null,
      storedScore: v.storedScore,
      score: v.score,
      signals: v.signals,
      contributions: v.contributions,
    })),
  };
};

// ─── Periodic recompute (in-process, no cron/queue) ──────────────────────────

/**
 * RANKING_RECOMPUTE_INTERVAL_MINUTES: unset → 60 in production, off elsewhere; 0 or invalid → off;
 * otherwise at least MIN_INTERVAL_MINUTES. Several instances may each run it; the result is the same
 * deterministic scores, only the work is repeated.
 */
export const resolveRecomputeIntervalMinutes = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.RANKING_RECOMPUTE_INTERVAL_MINUTES;
  if (raw === undefined || raw.trim() === '') {
    return env.NODE_ENV === 'production' ? RECOMPUTE.DEFAULT_PRODUCTION_INTERVAL_MINUTES : 0;
  }
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(RECOMPUTE.MIN_INTERVAL_MINUTES, Math.floor(minutes));
};

let scheduledIntervalMinutes = 0;
export const getScheduledIntervalMinutes = () => scheduledIntervalMinutes;

export const startRankingScheduler = (env: NodeJS.ProcessEnv = process.env) => {
  const minutes = resolveRecomputeIntervalMinutes(env);
  scheduledIntervalMinutes = minutes;
  if (!minutes) return null;

  const run = (reason: string) =>
    recomputeRankingScores({ reason })
      .then((summary) => {
        if (summary.status !== 'success') console.warn(`[ranking] ${reason} recompute finished with status ${summary.status}`);
      })
      .catch((err) => {
        if (!(err instanceof RankingRecomputeInProgressError)) {
          console.error(`[ranking] ${reason} recompute failed:`, errorMessage(err));
        }
      });

  const startup = setTimeout(() => void run('startup'), RECOMPUTE.STARTUP_DELAY_MS);
  const interval = setInterval(() => void run('scheduled'), minutes * 60_000);
  startup.unref();
  interval.unref();
  return {
    stop: () => {
      clearTimeout(startup);
      clearInterval(interval);
    },
  };
};
