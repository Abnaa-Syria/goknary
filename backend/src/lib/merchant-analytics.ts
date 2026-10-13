import { prisma } from './prisma';
import {
  IN_FLIGHT_ORDER_STATUSES,
  calculateVendorNetEarnings,
  countsTowardPendingEarnings,
  getVendorEarningsBase,
  isOrderFinanciallyConfirmed,
} from './vendor-earnings';
import { RefundKind, itemNetPaid, storedStatusesFor } from './refund-workflow';
import { PUBLIC_PRODUCT_STATUSES } from './visibility';
import { ANALYTICS_LIMITS, SEARCH_DEMAND } from './merchant-analytics-config';
import { round2, safeRate } from './analytics-math';

/**
 * Vendor analytics (F3). Sources of truth:
 * - Money, orders, units: Order / OrderItem (never UserEvent PURCHASE).
 * - Returns and refunds: RefundRequest (completed = REFUNDED or legacy ADMIN_APPROVED).
 * - Views, carts, wishlists: UserEvent (logged-in customers only, see lib/user-events.ts).
 * - Search demand: SearchLog, aggregated and matched against the vendor's own catalog.
 * Every query is grouped per vendor; nothing runs once per product.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsPeriod {
  days: number;
  current: DateRange;
  /** The equally long window that ends where the current one starts. */
  previous: DateRange;
}

export const resolveAnalyticsPeriod = (raw: unknown, now: Date = new Date()): AnalyticsPeriod => {
  const days = Math.min(
    Math.max(parseInt(String(raw ?? ''), 10) || ANALYTICS_LIMITS.DEFAULT_PERIOD_DAYS, 1),
    ANALYTICS_LIMITS.MAX_PERIOD_DAYS
  );
  const currentFrom = new Date(now.getTime() - days * DAY_MS);
  return {
    days,
    current: { from: currentFrom, to: now },
    previous: { from: new Date(currentFrom.getTime() - days * DAY_MS), to: currentFrom },
  };
};

const inRange = (range: DateRange) => ({ gte: range.from, lt: range.to });

export const COMPLETED_REFUND_STATUSES = storedStatusesFor(['REFUNDED']);
export const OPEN_REFUND_STATUSES = storedStatusesFor([
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ITEM_RECEIVED',
  'REFUND_PROCESSING',
]);

/** Sales are realized when the order is delivered and its payment is confirmed (COD or PAID). */
export const isRealizedSale = (order: { status: string; paymentMethod: string | null; paymentStatus: string | null }) =>
  order.status === 'DELIVERED' && isOrderFinanciallyConfirmed(order);

/** A purchase counts for conversion once confirmed (COD at creation, Kashier when PAID) and not cancelled. */
export const isConfirmedPurchase = (order: { status: string; paymentMethod: string | null; paymentStatus: string | null }) =>
  order.status !== 'CANCELLED' && isOrderFinanciallyConfirmed(order);

export interface ProductMetrics {
  productId: string;
  views: number;
  uniqueViewers: number;
  cartActions: number;
  unitsAddedToCart: number;
  cartCustomers: number;
  wishlistAdds: number;
  wishlistCustomers: number;
  purchasingCustomers: number;
  unitsSold: number;
  grossSales: number;
  returnedQuantity: number;
  refundedAmount: number;
  conversionRate: number | null;
  addToCartRate: number | null;
  wishlistRate: number | null;
  returnRate: number | null;
}

export interface PeriodSummary {
  totalOrders: number;
  /** Realized orders: delivered and financially confirmed (the historical `deliveredOrders`). */
  deliveredOrders: number;
  inProgressOrders: number;
  cancelledOrders: number;
  cancellationRate: number | null;
  pendingOrders: number;
  pendingSales: number;
  grossSales: number;
  refundedAmount: number;
  netSales: number;
  vendorEarnings: number;
  averageOrderValue: number | null;
  unitsSold: number;
  returnedQuantity: number;
  returnRate: number | null;
  views: number;
  uniqueViewers: number;
  cartActions: number;
  unitsAddedToCart: number;
  cartCustomers: number;
  wishlistAdds: number;
  wishlistCustomers: number;
  purchasingCustomers: number;
  conversionRate: number | null;
  addToCartRate: number | null;
  wishlistRate: number | null;
}

