import { prisma } from './prisma';
import { NotFoundError } from './errors';
import { IN_FLIGHT_ORDER_STATUSES, isOrderFinanciallyConfirmed } from './vendor-earnings';
import {
  itemNetPaid,
  toCurrentRefundStatus,
} from './refund-workflow';
import { isConfirmedPurchase, isRealizedSale } from './merchant-analytics';
import { parseImageMetadata, parseStoredImages } from './product-images';
import { VariantAttribute, getUnitPrice, parseVariantAttributes } from './variants';
import { round2, safeRate } from './analytics-math';
import { shortId } from './notify';
import { getCategoryAncestors, loadAllCategories } from './category-tree';
import { isLiveStatus } from './product-moderation';

export interface CommandCenterOptions {
  isPlatformStaff: boolean;
  vendorIdConstraint?: string;
}

const parseStoredVariantSnapshot = (raw: string | null | undefined) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      variantId: parsed.variantId ?? null,
      sku: parsed.sku ?? null,
      name: parsed.name ?? null,
      nameAr: parsed.nameAr ?? null,
      attributes: parseVariantAttributes(parsed.attributeList ?? parsed.attributes),
      image: parsed.image ?? null,
      imageAlt: parsed.imageAlt ?? null,
      imageAltAr: parsed.imageAltAr ?? null,
      price: parsed.price ?? null,
      discountPrice: parsed.discountPrice ?? null,
    };
  } catch {
    return null;
  }
};

const cartQuantity = (metadata: string | null): number => {
  if (!metadata) return 1;
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed?.quantity === 'number' && parsed.quantity > 0 ? parsed.quantity : 1;
  } catch {
    return 1;
  }
};

