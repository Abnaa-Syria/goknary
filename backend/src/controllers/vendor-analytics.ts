import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { calculatePendingEarnings } from '../lib/vendor-earnings';
import { ANALYTICS_LIMITS } from '../lib/merchant-analytics-config';
import { computeChange, computeRateChange } from '../lib/analytics-math';
import {
  PRODUCT_SORTS,
  ProductCard,
  ProductMetrics,
  ProductSort,
  aggregateVendorPeriod,
  countOpenReturnRequests,
  loadInventory,
  loadProductCards,
  loadSearchDemand,
  metricsFor,
  pageProductIds,
  resolveAnalyticsPeriod,
} from '../lib/merchant-analytics';
import { generateMerchantInsights } from '../lib/merchant-insights';

/** The vendor always comes from the authenticated user; a vendorId from the client is never used. */
const resolveVendor = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id },
    select: { id: true, status: true, commissionRate: true },
  });
  if (!vendor) {
    res.status(404).json({ error: 'Vendor not found' });
    return null;
  }
  if (vendor.status !== 'APPROVED') {
    res.status(403).json({ error: 'Vendor account is not approved or is suspended' });
    return null;
  }
  return vendor;
};

const productRef = (card: ProductCard | undefined) => ({
  name: card?.name ?? null,
  nameAr: card?.nameAr ?? null,
  slug: card?.slug ?? null,
  image: card?.image ?? null,
});

