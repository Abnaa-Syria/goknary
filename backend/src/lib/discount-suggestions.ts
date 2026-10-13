import { DiscountSuggestion, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { ConflictError, NotFoundError } from './errors';
import { publicProductWhere } from './visibility';
import { isConfirmedPurchase, isRealizedSale } from './merchant-analytics';
import { lowConversionThreshold } from './merchant-insights';
import { safeRate } from './analytics-math';
import { NotificationType, notifyVendor } from './notify';
import { syncProductFromVariants } from './variants';
import {
  DISCOUNT_SUGGESTION_REASONS,
  DiscountSuggestionReason,
  HIGH_VIEWS_LOW_CONVERSION,
  HIGH_WISHLIST_LOW_SALES,
  SLOW_MOVING_STOCK,
  SUGGESTED_DISCOUNT_PERCENT,
  SUGGESTION_COOLDOWN_DAYS,
  SUGGESTION_GENERATION,
  SUGGESTION_WINDOW_DAYS,
} from './discount-suggestion-config';

/**
 * Rule-based discount suggestions (F2). Generation only creates PENDING rows; it never touches a
 * price, a discount, the featured flag or ranking. A discount reaches customers only through
 * `decideDiscountSuggestion(…, 'approve')`, which applies it with the existing pricing fields
 * (Product/ProductVariant `discountPrice`, plus Product `discountType`/`discountValue`) in the same
 * transaction that marks the suggestion APPROVED.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'unknown error');

// ─── Pricing (pure) ──────────────────────────────────────────────────────────

/** Same formula and 2-decimal rounding as the store's discount utility (frontend utils/discount.ts). */
export const percentageDiscountPrice = (price: number, percent: number): number => Number((price - (price * percent) / 100).toFixed(2));

const effectiveDiscount = (price: number, discountPrice: number | null): number | null =>
  discountPrice !== null && discountPrice > 0 && discountPrice < price ? discountPrice : null;

/** Current discount as a percentage of the base price (0 when there is none). */
export const currentDiscountPercent = (price: number, discountPrice: number | null): number => {
  const current = effectiveDiscount(price, discountPrice);
  return current === null || price <= 0 ? 0 : ((price - current) / price) * 100;
};

interface PricedVariant {
  id: string;
  price: number;
  discountPrice: number | null;
}

export interface PricedProduct {
  id: string;
  vendorId: string;
  price: number;
  discountPrice: number | null;
  hasVariants: boolean;
  /** Active variants only. */
  variants: PricedVariant[];
  /** All variant rows (active or not); 0 means a legacy plain product even if hasVariants is set. */
  variantCount: number;
}

/** F5: a product with variant rows is priced by the selected variant in product page, cart and checkout. */
export const usesVariantPricing = (product: Pick<PricedProduct, 'hasVariants' | 'variantCount'>) =>
  product.hasVariants && product.variantCount > 0;

/** Canonical pricing fingerprint; approval refuses when it no longer matches the stored one. */
export const pricingSnapshot = (product: PricedProduct): string =>
  JSON.stringify({
    price: product.price,
    discountPrice: product.discountPrice,
    variants: usesVariantPricing(product)
      ? [...product.variants]
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((v) => ({ id: v.id, price: v.price, discountPrice: v.discountPrice }))
      : [],
  });

/** The least discounted price source a customer can buy (variants for variant products). */
export const productCurrentDiscountPercent = (product: PricedProduct): number =>
  usesVariantPricing(product)
    ? Math.min(...product.variants.map((v) => currentDiscountPercent(v.price, v.discountPrice)))
    : currentDiscountPercent(product.price, product.discountPrice);

export interface DiscountPlan {
  product: { discountPrice: number; discountType: 'PERCENTAGE'; discountValue: number } | null;
  variants: Array<{ id: string; discountPrice: number }>;
}

/**
 * What approving `percent` changes. Base prices never change; an existing equal or better discount
 * is kept as it is (never replaced by a smaller one). For variant products every active variant is
 * discounted from its own price, and the product-level display price follows the same rule.
 */
export const planDiscount = (product: PricedProduct, percent: number): DiscountPlan => {
  const improve = (price: number, discountPrice: number | null): number | null => {
    const target = percentageDiscountPrice(price, percent);
    if (!(target > 0 && target < price)) return null;
    const current = effectiveDiscount(price, discountPrice);
    return current !== null && current <= target ? null : target;
  };
  const productTarget = improve(product.price, product.discountPrice);
  const productPlan = productTarget === null ? null : { discountPrice: productTarget, discountType: 'PERCENTAGE' as const, discountValue: percent };

  if (!usesVariantPricing(product)) return { product: productPlan, variants: [] };
  const variants = product.variants
    .map((v) => ({ id: v.id, discountPrice: improve(v.price, v.discountPrice) }))
    .filter((v): v is { id: string; discountPrice: number } => v.discountPrice !== null);
  // The product-level price is only a display value for variant products; never change it alone.
  return variants.length === 0 ? { product: null, variants: [] } : { product: productPlan, variants };
};

const planChangesPurchasablePrice = (product: PricedProduct, plan: DiscountPlan) =>
  usesVariantPricing(product) ? plan.variants.length > 0 : plan.product !== null;

// ─── Rules (pure) ────────────────────────────────────────────────────────────

export interface ProductActivity {
  views: number;
  uniqueViewers: number;
  purchasingCustomers: number;
  wishlistCustomers: number;
  /** Realized units in the SUGGESTION_WINDOW_DAYS window. */
  unitsSold: number;
  /** Realized units in the SLOW_MOVING_STOCK window. */
  slowWindowUnits: number;
}

export interface RuleInput {
  activity: ProductActivity;
  stock: number;
  lowStockThreshold: number;
  ageDays: number;
  /** F3 low-conversion line for this product's vendor (percent). */
  conversionLine: number;
}

export interface RuleHit {
  reasonType: DiscountSuggestionReason;
  percent: number;
  reason: string;
}

const clampPercent = (percent: number) => Math.min(SUGGESTED_DISCOUNT_PERCENT.MAX, Math.max(SUGGESTED_DISCOUNT_PERCENT.MIN, percent));

/** Every rule the product currently meets, each with its deterministic percentage. */
export const evaluateRules = (input: RuleInput): RuleHit[] => {
  const { activity: a, stock, lowStockThreshold, ageDays, conversionLine } = input;
  const hits: RuleHit[] = [];
  const hasSpareStock = stock > lowStockThreshold;
  const conversion = safeRate(a.purchasingCustomers, a.uniqueViewers);

  if (hasSpareStock && a.uniqueViewers >= HIGH_VIEWS_LOW_CONVERSION.MIN_UNIQUE_VIEWERS && conversion !== null && conversion < conversionLine && conversionLine > 0) {
    const gap = 1 - conversion / conversionLine;
    const step = HIGH_VIEWS_LOW_CONVERSION.STEPS.find((s) => gap >= s.minGap) ?? HIGH_VIEWS_LOW_CONVERSION.STEPS[HIGH_VIEWS_LOW_CONVERSION.STEPS.length - 1];
    hits.push({
      reasonType: 'HIGH_VIEWS_LOW_CONVERSION',
      percent: clampPercent(step.percent),
      reason: `${a.uniqueViewers} customers viewed this product in the last ${SUGGESTION_WINDOW_DAYS} days but only ${a.purchasingCustomers} bought it (${conversion}% conversion, below ${Math.round(conversionLine * 10) / 10}%).`,
    });
  }

  if (
    hasSpareStock &&
    a.wishlistCustomers >= HIGH_WISHLIST_LOW_SALES.MIN_WISHLIST_CUSTOMERS &&
    a.purchasingCustomers < a.wishlistCustomers * HIGH_WISHLIST_LOW_SALES.MAX_PURCHASE_RATIO
  ) {
    const strong = a.purchasingCustomers < a.wishlistCustomers * HIGH_WISHLIST_LOW_SALES.STRONG_GAP_RATIO;
    hits.push({
      reasonType: 'HIGH_WISHLIST_LOW_SALES',
      percent: clampPercent(strong ? HIGH_WISHLIST_LOW_SALES.STRONG_PERCENT : HIGH_WISHLIST_LOW_SALES.PERCENT),
      reason: `${a.wishlistCustomers} customers added this product to their wishlist in the last ${SUGGESTION_WINDOW_DAYS} days but only ${a.purchasingCustomers} bought it.`,
    });
  }

  if (
    ageDays >= SLOW_MOVING_STOCK.MIN_AGE_DAYS &&
    stock >= SLOW_MOVING_STOCK.MIN_STOCK &&
    stock >= lowStockThreshold * SLOW_MOVING_STOCK.MIN_STOCK_THRESHOLD_MULTIPLE &&
    a.slowWindowUnits <= SLOW_MOVING_STOCK.MAX_UNITS
  ) {
    hits.push({
      reasonType: 'SLOW_MOVING_STOCK',
      percent: clampPercent(a.slowWindowUnits === 0 ? SLOW_MOVING_STOCK.NO_SALES_PERCENT : SLOW_MOVING_STOCK.FEW_SALES_PERCENT),
      reason: `${stock} units in stock but ${a.slowWindowUnits} delivered in the last ${SLOW_MOVING_STOCK.WINDOW_DAYS} days.`,
    });
  }
  return hits;
};

// ─── Generation ──────────────────────────────────────────────────────────────

export interface GenerateOptions {
  vendorId?: string;
  reason?: DiscountSuggestionReason;
  now?: Date;
}

export interface GenerateSummary {
  productsEvaluated: number;
  created: number;
  skippedPending: number;
  skippedCooldown: number;
  skippedExistingDiscount: number;
  vendorsNotified: number;
}

export class SuggestionGenerationInProgressError extends Error {
  constructor() {
    super('Discount suggestion generation is already running');
  }
}

const newActivity = (): ProductActivity => ({
  views: 0,
  uniqueViewers: 0,
  purchasingCustomers: 0,
  wishlistCustomers: 0,
  unitsSold: 0,
  slowWindowUnits: 0,
});

/**
 * Six grouped/batched reads for the whole scope (all vendors or one), then pure rules per product.
 * At most one new suggestion per product per run (the largest applicable discount).
 */
const runGeneration = async (options: GenerateOptions): Promise<GenerateSummary> => {
  const now = options.now ?? new Date();
  const since = daysBefore(now, SUGGESTION_WINDOW_DAYS);
  const slowSince = daysBefore(now, SLOW_MOVING_STOCK.WINDOW_DAYS);
  const ordersSince = since < slowSince ? since : slowSince;
  const vendorScope = options.vendorId ? { vendorId: options.vendorId } : {};
  const cooldownSince = daysBefore(now, Math.max(SUGGESTION_COOLDOWN_DAYS.REJECTED, SUGGESTION_COOLDOWN_DAYS.APPROVED));

  const [products, viewPairs, wishlistPairs, vendorViewPairs, orders, existing] = await Promise.all([
    prisma.product.findMany({
      where: publicProductWhere({ ...vendorScope, stock: { gt: 0 } }),
      select: {
        id: true,
        vendorId: true,
        price: true,
        discountPrice: true,
        hasVariants: true,
        stock: true,
        lowStockThreshold: true,
        createdAt: true,
        variants: { where: { status: true }, select: { id: true, price: true, discountPrice: true } },
        _count: { select: { variants: true } },
      },
    }),
    prisma.userEvent.groupBy({
      by: ['productId', 'userId'],
      where: { ...vendorScope, type: 'PRODUCT_VIEW', createdAt: { gte: since }, productId: { not: null } },
      _count: { _all: true },
    }),
    prisma.userEvent.groupBy({
      by: ['productId', 'userId'],
      where: { ...vendorScope, type: 'ADD_TO_WISHLIST', createdAt: { gte: since }, productId: { not: null } },
      _count: { _all: true },
    }),
    prisma.userEvent.groupBy({
      by: ['vendorId', 'userId'],
      where: { ...vendorScope, type: 'PRODUCT_VIEW', createdAt: { gte: since }, vendorId: { not: null } },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { ...vendorScope, createdAt: { gte: ordersSince } },
      select: {
        userId: true,
        vendorId: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        items: { select: { productId: true, quantity: true } },
      },
    }),
    prisma.discountSuggestion.findMany({
      where: { ...vendorScope, OR: [{ status: 'PENDING' }, { decidedAt: { gte: cooldownSince } }] },
      select: { productId: true, reasonType: true, status: true, decidedAt: true },
    }),
  ]);

  const activity = new Map<string, ProductActivity>();
  const activityOf = (id: string) => {
    let entry = activity.get(id);
    if (!entry) activity.set(id, (entry = newActivity()));
    return entry;
  };
  for (const row of viewPairs) {
    if (!row.productId) continue;
    const a = activityOf(row.productId);
    a.views += row._count._all;
    a.uniqueViewers++;
  }
  for (const row of wishlistPairs) {
    if (row.productId) activityOf(row.productId).wishlistCustomers++;
  }

  // F3 definitions: purchasers = confirmed purchases (not cancelled, COD or PAID); units = realized sales.
  const purchasers = new Map<string, Set<string>>();
  const vendorPurchasers = new Map<string, Set<string>>();
  const addTo = (map: Map<string, Set<string>>, key: string, user: string) => {
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(user);
  };
  for (const order of orders) {
    const inWindow = order.createdAt >= since;
    if (inWindow && isConfirmedPurchase(order)) {
      addTo(vendorPurchasers, order.vendorId, order.userId);
      for (const item of order.items) addTo(purchasers, item.productId, order.userId);
    }
    if (isRealizedSale(order)) {
      for (const item of order.items) {
        const a = activityOf(item.productId);
        if (inWindow) a.unitsSold += item.quantity;
        if (order.createdAt >= slowSince) a.slowWindowUnits += item.quantity;
      }
    }
  }
  purchasers.forEach((set, productId) => (activityOf(productId).purchasingCustomers = set.size));

  const vendorViewers = new Map<string, number>();
  for (const row of vendorViewPairs) {
    if (row.vendorId) vendorViewers.set(row.vendorId, (vendorViewers.get(row.vendorId) ?? 0) + 1);
  }
  const conversionLineByVendor = new Map<string, number>();
  const conversionLineFor = (vendorId: string) => {
    let line = conversionLineByVendor.get(vendorId);
    if (line === undefined) {
      const uniqueViewers = vendorViewers.get(vendorId) ?? 0;
      line = lowConversionThreshold({ uniqueViewers, conversionRate: safeRate(vendorPurchasers.get(vendorId)?.size ?? 0, uniqueViewers) });
      conversionLineByVendor.set(vendorId, line);
    }
    return line;
  };

  const pendingProducts = new Set<string>();
  const recentlyApproved = new Set<string>();
  const rejectedReasons = new Set<string>();
  const approvedSince = daysBefore(now, SUGGESTION_COOLDOWN_DAYS.APPROVED);
  const rejectedSince = daysBefore(now, SUGGESTION_COOLDOWN_DAYS.REJECTED);
  for (const s of existing) {
    if (s.status === 'PENDING') pendingProducts.add(s.productId);
    else if (s.status === 'APPROVED' && s.decidedAt && s.decidedAt >= approvedSince) recentlyApproved.add(s.productId);
    else if (s.status === 'REJECTED' && s.decidedAt && s.decidedAt >= rejectedSince) rejectedReasons.add(`${s.productId}:${s.reasonType}`);
  }

  const summary: GenerateSummary = {
    productsEvaluated: products.length,
    created: 0,
    skippedPending: 0,
    skippedCooldown: 0,
    skippedExistingDiscount: 0,
    vendorsNotified: 0,
  };
  const data: Prisma.DiscountSuggestionCreateManyInput[] = [];
  const reasonOrder = (r: DiscountSuggestionReason) => DISCOUNT_SUGGESTION_REASONS.indexOf(r);

  for (const p of products.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const priced: PricedProduct = {
      id: p.id,
      vendorId: p.vendorId,
      price: p.price,
      discountPrice: p.discountPrice,
      hasVariants: p.hasVariants,
      variants: p.variants,
      variantCount: p._count.variants,
    };
    if (usesVariantPricing(priced) && priced.variants.length === 0) continue;
    const a = activity.get(p.id) ?? newActivity();
    const ageDays = Math.floor((now.getTime() - p.createdAt.getTime()) / DAY_MS);
    const hits = evaluateRules({ activity: a, stock: p.stock, lowStockThreshold: p.lowStockThreshold, ageDays, conversionLine: conversionLineFor(p.vendorId) })
      .filter((hit) => !options.reason || hit.reasonType === options.reason);
    if (hits.length === 0) continue;
    if (pendingProducts.has(p.id)) {
      summary.skippedPending++;
      continue;
    }
    if (recentlyApproved.has(p.id)) {
      summary.skippedCooldown++;
      continue;
    }
    const allowed = hits.filter((hit) => !rejectedReasons.has(`${p.id}:${hit.reasonType}`));
    if (allowed.length === 0) {
      summary.skippedCooldown++;
      continue;
    }
    const currentPercent = productCurrentDiscountPercent(priced);
    const best = allowed
      .filter((hit) => planChangesPurchasablePrice(priced, planDiscount(priced, hit.percent)))
      .sort((x, y) => y.percent - x.percent || reasonOrder(x.reasonType) - reasonOrder(y.reasonType))[0];
    if (!best) {
      summary.skippedExistingDiscount++;
      continue;
    }

    const conversionLine = conversionLineFor(p.vendorId);
    data.push({
      productId: p.id,
      vendorId: p.vendorId,
      reasonType: best.reasonType,
      suggestedType: 'PERCENTAGE',
      suggestedValue: best.percent,
      reason: best.reason,
      metrics: JSON.stringify({
        windowDays: SUGGESTION_WINDOW_DAYS,
        slowWindowDays: SLOW_MOVING_STOCK.WINDOW_DAYS,
        views: a.views,
        uniqueViewers: a.uniqueViewers,
        purchasingCustomers: a.purchasingCustomers,
        conversionRate: safeRate(a.purchasingCustomers, a.uniqueViewers),
        conversionThreshold: Math.round(conversionLine * 10) / 10,
        wishlistCustomers: a.wishlistCustomers,
        unitsSold: a.unitsSold,
        slowWindowUnits: a.slowWindowUnits,
        stock: p.stock,
        productAgeDays: ageDays,
        currentDiscountPercent: Math.round(currentPercent * 10) / 10,
      }),
      pricingSnapshot: pricingSnapshot(priced),
    });
  }

  if (data.length > 0) {
    await prisma.discountSuggestion.createMany({ data });
    summary.created = data.length;
    const perVendor = new Map<string, number>();
    data.forEach((row) => perVendor.set(row.vendorId, (perVendor.get(row.vendorId) ?? 0) + 1));
    for (const [vendorId, count] of perVendor) {
      await notifyVendor(vendorId, {
        type: NotificationType.DISCOUNT_SUGGESTION,
        title: count === 1 ? 'New discount suggestion' : `${count} new discount suggestions`,
        titleAr: count === 1 ? 'اقتراح خصم جديد' : `${count} اقتراحات خصم جديدة`,
        message: 'Review the suggestion. No discount is applied unless you approve it.',
        messageAr: 'راجع الاقتراح. لن يتم تطبيق أي خصم إلا بعد موافقتك.',
        link: '/vendor/discount-suggestions',
        entityType: 'DISCOUNT_SUGGESTION',
      });
    }
    summary.vendorsNotified = perVendor.size;
  }
  return summary;
};

let generating: Promise<GenerateSummary> | null = null;

/** Idempotent: products with a pending suggestion, a recent approval or a recently rejected reason are skipped. */
export const generateDiscountSuggestions = async (options: GenerateOptions = {}): Promise<GenerateSummary> => {
  if (generating) throw new SuggestionGenerationInProgressError();
  generating = runGeneration(options);
  try {
    return await generating;
  } finally {
    generating = null;
  }
};

// ─── Decision ────────────────────────────────────────────────────────────────

export type SuggestionAction = 'approve' | 'reject';

export interface DecisionActor {
  id: string;
  role: string;
}

export interface DecisionResult {
  suggestion: DiscountSuggestion;
  applied: DiscountPlan | null;
}

export const STALE_PRICING_MESSAGE = 'Product pricing changed; regenerate suggestion.';

/**
 * Approve or reject one suggestion. Everything happens in one transaction: the status claim is a
 * conditional update (PENDING → decided), so a double approval, approve-after-reject or
 * reject-after-approve gets a 409 and only one approval can ever apply a discount.
 * `vendorScope` limits a vendor to its own suggestions (others look like 404).
 */
export const decideDiscountSuggestion = async (
  id: string,
  action: SuggestionAction,
  actor: DecisionActor,
  vendorScope: string | null
): Promise<DecisionResult> => {
  const result = await prisma.$transaction(async (tx) => {
    const suggestion = await tx.discountSuggestion.findUnique({ where: { id } });
    if (!suggestion || (vendorScope && suggestion.vendorId !== vendorScope)) throw new NotFoundError('Suggestion not found');
    if (suggestion.status !== 'PENDING') throw new ConflictError(`This suggestion was already ${suggestion.status.toLowerCase()}.`);

    let plan: DiscountPlan | null = null;
    if (action === 'approve') {
      const product = await tx.product.findFirst({
        where: publicProductWhere({ id: suggestion.productId }),
        select: {
          id: true,
          vendorId: true,
          price: true,
          discountPrice: true,
          hasVariants: true,
          variants: { where: { status: true }, select: { id: true, price: true, discountPrice: true } },
          _count: { select: { variants: true } },
        },
      });
      if (!product || product.vendorId !== suggestion.vendorId) {
        throw new ConflictError('The product is no longer available; this suggestion cannot be approved.');
      }
      const priced: PricedProduct = { ...product, variantCount: product._count.variants };
      if (pricingSnapshot(priced) !== suggestion.pricingSnapshot) throw new ConflictError(STALE_PRICING_MESSAGE);
      const percent = suggestion.suggestedValue;
      if (suggestion.suggestedType !== 'PERCENTAGE' || !(percent >= SUGGESTED_DISCOUNT_PERCENT.MIN && percent <= SUGGESTED_DISCOUNT_PERCENT.MAX)) {
        throw new ConflictError('The suggested discount is outside the allowed range.');
      }
      plan = planDiscount(priced, percent);
      if (!planChangesPurchasablePrice(priced, plan)) {
        throw new ConflictError('The product already has an equal or better discount.');
      }
    }

    const decidedAt = new Date();
    const { count } = await tx.discountSuggestion.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: action === 'approve' ? 'APPROVED' : 'REJECTED', decidedBy: actor.id, decidedByRole: actor.role, decidedAt },
    });
    if (count === 0) throw new ConflictError('This suggestion was already decided.');

    if (plan) {
      if (plan.product) {
        await tx.product.update({ where: { id: suggestion.productId }, data: plan.product });
      }
      for (const variant of plan.variants) {
        await tx.productVariant.update({ where: { id: variant.id }, data: { discountPrice: variant.discountPrice } });
      }
      if (plan.variants.length > 0) await syncProductFromVariants(tx, suggestion.productId);
    }
    const updated = await tx.discountSuggestion.findUniqueOrThrow({ where: { id } });
    return { suggestion: updated, applied: plan };
  });

  // The vendor is told when the platform decided for them; a vendor's own decision needs no notice.
  if (actor.role === 'ADMIN' || actor.role === 'STAFF') {
    const approved = action === 'approve';
    await notifyVendor(result.suggestion.vendorId, {
      type: NotificationType.DISCOUNT_SUGGESTION,
      title: approved ? 'Discount suggestion approved' : 'Discount suggestion rejected',
      titleAr: approved ? 'تمت الموافقة على اقتراح الخصم' : 'تم رفض اقتراح الخصم',
      message: approved
        ? `The platform approved a ${result.suggestion.suggestedValue}% discount suggestion for one of your products; the discount is now live.`
        : 'The platform rejected a discount suggestion for one of your products. Prices were not changed.',
      messageAr: approved
        ? `وافقت المنصة على اقتراح خصم ${result.suggestion.suggestedValue}% لأحد منتجاتك، والخصم مفعل الآن.`
        : 'رفضت المنصة اقتراح خصم لأحد منتجاتك، ولم يتم تغيير الأسعار.',
      link: '/vendor/discount-suggestions',
      entityType: 'DISCOUNT_SUGGESTION',
      entityId: result.suggestion.id,
    });
  }
  return result;
};