export const getProductCommandCenterData = async (
  productId: string,
  options: CommandCenterOptions
) => {
  // 1. Fetch product with its primary relations
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeNameAr: true,
          slug: true,
          status: true,
          commissionRate: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
        },
      },
      variants: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Enforce vendor ownership (safe 404 behavior)
  if (options.vendorIdConstraint && product.vendorId !== options.vendorIdConstraint) {
    throw new NotFoundError('Product not found');
  }

  // 2. Fetch parallel data sets:
  // - Category tree ancestors
  // - Reviewer info (platform staff only)
  // - Recent orders: BOUNDED to 5 newest records from DB directly
  // - Sales order items: for exact financial aggregation (itemNetPaid coupon prorating) and historical variant snapshot grouping (no user join)
  // - Recent returns: BOUNDED to 5 newest records from DB directly
  // - Return status groups: fully aggregated in DB via groupBy & sum/count (zero historical rows loaded)
  // - Logged-in customer user events: views (groupBy), wishlist (groupBy), carts (findMany for json quantity metadata)
  const [
    allCategories,
    reviewer,
    recentOrderItems,
    salesOrderItems,
    recentRefundRequests,
    returnStatusGroups,
    viewStats,
    cartEvents,
    wishlistStats,
  ] = await Promise.all([
    loadAllCategories(),
    options.isPlatformStaff && product.reviewedBy
      ? prisma.user.findUnique({
        where: { id: product.reviewedBy },
        select: { id: true, name: true, email: true },
      })
      : null,
    // 1. Bounded Recent Unique Orders (take 5 distinct orders containing this product directly from database)
    prisma.order.findMany({
      where: {
        items: {
          some: { productId },
        },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        subtotal: true,
        discountAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            ...(options.isPlatformStaff ? { email: true } : {}),
          },
        },
        items: {
          where: { productId },
          select: {
            id: true,
            quantity: true,
            price: true,
            discountPrice: true,
            variantId: true,
            variantInfo: true,
            createdAt: true,
          },
        },
      },
    }),
    // 2. Sales aggregation dataset: order items without user join, needed for coupon prorating (itemNetPaid) and variantInfo snapshot parsing
    prisma.orderItem.findMany({
      where: { productId },
      select: {
        quantity: true,
        price: true,
        discountPrice: true,
        variantId: true,
        variantInfo: true,
        order: {
          select: {
            id: true,
            status: true,
            subtotal: true,
            discountAmount: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
            userId: true,
          },
        },
      },
    }),
    // 3. Bounded Recent Returns (take 5 directly from database)
    prisma.refundRequest.findMany({
      where: {
        orderItem: { productId },
        kind: 'RETURN',
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        quantity: true,
        amount: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
        receivedAt: true,
        refundedAt: true,
        orderItem: {
          select: {
            variantInfo: true,
          },
        },
      },
    }),
    // 4. Returns DB-side aggregation (bounded to distinct statuses in DB)
    prisma.refundRequest.groupBy({
      by: ['status'],
      where: {
        orderItem: { productId },
        kind: 'RETURN',
      },
      _sum: {
        quantity: true,
        amount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.userEvent.groupBy({
      by: ['userId'],
      where: { productId, type: 'PRODUCT_VIEW' },
      _count: { _all: true },
    }),
    prisma.userEvent.findMany({
      where: { productId, type: 'ADD_TO_CART' },
      select: { userId: true, metadata: true },
    }),
    prisma.userEvent.groupBy({
      by: ['userId'],
      where: { productId, type: 'ADD_TO_WISHLIST' },
      _count: { _all: true },
    }),
  ]);

  // 3. Process Product Overview & Visuals
  const gallery = parseStoredImages(product.images);
  const metadataList = parseImageMetadata(product.imageMetadata);
  const mainImage = gallery[0] ?? null;
  const mainImageAltEntry = mainImage ? metadataList.find((m) => m.url === mainImage) : undefined;
  const isLive = isLiveStatus(product.status) && product.vendor.status === 'APPROVED';

  const categoryAncestors = getCategoryAncestors(allCategories, product.categoryId).map(
    ({ id, name, nameAr, slug }) => ({ id, name, nameAr, slug })
  );

  // 4. Process Variants & Inventory
  const activeVariants = product.variants.filter((v) => v.status);
  const defaultVariantRecord = activeVariants.find((v) => v.isDefault) ?? activeVariants[0] ?? null;

  const formattedVariants = product.variants.map((v) => {
    const isOutOfStock = v.stock <= 0;
    const isLowStock = v.stock > 0 && v.stock <= product.lowStockThreshold;
    const isInStock = v.stock > product.lowStockThreshold;
    const effectivePrice = v.discountPrice ?? v.price;
    return {
      id: v.id,
      name: v.name,
      nameAr: v.nameAr,
      sku: v.sku,
      price: v.price,
      discountPrice: v.discountPrice,
      effectivePrice,
      stock: v.stock,
      status: v.status,
      isDefault: v.isDefault,
      image: v.image,
      imageAlt: v.imageAlt,
      imageAltAr: v.imageAltAr,
      attributes: parseVariantAttributes(v.attributes),
      isInStock,
      isLowStock,
      isOutOfStock,
      isInactive: !v.status,
      stockStatus: !v.status ? 'INACTIVE' : isOutOfStock ? 'OUT_OF_STOCK' : isLowStock ? 'LOW_STOCK' : 'IN_STOCK',
    };
  });

  const outOfStockVariantCount = formattedVariants.filter((v) => v.isOutOfStock).length;
  const lowStockVariantCount = formattedVariants.filter((v) => v.isLowStock).length;

  // 5. Aggregate Sales & Recent Orders
  let deliveredUnitsSold = 0;
  let realizedRevenue = 0;
  let inFlightUnits = 0;
  let lastPurchasedAt: Date | null = null;
  const qualifyingOrderIds = new Set<string>();
  const totalOrderIds = new Set<string>();
  const confirmedPurchaserUserIds = new Set<string>();

  interface VariantSalesAgg {
    variantKey: string;
    variantId: string | null;
    name: string;
    nameAr: string | null;
    sku: string;
    attributes: VariantAttribute[];
    unitsSold: number;
    realizedRevenue: number;
    orderCount: number;
    orderIds: Set<string>;
  }

  const variantSalesMap = new Map<string, VariantSalesAgg>();

  for (const item of salesOrderItems) {
    const order = item.order;
    totalOrderIds.add(order.id);

    if (order.status !== 'CANCELLED') {
      if (!lastPurchasedAt || order.createdAt > lastPurchasedAt) {
        lastPurchasedAt = order.createdAt;
      }
    }

    if (isConfirmedPurchase(order)) {
      confirmedPurchaserUserIds.add(order.userId);
    }

    if ((IN_FLIGHT_ORDER_STATUSES as readonly string[]).includes(order.status)) {
      inFlightUnits += item.quantity;
    }

    if (isRealizedSale(order)) {
      qualifyingOrderIds.add(order.id);
      deliveredUnitsSold += item.quantity;
      const netPaid = itemNetPaid(item, order);
      realizedRevenue += netPaid;

      // Group sales by historical variant snapshot
      const snapshot = parseStoredVariantSnapshot(item.variantInfo);
      const variantKey =
        item.variantId ||
        snapshot?.sku ||
        snapshot?.name ||
        'standard';

      let agg = variantSalesMap.get(variantKey);
      if (!agg) {
        agg = {
          variantKey,
          variantId: item.variantId,
          name: snapshot?.name || product.name,
          nameAr: snapshot?.nameAr || product.nameAr,
          sku: snapshot?.sku || product.sku,
          attributes: snapshot?.attributes || [],
          unitsSold: 0,
          realizedRevenue: 0,
          orderCount: 0,
          orderIds: new Set(),
        };
        variantSalesMap.set(variantKey, agg);
      }

      agg.unitsSold += item.quantity;
      agg.realizedRevenue += netPaid;
      if (!agg.orderIds.has(order.id)) {
        agg.orderIds.add(order.id);
        agg.orderCount += 1;
      }
    }
  }

  const salesByVariant = Array.from(variantSalesMap.values())
    .map(({ orderIds: _ids, realizedRevenue: rev, ...rest }) => ({
      ...rest,
      key: rest.variantKey,
      realizedRevenue: round2(rev),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const bestSellingVariant =
    salesByVariant.length > 0
      ? {
        key: salesByVariant[0].variantKey,
        variantKey: salesByVariant[0].variantKey,
        name: salesByVariant[0].name,
        nameAr: salesByVariant[0].nameAr,
        sku: salesByVariant[0].sku,
        unitsSold: salesByVariant[0].unitsSold,
        revenue: salesByVariant[0].realizedRevenue,
        realizedRevenue: salesByVariant[0].realizedRevenue,
      }
      : null;

  // Build Recent Orders (strictly bounded to max 5 UNIQUE orders fetched directly from DB)
  const recentOrders = recentOrderItems.map((order) => {
    const sid = shortId(order.id);
    let totalQuantity = 0;
    let totalNetPaid = 0;

    const lines = order.items.map((item) => {
      const snapshot = parseStoredVariantSnapshot(item.variantInfo);
      const lineNet = itemNetPaid(item, order);
      totalQuantity += item.quantity;
      totalNetPaid += lineNet;
      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: getUnitPrice(item),
        lineTotal: round2(lineNet),
        variantSnapshot: snapshot,
      };
    });

    return {
      id: order.id,
      orderId: order.id,
      orderNumber: sid,
      shortId: sid,
      createdAt: order.createdAt,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus || 'PENDING',
      paymentMethod: order.paymentMethod || 'COD',
      quantity: totalQuantity,
      unitPrice: lines[0]?.unitPrice ?? 0,
      lineTotal: round2(totalNetPaid),
      realizedRevenue: round2(totalNetPaid),
      lines,
      variantSnapshot: lines.length === 1 ? lines[0].variantSnapshot : null,
      customer: order.user
        ? {
          id: order.user.id,
          name: order.user.name || null,
          ...(options.isPlatformStaff ? { email: order.user.email || null } : {}),
        }
        : null,
    };
  });

  // 6. Aggregate Returns from DB-side GroupBy & Map Bounded Recent Returns
  let completedReturnedUnits = 0;
  let completedRefundAmount = 0;
  let openReturnRequests = 0;
  let totalReturnRequests = 0;

  for (const group of returnStatusGroups) {
    totalReturnRequests += group._count._all;
    const current = toCurrentRefundStatus(group.status);
    if (current === 'REFUNDED') {
      completedReturnedUnits += group._sum.quantity || 0;
      completedRefundAmount += group._sum.amount || 0;
    } else if (current !== 'REJECTED') {
      openReturnRequests += group._count._all;
    }
  }

  const returnRate = safeRate(completedReturnedUnits, deliveredUnitsSold) ?? 0;

  // Build Recent Returns (strictly bounded to max 5 records fetched directly from DB)
  const recentReturns = recentRefundRequests.map((refund) => {
    const sRefundId = shortId(refund.id);
    const sOrderId = shortId(refund.orderId);
    return {
      id: refund.id,
      shortId: sRefundId,
      orderId: refund.orderId,
      orderNumber: sOrderId,
      shortOrderId: sOrderId,
      createdAt: refund.createdAt,
      quantity: refund.quantity,
      amount: round2(refund.amount),
      reason: refund.reason,
      description: refund.description,
      status: toCurrentRefundStatus(refund.status),
      variantSnapshot: parseStoredVariantSnapshot(refund.orderItem?.variantInfo),
    };
  });

  // 7. Aggregate Behavioral Metrics (Logged-in Customers)
  const views = viewStats.reduce((sum, r) => sum + r._count._all, 0);
  const uniqueViewers = viewStats.length;
  const wishlistAdds = wishlistStats.reduce((sum, r) => sum + r._count._all, 0);
  const wishlistCustomers = wishlistStats.length;
  const addToCartActions = cartEvents.length;
  const unitsAddedToCart = cartEvents.reduce((sum, e) => sum + cartQuantity(e.metadata), 0);
  const cartCustomers = new Set(cartEvents.map((e) => e.userId)).size;
  const purchasingCustomers = confirmedPurchaserUserIds.size;
  const conversionRate = safeRate(purchasingCustomers, uniqueViewers) ?? 0;

  // 8. Assemble Complete Command Center Response
  const productOverview = {
    id: product.id,
    name: product.name,
    nameAr: product.nameAr,
    slug: product.slug,
    sku: product.sku,
    mainImage,
    mainImageAltEn: mainImageAltEntry?.altEn || null,
    mainImageAltAr: mainImageAltEntry?.altAr || null,
    images: gallery,
    imageMetadata: metadataList,
    vendor: {
      id: product.vendor.id,
      storeName: product.vendor.storeName,
      storeNameAr: product.vendor.storeNameAr,
      slug: product.vendor.slug,
      status: product.vendor.status,
      commissionRate: product.vendor.commissionRate,
    },
    category: product.category
      ? {
        id: product.category.id,
        name: product.category.name,
        nameAr: product.category.nameAr,
        slug: product.category.slug,
        ancestors: categoryAncestors,
      }
      : null,
    brand: product.brand
      ? {
        id: product.brand.id,
        name: product.brand.name,
        nameAr: product.brand.nameAr,
        slug: product.brand.slug,
      }
      : null,
    status: product.status,
    featured: product.featured,
    price: product.price,
    discountPrice: product.discountPrice,
    discountType: product.discountType,
    discountValue: product.discountValue,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    hasVariants: product.hasVariants,
    variantCount: product.variants.length,
    activeVariantCount: activeVariants.length,
    outOfStockVariantCount,
    lowStockVariantCount,
    defaultVariant: defaultVariantRecord
      ? {
        id: defaultVariantRecord.id,
        name: defaultVariantRecord.name,
        nameAr: defaultVariantRecord.nameAr,
        sku: defaultVariantRecord.sku,
        price: defaultVariantRecord.price,
        discountPrice: defaultVariantRecord.discountPrice,
        stock: defaultVariantRecord.stock,
      }
      : null,
    isLive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    submittedAt: product.submittedAt,
    reviewedAt: product.reviewedAt,
    rejectionReason: product.rejectionReason,
    ...(options.isPlatformStaff
      ? {
        reviewedBy: product.reviewedBy,
        reviewerName: reviewer?.name || reviewer?.email || null,
      }
      : {}),
  };

  return {
    product: productOverview,
    overview: productOverview,
    variants: formattedVariants,
    kpis: {
      totalStock: product.stock,
      deliveredUnitsSold,
      realizedRevenue: round2(realizedRevenue),
      qualifyingOrdersCount: qualifyingOrderIds.size,
      totalOrdersCount: totalOrderIds.size,
      inFlightUnits,
      lastPurchasedAt,
      totalReturnRequests,
      openReturnRequests,
      completedReturnedUnits,
      completedRefundAmount: round2(completedRefundAmount),
      returnRate,
      registeredViews: views,
      registeredUniqueViewers: uniqueViewers,
      registeredAddToCartActions: addToCartActions,
      registeredUnitsAddedToCart: unitsAddedToCart,
      registeredCartCustomers: cartCustomers,
      registeredWishlistAdds: wishlistAdds,
      registeredWishlistCustomers: wishlistCustomers,
      registeredPurchasingCustomers: purchasingCustomers,
      registeredConversionRate: conversionRate,
      bestSellingVariant,
    },
    salesByVariant,
    recentOrders,
    recentReturns,
  };
};