const topBy = (metrics: ProductMetrics[], key: 'unitsSold' | 'grossSales' | 'views') =>
  metrics
    .filter((m) => m[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, ANALYTICS_LIMITS.TOP_LIST_SIZE);

export const getVendorAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const vendor = await resolveVendor(req, res);
    if (!vendor) return;

    const period = resolveAnalyticsPeriod(req.query.period);
    const [current, previous, pendingEarnings, openReturnRequests, inventory, searchDemand] = await Promise.all([
      aggregateVendorPeriod(vendor, period.current),
      aggregateVendorPeriod(vendor, period.previous),
      calculatePendingEarnings(vendor.id, vendor.commissionRate),
      countOpenReturnRequests(vendor.id),
      loadInventory(vendor.id),
      loadSearchDemand(vendor.id, period.current),
    ]);
    const s = current.summary;
    const p = previous.summary;

    const productMetrics = Array.from(current.products.values());
    const cards = await loadProductCards(vendor.id, productMetrics.map((m) => m.productId));
    const ownMetrics = productMetrics.filter((m) => cards.has(m.productId));

    // Daily buckets for the whole period (no gaps), realized sales only.
    const salesByDay: { date: string; orders: number; sales: number }[] = [];
    const buckets = new Map<string, { date: string; orders: number; sales: number }>();
    for (let i = 0; i < period.days; i++) {
      const d = new Date(period.current.to);
      d.setDate(d.getDate() - (period.days - 1 - i));
      const bucket = { date: d.toISOString().slice(0, 10), orders: 0, sales: 0 };
      salesByDay.push(bucket);
      buckets.set(bucket.date, bucket);
    }
    for (const sale of current.realizedSales) {
      const bucket = buckets.get(sale.createdAt.toISOString().slice(0, 10));
      if (bucket) {
        bucket.orders += 1;
        bucket.sales = Math.round((bucket.sales + sale.sales) * 100) / 100;
      }
    }

    const bestSellers = topBy(ownMetrics, 'unitsSold').map((m) => ({
      productId: m.productId,
      product: productRef(cards.get(m.productId)),
      quantitySold: m.unitsSold,
      unitsSold: m.unitsSold,
      grossSales: m.grossSales,
    }));

    const insights = generateMerchantInsights({
      summary: s,
      products: ownMetrics.map((m) => ({ ...m, name: cards.get(m.productId)?.name ?? '' })),
      inventory,
      searchDemand,
    });

    res.json({
      summary: {
        // Existing keys (unchanged meaning).
        totalOrders: s.totalOrders,
        deliveredOrders: s.deliveredOrders,
        totalSales: s.grossSales,
        pendingOrders: s.pendingOrders,
        pendingSales: s.pendingSales,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        deliveredEarnings: s.vendorEarnings,
        period: `${period.days} days`,
        // F3 additions.
        periodDays: period.days,
        grossSales: s.grossSales,
        refundedAmount: s.refundedAmount,
        netSales: s.netSales,
        vendorEarnings: s.vendorEarnings,
        averageOrderValue: s.averageOrderValue,
        inProgressOrders: s.inProgressOrders,
        cancelledOrders: s.cancelledOrders,
        cancellationRate: s.cancellationRate,
        unitsSold: s.unitsSold,
        returnedQuantity: s.returnedQuantity,
        returnRate: s.returnRate,
        openReturnRequests,
        views: s.views,
        uniqueViewers: s.uniqueViewers,
        cartActions: s.cartActions,
        unitsAddedToCart: s.unitsAddedToCart,
        cartCustomers: s.cartCustomers,
        wishlistAdds: s.wishlistAdds,
        wishlistCustomers: s.wishlistCustomers,
        purchasingCustomers: s.purchasingCustomers,
        conversionRate: s.conversionRate,
        addToCartRate: s.addToCartRate,
        wishlistRate: s.wishlistRate,
        lowStockCount: inventory.lowStockCount,
        outOfStockCount: inventory.outOfStockCount,
      },
      range: {
        current: { from: period.current.from.toISOString(), to: period.current.to.toISOString() },
        previous: { from: period.previous.from.toISOString(), to: period.previous.to.toISOString() },
      },
      trends: {
        grossSales: computeChange(s.grossSales, p.grossSales),
        netSales: computeChange(s.netSales, p.netSales),
        refundedAmount: computeChange(s.refundedAmount, p.refundedAmount),
        vendorEarnings: computeChange(s.vendorEarnings, p.vendorEarnings),
        totalOrders: computeChange(s.totalOrders, p.totalOrders),
        deliveredOrders: computeChange(s.deliveredOrders, p.deliveredOrders),
        cancelledOrders: computeChange(s.cancelledOrders, p.cancelledOrders),
        unitsSold: computeChange(s.unitsSold, p.unitsSold),
        views: computeChange(s.views, p.views),
        uniqueViewers: computeChange(s.uniqueViewers, p.uniqueViewers),
        cartCustomers: computeChange(s.cartCustomers, p.cartCustomers),
        wishlistCustomers: computeChange(s.wishlistCustomers, p.wishlistCustomers),
        purchasingCustomers: computeChange(s.purchasingCustomers, p.purchasingCustomers),
        conversionRate: computeRateChange(s.conversionRate, p.conversionRate),
        addToCartRate: computeRateChange(s.addToCartRate, p.addToCartRate),
        wishlistRate: computeRateChange(s.wishlistRate, p.wishlistRate),
        returnRate: computeRateChange(s.returnRate, p.returnRate),
        cancellationRate: computeRateChange(s.cancellationRate, p.cancellationRate),
      },
      funnel: {
        viewers: s.uniqueViewers,
        cartCustomers: s.cartCustomers,
        purchasingCustomers: s.purchasingCustomers,
        viewToCartRate: s.addToCartRate,
        cartToPurchaseRate: s.cartCustomers > 0 ? Math.round((s.purchasingCustomers / s.cartCustomers) * 1000) / 10 : null,
        viewToPurchaseRate: s.conversionRate,
      },
      ordersByStatus: current.ordersByStatus,
      salesByDay,
      topProducts: bestSellers,
      topProductsByRevenue: topBy(ownMetrics, 'grossSales').map((m) => ({
        productId: m.productId,
        product: productRef(cards.get(m.productId)),
        grossSales: m.grossSales,
        unitsSold: m.unitsSold,
      })),
      mostViewed: topBy(ownMetrics, 'views').map((m) => ({
        productId: m.productId,
        product: productRef(cards.get(m.productId)),
        views: m.views,
        uniqueViewers: m.uniqueViewers,
        conversionRate: m.conversionRate,
      })),
      inventory,
      searchDemand,
      insights,
    });
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// GET /api/vendor/analytics/products?period=&page=&limit=&sort=
export const getVendorProductAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const vendor = await resolveVendor(req, res);
    if (!vendor) return;

    const period = resolveAnalyticsPeriod(req.query.period);
    const page = Math.max(1, parseInt(String(req.query.page ?? ''), 10) || 1);
    const limit = Math.min(
      Math.max(1, parseInt(String(req.query.limit ?? ''), 10) || ANALYTICS_LIMITS.PRODUCT_TABLE_DEFAULT_LIMIT),
      ANALYTICS_LIMITS.PRODUCT_TABLE_MAX_LIMIT
    );
    const sort: ProductSort = (PRODUCT_SORTS as readonly string[]).includes(String(req.query.sort))
      ? (req.query.sort as ProductSort)
      : 'views';

    const aggregate = await aggregateVendorPeriod(vendor, period.current);
    const { ids, total } = await pageProductIds(vendor.id, aggregate.products, sort, page, limit);
    const cards = await loadProductCards(vendor.id, ids);

    const products = ids
      .map((id) => cards.get(id))
      .filter((card): card is ProductCard => !!card)
      .map((card) => {
        const m = metricsFor(aggregate.products, card.id);
        return {
          productId: card.id,
          name: card.name,
          nameAr: card.nameAr,
          slug: card.slug,
          image: card.image,
          status: card.status,
          stock: card.stock,
          lowStockThreshold: card.lowStockThreshold,
          hasVariants: card.hasVariants,
          views: m.views,
          uniqueViewers: m.uniqueViewers,
          cartCustomers: m.cartCustomers,
          wishlistCustomers: m.wishlistCustomers,
          purchasingCustomers: m.purchasingCustomers,
          unitsSold: m.unitsSold,
          grossSales: m.grossSales,
          conversionRate: m.conversionRate,
          addToCartRate: m.addToCartRate,
          wishlistRate: m.wishlistRate,
          returnedQuantity: m.returnedQuantity,
          returnRate: m.returnRate,
        };
      });

    res.json({
      products,
      sort,
      period: { days: period.days, from: period.current.from.toISOString(), to: period.current.to.toISOString() },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching vendor product analytics:', error);
    res.status(500).json({ error: 'Failed to fetch product analytics' });
  }
};