// ─── Listing ─────────────────────────────────────────────────────────────────

export interface ListOptions {
  vendorId?: string;
  status?: string;
  reasonType?: string;
  page: number;
  limit: number;
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

const parseMetrics = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const listDiscountSuggestions = async (options: ListOptions, forPlatform: boolean) => {
  const where: Prisma.DiscountSuggestionWhereInput = {
    ...(options.vendorId ? { vendorId: options.vendorId } : {}),
    ...(options.status ? { status: options.status as DiscountSuggestion['status'] } : {}),
    ...(options.reasonType ? { reasonType: options.reasonType } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.discountSuggestion.count({ where }),
    prisma.discountSuggestion.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            slug: true,
            images: true,
            price: true,
            discountPrice: true,
            discountType: true,
            discountValue: true,
            stock: true,
            hasVariants: true,
            status: true,
          },
        },
        vendor: { select: { id: true, storeName: true } },
      },
    }),
  ]);

  return {
    suggestions: rows.map(({ product, vendor, metrics, pricingSnapshot: _snapshot, decidedBy, ...row }) => ({
      ...row,
      ...(forPlatform ? { decidedBy } : {}),
      metrics: parseMetrics(metrics),
      product: product ? { ...product, images: undefined, image: firstImage(product.images) } : null,
      ...(forPlatform ? { vendor } : {}),
    })),
    pagination: { page: options.page, limit: options.limit, total, totalPages: Math.ceil(total / options.limit) },
  };
};