export interface PeriodAggregate {
  summary: PeriodSummary;
  ordersByStatus: Array<{ status: string; count: number }>;
  products: Map<string, ProductMetrics>;
  realizedSales: Array<{ createdAt: Date; sales: number }>;
}

interface MutableProduct {
  views: number;
  uniqueViewers: number;
  cartActions: number;
  unitsAddedToCart: number;
  cartUsers: Set<string>;
  wishlistAdds: number;
  wishlistCustomers: number;
  purchasers: Set<string>;
  unitsSold: number;
  grossSales: number;
  returnedQuantity: number;
  refundedAmount: number;
}

const newMutable = (): MutableProduct => ({
  views: 0,
  uniqueViewers: 0,
  cartActions: 0,
  unitsAddedToCart: 0,
  cartUsers: new Set(),
  wishlistAdds: 0,
  wishlistCustomers: 0,
  purchasers: new Set(),
  unitsSold: 0,
  grossSales: 0,
  returnedQuantity: 0,
  refundedAmount: 0,
});

const cartQuantity = (metadata: string | null): number => {
  if (!metadata) return 1;
  try {
    const quantity = JSON.parse(metadata)?.quantity;
    return typeof quantity === 'number' && quantity > 0 ? quantity : 1;
  } catch {
    return 1;
  }
};

export const aggregateVendorPeriod = async (
  vendor: { id: string; commissionRate: number | null },
  range: DateRange
): Promise<PeriodAggregate> => {
  const eventWhere = (type: string) => ({ vendorId: vendor.id, type, createdAt: inRange(range) });

  const [orders, completedReturns, viewPairs, wishlistPairs, cartEvents] = await Promise.all([
    prisma.order.findMany({
      where: { vendorId: vendor.id, createdAt: inRange(range) },
      select: {
        id: true,
        userId: true,
        status: true,
        total: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        items: { select: { productId: true, quantity: true, price: true, discountPrice: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Attributed to the period of the order they belong to, so they line up with that order's sales.
    prisma.refundRequest.findMany({
      where: {
        vendorId: vendor.id,
        kind: RefundKind.RETURN,
        status: { in: COMPLETED_REFUND_STATUSES },
        order: { createdAt: inRange(range) },
      },
      select: { orderId: true, quantity: true, amount: true, orderItem: { select: { productId: true } } },
    }),
    prisma.userEvent.groupBy({
      by: ['productId', 'userId'],
      where: eventWhere('PRODUCT_VIEW'),
      _count: { _all: true },
    }),
    prisma.userEvent.groupBy({
      by: ['productId', 'userId'],
      where: eventWhere('ADD_TO_WISHLIST'),
      _count: { _all: true },
    }),
    prisma.userEvent.findMany({
      where: eventWhere('ADD_TO_CART'),
      select: { productId: true, userId: true, metadata: true },
    }),
  ]);

  const products = new Map<string, MutableProduct>();
  const productOf = (productId: string) => {
    let entry = products.get(productId);
    if (!entry) {
      entry = newMutable();
      products.set(productId, entry);
    }
    return entry;
  };

  let deliveredOrders = 0;
  let inProgressOrders = 0;
  let cancelledOrders = 0;
  let pendingOrders = 0;
  let pendingSales = 0;
  let grossSales = 0;
  let vendorEarnings = 0;
  let unitsSold = 0;
  const purchasers = new Set<string>();
  const realizedOrderIds = new Set<string>();
  const realizedSales: PeriodAggregate['realizedSales'] = [];
  const statusCounts = new Map<string, number>();

  for (const order of orders) {
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
    if (order.status === 'CANCELLED') cancelledOrders++;
    if ((IN_FLIGHT_ORDER_STATUSES as readonly string[]).includes(order.status)) inProgressOrders++;
    if (countsTowardPendingEarnings(order)) {
      pendingOrders++;
      pendingSales += getVendorEarningsBase(order);
    }

    if (isConfirmedPurchase(order)) {
      purchasers.add(order.userId);
      for (const item of order.items) productOf(item.productId).purchasers.add(order.userId);
    }

    if (isRealizedSale(order)) {
      const base = getVendorEarningsBase(order);
      deliveredOrders++;
      grossSales += base;
      vendorEarnings += calculateVendorNetEarnings(base, vendor.commissionRate).netEarnings;
      realizedOrderIds.add(order.id);
      realizedSales.push({ createdAt: order.createdAt, sales: base });
      for (const item of order.items) {
        const product = productOf(item.productId);
        product.unitsSold += item.quantity;
        product.grossSales += itemNetPaid(item, order);
        unitsSold += item.quantity;
      }
    }
  }

  let refundedAmount = 0;
  let returnedQuantity = 0;
  for (const refund of completedReturns) {
    if (!realizedOrderIds.has(refund.orderId)) continue;
    refundedAmount += refund.amount;
    returnedQuantity += refund.quantity;
    if (refund.orderItem?.productId) {
      const product = productOf(refund.orderItem.productId);
      product.returnedQuantity += refund.quantity;
      product.refundedAmount += refund.amount;
    }
  }

  const viewers = new Set<string>();
  let views = 0;
  for (const row of viewPairs) {
    if (!row.productId) continue;
    const product = productOf(row.productId);
    product.views += row._count._all;
    product.uniqueViewers++;
    views += row._count._all;
    viewers.add(row.userId);
  }

  const wishlistUsers = new Set<string>();
  let wishlistAdds = 0;
  for (const row of wishlistPairs) {
    if (!row.productId) continue;
    const product = productOf(row.productId);
    product.wishlistAdds += row._count._all;
    product.wishlistCustomers++;
    wishlistAdds += row._count._all;
    wishlistUsers.add(row.userId);
  }

  const cartUsers = new Set<string>();
  let unitsAddedToCart = 0;
  for (const event of cartEvents) {
    if (!event.productId) continue;
    const quantity = cartQuantity(event.metadata);
    const product = productOf(event.productId);
    product.cartActions++;
    product.unitsAddedToCart += quantity;
    product.cartUsers.add(event.userId);
    unitsAddedToCart += quantity;
    cartUsers.add(event.userId);
  }

  const finalized = new Map<string, ProductMetrics>();
  for (const [productId, p] of products) {
    finalized.set(productId, {
      productId,
      views: p.views,
      uniqueViewers: p.uniqueViewers,
      cartActions: p.cartActions,
      unitsAddedToCart: p.unitsAddedToCart,
      cartCustomers: p.cartUsers.size,
      wishlistAdds: p.wishlistAdds,
      wishlistCustomers: p.wishlistCustomers,
      purchasingCustomers: p.purchasers.size,
      unitsSold: p.unitsSold,
      grossSales: round2(p.grossSales),
      returnedQuantity: p.returnedQuantity,
      refundedAmount: round2(p.refundedAmount),
      conversionRate: safeRate(p.purchasers.size, p.uniqueViewers),
      addToCartRate: safeRate(p.cartUsers.size, p.uniqueViewers),
      wishlistRate: safeRate(p.wishlistCustomers, p.uniqueViewers),
      returnRate: safeRate(p.returnedQuantity, p.unitsSold),
    });
  }

  const summary: PeriodSummary = {
    totalOrders: orders.length,
    deliveredOrders,
    inProgressOrders,
    cancelledOrders,
    cancellationRate: safeRate(cancelledOrders, orders.length),
    pendingOrders,
    pendingSales: round2(pendingSales),
    grossSales: round2(grossSales),
    refundedAmount: round2(refundedAmount),
    netSales: round2(grossSales - refundedAmount),
    vendorEarnings: round2(vendorEarnings),
    averageOrderValue: deliveredOrders > 0 ? round2(grossSales / deliveredOrders) : null,
    unitsSold,
    returnedQuantity,
    returnRate: safeRate(returnedQuantity, unitsSold),
    views,
    uniqueViewers: viewers.size,
    cartActions: cartEvents.length,
    unitsAddedToCart,
    cartCustomers: cartUsers.size,
    wishlistAdds,
    wishlistCustomers: wishlistUsers.size,
    purchasingCustomers: purchasers.size,
    conversionRate: safeRate(purchasers.size, viewers.size),
    addToCartRate: safeRate(cartUsers.size, viewers.size),
    wishlistRate: safeRate(wishlistUsers.size, viewers.size),
  };

  return {
    summary,
    ordersByStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
    products: finalized,
    realizedSales,
  };
};

/** Current snapshot (not period-bound): return requests that still await a decision or refund. */
export const countOpenReturnRequests = (vendorId: string) =>
  prisma.refundRequest.count({
    where: { vendorId, kind: RefundKind.RETURN, status: { in: OPEN_REFUND_STATUSES } },
  });

// ─── Product cards ───────────────────────────────────────────────────────────

export interface ProductCard {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  image: string | null;
  stock: number;
  status: string;
  hasVariants: boolean;
  lowStockThreshold: number;
}

const firstImage = (images: string | null): string | null => {
  if (!images) return null;
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
  } catch {
    return null;
  }
};

const productCardSelect = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  images: true,
  stock: true,
  status: true,
  hasVariants: true,
  lowStockThreshold: true,
} as const;

const toCard = (p: {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  images: string;
  stock: number;
  status: string;
  hasVariants: boolean;
  lowStockThreshold: number;
}): ProductCard => ({
  id: p.id,
  name: p.name,
  nameAr: p.nameAr,
  slug: p.slug,
  image: firstImage(p.images),
  stock: p.stock,
  status: p.status,
  hasVariants: p.hasVariants,
  lowStockThreshold: p.lowStockThreshold,
});

/** One query for any set of the vendor's products (ids of other vendors are ignored). */
export const loadProductCards = async (vendorId: string, ids: string[]): Promise<Map<string, ProductCard>> => {
  if (ids.length === 0) return new Map();
  const rows = await prisma.product.findMany({
    where: { vendorId, id: { in: ids } },
    select: productCardSelect,
  });
  return new Map(rows.map((row) => [row.id, toCard(row)]));
};

// ─── Product performance table ───────────────────────────────────────────────

export const PRODUCT_SORTS = ['views', 'sales', 'units', 'conversion', 'returns', 'stock'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const SORT_VALUE: Record<Exclude<ProductSort, 'stock'>, (m: ProductMetrics) => number | null> = {
  views: (m) => m.views,
  sales: (m) => m.grossSales,
  units: (m) => m.unitsSold,
  conversion: (m) => m.conversionRate,
  returns: (m) => m.returnRate,
};

/**
 * Pagination without loading the whole catalog:
 * - `stock` is a column, so the database sorts and pages it.
 * - Metric sorts rank only the products that have activity in the period (already aggregated per
 *   vendor); products without activity follow, paged by the database in newest-first order.
 */
export const pageProductIds = async (
  vendorId: string,
  metrics: Map<string, ProductMetrics>,
  sort: ProductSort,
  page: number,
  limit: number
): Promise<{ ids: string[]; total: number }> => {
  const skip = (page - 1) * limit;
  const total = await prisma.product.count({ where: { vendorId } });

  if (sort === 'stock') {
    const rows = await prisma.product.findMany({
      where: { vendorId },
      orderBy: [{ stock: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: { id: true },
    });
    return { ids: rows.map((r) => r.id), total };
  }

  const value = SORT_VALUE[sort];
  const candidates = Array.from(metrics.values()).filter((m) => {
    const v = value(m);
    return v !== null && v > 0;
  });
  const owned = new Set(
    candidates.length === 0
      ? []
      : (
          await prisma.product.findMany({
            where: { vendorId, id: { in: candidates.map((m) => m.productId) } },
            select: { id: true },
          })
        ).map((r) => r.id)
  );
  const ranked = candidates
    .filter((m) => owned.has(m.productId))
    .sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0) || b.views - a.views || b.unitsSold - a.unitsSold)
    .map((m) => m.productId);

  const ids = ranked.slice(skip, skip + limit);
  if (ids.length < limit) {
    const rest = await prisma.product.findMany({
      where: { vendorId, id: { notIn: ranked } },
      orderBy: { createdAt: 'desc' },
      skip: Math.max(0, skip - ranked.length),
      take: limit - ids.length,
      select: { id: true },
    });
    ids.push(...rest.map((r) => r.id));
  }
  return { ids, total };
};

const emptyMetrics = (productId: string): ProductMetrics => ({
  productId,
  views: 0,
  uniqueViewers: 0,
  cartActions: 0,
  unitsAddedToCart: 0,
  cartCustomers: 0,
  wishlistAdds: 0,
  wishlistCustomers: 0,
  purchasingCustomers: 0,
  unitsSold: 0,
  grossSales: 0,
  returnedQuantity: 0,
  refundedAmount: 0,
  conversionRate: null,
  addToCartRate: null,
  wishlistRate: null,
  returnRate: null,
});

export const metricsFor = (metrics: Map<string, ProductMetrics>, productId: string) =>
  metrics.get(productId) ?? emptyMetrics(productId);

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryItem {
  productId: string;
  name: string;
  nameAr: string | null;
  image: string | null;
  stock: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  soldOutOptions: number;
}

export interface InventorySnapshot {
  lowStockCount: number;
  outOfStockCount: number;
  lowStock: InventoryItem[];
  outOfStock: InventoryItem[];
  /** Variant products that still have stock overall but some active options are sold out. */
  partiallySoldOut: InventoryItem[];
}

/**
 * Sellable (published) products only. Product.stock is the inventory for both plain and variant
 * products: for variant products it is kept equal to the sum of active variant stock (F5 contract).
 * Each product's own lowStockThreshold is used.
 */
export const loadInventory = async (vendorId: string): Promise<InventorySnapshot> => {
  const sellable = { vendorId, status: { in: PUBLIC_PRODUCT_STATUSES } };
  const lowWhere = { ...sellable, stock: { gt: 0, lte: prisma.product.fields.lowStockThreshold } };
  const outWhere = { ...sellable, stock: { lte: 0 } };
  const size = ANALYTICS_LIMITS.INVENTORY_LIST_SIZE;

  const [lowStockCount, outOfStockCount, lowRows, outRows, soldOutVariantGroups] = await Promise.all([
    prisma.product.count({ where: lowWhere }),
    prisma.product.count({ where: outWhere }),
    prisma.product.findMany({ where: lowWhere, orderBy: { stock: 'asc' }, take: size, select: productCardSelect }),
    prisma.product.findMany({ where: outWhere, orderBy: { updatedAt: 'desc' }, take: size, select: productCardSelect }),
    prisma.productVariant.groupBy({
      by: ['productId'],
      where: { status: true, stock: { lte: 0 }, product: { ...sellable, hasVariants: true, stock: { gt: 0 } } },
      _count: { _all: true },
    }),
  ]);

  const soldOut = new Map(soldOutVariantGroups.map((g) => [g.productId, g._count._all]));
  const partialIds = Array.from(soldOut.keys()).slice(0, size);
  const partialCards = await loadProductCards(vendorId, partialIds);

  const toItem = (card: ProductCard): InventoryItem => ({
    productId: card.id,
    name: card.name,
    nameAr: card.nameAr,
    image: card.image,
    stock: card.stock,
    lowStockThreshold: card.lowStockThreshold,
    hasVariants: card.hasVariants,
    soldOutOptions: soldOut.get(card.id) ?? 0,
  });

  return {
    lowStockCount,
    outOfStockCount,
    lowStock: lowRows.map((r) => toItem(toCard(r))),
    outOfStock: outRows.map((r) => toItem(toCard(r))),
    partiallySoldOut: partialIds.map((id) => partialCards.get(id)).filter((c): c is ProductCard => !!c).map(toItem),
  };
};

// ─── Search demand ───────────────────────────────────────────────────────────

export interface SearchDemandItem {
  query: string;
  searches: number;
  averageResults: number;
  lowResults: boolean;
  /** Words of the vendor's own catalog that the query matched. */
  matchedTerms: string[];
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'new', 'best', 'cheap', 'buy', 'sale', 'offer', 'from',
  'في', 'من', 'على', 'الى', 'إلى', 'عن', 'مع', 'جديد', 'رخيص', 'افضل', 'أفضل', 'عرض',
]);

export const normalizeSearchText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

export const tokenize = (text: string | null | undefined): string[] =>
  text
    ? normalizeSearchText(text)
        .split(/\s+/)
        .filter((t) => t.length >= SEARCH_DEMAND.MIN_TOKEN_LENGTH && !STOP_WORDS.has(t))
    : [];

/** Exact word match, or a shared prefix for words of 4+ letters (lamp / lamps, light / lighting). */
const matchTerm = (token: string, vocabulary: Set<string>): string | null => {
  if (vocabulary.has(token)) return token;
  if (token.length < 4) return null;
  for (const word of vocabulary) {
    if (word.length >= 4 && (word.startsWith(token) || token.startsWith(word))) return word;
  }
  return null;
};

/**
 * Platform searches (aggregated SearchLog rows only, never user ids) that relate to the vendor's
 * catalog vocabulary: product names, category names and brand names.
 */
export const loadSearchDemand = async (vendorId: string, range: DateRange): Promise<SearchDemandItem[]> => {
  const [catalog, queryGroups] = await Promise.all([
    prisma.product.findMany({
      where: { vendorId, status: { in: PUBLIC_PRODUCT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_DEMAND.CATALOG_SAMPLE,
      select: {
        name: true,
        nameAr: true,
        category: { select: { name: true, nameAr: true } },
        brand: { select: { name: true, nameAr: true } },
      },
    }),
    prisma.searchLog.groupBy({
      by: ['query'],
      where: { createdAt: inRange(range) },
      _count: { _all: true },
      _avg: { results: true },
      orderBy: { _count: { query: 'desc' } },
      take: SEARCH_DEMAND.CANDIDATE_QUERIES,
    }),
  ]);
  if (catalog.length === 0) return [];

  const vocabulary = new Set<string>();
  for (const p of catalog) {
    for (const text of [p.name, p.nameAr, p.category?.name, p.category?.nameAr, p.brand?.name, p.brand?.nameAr]) {
      tokenize(text).forEach((t) => vocabulary.add(t));
    }
  }

  const items: SearchDemandItem[] = [];
  for (const group of queryGroups) {
    const searches = group._count._all;
    if (searches < SEARCH_DEMAND.MIN_SEARCHES) continue;
    const matched = new Set<string>();
    for (const token of tokenize(group.query)) {
      const term = matchTerm(token, vocabulary);
      if (term) matched.add(term);
    }
    if (matched.size === 0) continue;
    const averageResults = Math.round((group._avg.results ?? 0) * 10) / 10;
    items.push({
      query: group.query.trim().slice(0, 100),
      searches,
      averageResults,
      lowResults: averageResults <= SEARCH_DEMAND.LOW_RESULTS,
      matchedTerms: Array.from(matched).slice(0, 5),
    });
  }
  return items.sort((a, b) => b.searches - a.searches).slice(0, SEARCH_DEMAND.MAX_RESULTS);
};