// ─── Periodic generation (in-process, no cron/queue) ─────────────────────────

/**
 * DISCOUNT_SUGGESTIONS_INTERVAL_HOURS: unset → 24 in production, off elsewhere; 0 or invalid → off;
 * otherwise at least MIN_INTERVAL_HOURS. Runs never overlap in one process and errors never crash it.
 */
export const resolveSuggestionIntervalHours = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.DISCOUNT_SUGGESTIONS_INTERVAL_HOURS;
  if (raw === undefined || raw.trim() === '') {
    return env.NODE_ENV === 'production' ? SUGGESTION_GENERATION.DEFAULT_PRODUCTION_INTERVAL_HOURS : 0;
  }
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(SUGGESTION_GENERATION.MIN_INTERVAL_HOURS, hours);
};

let scheduledIntervalHours = 0;
export const getSuggestionIntervalHours = () => scheduledIntervalHours;

export const startDiscountSuggestionScheduler = (env: NodeJS.ProcessEnv = process.env) => {
  const hours = resolveSuggestionIntervalHours(env);
  scheduledIntervalHours = hours;
  if (!hours) return null;

  const run = (reason: string) =>
    generateDiscountSuggestions().catch((err) => {
      if (!(err instanceof SuggestionGenerationInProgressError)) {
        console.error(`[discount-suggestions] ${reason} generation failed:`, errorMessage(err));
      }
    });

  const startup = setTimeout(() => void run('startup'), SUGGESTION_GENERATION.STARTUP_DELAY_MS);
  const interval = setInterval(() => void run('scheduled'), hours * 3_600_000);
  startup.unref();
  interval.unref();
  return {
    stop: () => {
      clearTimeout(startup);
      clearInterval(interval);
    },
  };
};
