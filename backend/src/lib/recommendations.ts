import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getDescendantCategoryIds, loadAllCategories } from './category-tree';
import { publicProductWhere } from './visibility';
import { FINANCIALLY_CONFIRMED_ORDER_WHERE } from './vendor-earnings';
import { RECOMMENDED_PRODUCT_ORDER } from './ranking-config';
import {
  CANDIDATES,
  CATEGORY_PROPAGATION,
  CONTEXT_RELEVANCE,
  CO_OCCURRENCE,
  DIVERSITY,
  EVENT_WEIGHTS,
  HISTORY,
  INTEREST_EVENT_TYPES,
  InterestEventType,
  LIMITS,
  PENALTIES,
  ReasonCode,
  RecommendationContext,
  SCORE_WEIGHTS,
  ScoreSignal,
} from './recommendation-config';

/**
 * Per-customer personalization (F2), computed on demand. A layer on top of the general F4 ranking:
 * `Product.rankingScore` is read as a quality prior and never written here.
 *
 * Sources: the customer's own UserEvents (F1), aggregated co-views of other customers (UserEvent),
 * aggregated co-purchases (Orders/OrderItems, confirmed purchases only), the F6 category tree and
 * F10 public visibility. Only logged-in CUSTOMER ids reach this module (resolved from the token by
 * the controller). Results contain products only, never another customer's data.
 *
 * Work per request is bounded: at most HISTORY.MAX_EVENTS own events, CO_OCCURRENCE.MAX_PEERS peers,
 * CANDIDATES.MAX scored products, and a fixed number of grouped queries (no per-product queries).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export const recommendationInclude = {
  vendor: { select: { id: true, storeName: true, storeNameAr: true, slug: true } },
  category: { select: { id: true, name: true, nameAr: true, slug: true } },
  brand: { select: { id: true, name: true, nameAr: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type RecommendationProduct = Prisma.ProductGetPayload<{ include: typeof recommendationInclude }>;

export interface ScoredRecommendation {
  product: RecommendationProduct;
  score: number;
  reasonCode: ReasonCode;
}

export interface RecommendationResult {
  context: RecommendationContext;
  /** True only when personal/session history is strong enough to justify a "For You" label. */
  personalized: boolean;
  items: ScoredRecommendation[];
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** 1 now, 0.5 after one half-life, 0.25 after two… */
export const recencyDecay = (ageMs: number): number =>
  Math.pow(0.5, Math.max(0, ageMs) / DAY_MS / HISTORY.RECENCY_HALF_LIFE_DAYS);

export const clampLimit = (raw: unknown, fallback: number, max: number): number => {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

/** Category id → parent id (null at the top). */
export type ParentMap = Map<string, string | null>;

/** The category itself, then its ancestors, as far as CATEGORY_PROPAGATION reaches (cycle-safe). */
const lineage = (categoryId: string, parents: ParentMap): string[] => {
  const chain = [categoryId];
  const seen = new Set(chain);
  let current = parents.get(categoryId) ?? null;
  while (current && chain.length < CATEGORY_PROPAGATION.length && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = parents.get(current) ?? null;
  }
  return chain;
};

export interface InterestEvent {
  type: string;
  productId: string | null;
  categoryId: string | null;
  vendorId: string | null;
  createdAt: Date;
}

export interface InterestProfile {
  /** Decayed interest per category, propagated to ancestors with CATEGORY_PROPAGATION. */
  categoryAffinity: Map<string, number>;
  /** Decayed interest per exact category over the short RECENT_INTEREST_DAYS window. */
  recentCategory: Map<string, number>;
  vendorAffinity: Map<string, number>;
  /** Decayed interest per exact product: the seeds for co-occurrence. */
  productInterest: Map<string, number>;
  returnedProducts: Set<string>;
  recentlyPurchased: Set<string>;
  totalInterest: number;
}

const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);

/**
 * Builds the interest profile from the customer's own events. RETURN_REQUEST only marks that exact
 * product (the purchase still counts as category interest); REMOVE_* events are ignored.
 */
export const buildInterestProfile = (events: InterestEvent[], parents: ParentMap, now: Date): InterestProfile => {
  const profile: InterestProfile = {
    categoryAffinity: new Map(),
    recentCategory: new Map(),
    vendorAffinity: new Map(),
    productInterest: new Map(),
    returnedProducts: new Set(),
    recentlyPurchased: new Set(),
    totalInterest: 0,
  };
  const returnSince = daysBefore(now, PENALTIES.RETURN_WINDOW_DAYS).getTime();
  const purchaseSince = daysBefore(now, PENALTIES.RECENT_PURCHASE_DAYS).getTime();
  const recentSince = daysBefore(now, HISTORY.RECENT_INTEREST_DAYS).getTime();

  for (const event of events) {
    const at = event.createdAt.getTime();
    if (event.type === 'RETURN_REQUEST') {
      if (event.productId && at >= returnSince) profile.returnedProducts.add(event.productId);
      continue;
    }
    const base = EVENT_WEIGHTS[event.type as InterestEventType];
    if (base === undefined) continue;
    if (!event.productId && !event.categoryId && !event.vendorId) continue;
    const weight = base * recencyDecay(now.getTime() - at);
    profile.totalInterest += weight;

    if (event.categoryId) {
      lineage(event.categoryId, parents).forEach((id, level) => add(profile.categoryAffinity, id, weight * CATEGORY_PROPAGATION[level]));
      if (at >= recentSince) add(profile.recentCategory, event.categoryId, weight);
    }
    if (event.vendorId) add(profile.vendorAffinity, event.vendorId, weight);
    if (event.productId) add(profile.productInterest, event.productId, weight);
    if (event.type === 'PURCHASE' && event.productId && at >= purchaseSince) profile.recentlyPurchased.add(event.productId);
  }
  return profile;
};

const maxOf = (map: Map<string, number>) => Math.max(0, ...Array.from(map.values()));

/** Best of: the category's own affinity, or a share of its parent's / grandparent's (siblings benefit too). */
export const categorySignal = (categoryId: string, affinity: Map<string, number>, parents: ParentMap, max: number): number => {
  if (max <= 0) return 0;
  let best = 0;
  lineage(categoryId, parents).forEach((id, level) => {
    best = Math.max(best, (affinity.get(id) ?? 0) * CATEGORY_PROPAGATION[level]);
  });
  return Math.min(1, best / max);
};

export interface CoOccurrence {
  /** Distinct other customers who viewed/carted/wishlisted the candidate as well as a seed. */
  coViewers: Map<string, number>;
  /** Distinct other customers who bought the candidate as well as a seed (confirmed orders). */
  coBuyers: Map<string, number>;
}

/** Pairs below the minimum support are dropped, so one customer never decides a recommendation. */
export const coOccurrenceScores = (co: CoOccurrence): Map<string, { score: number; purchased: boolean }> => {
  const scores = new Map<string, { score: number; purchased: boolean }>();
  co.coViewers.forEach((count, id) => {
    if (count >= CO_OCCURRENCE.MIN_SUPPORT) scores.set(id, { score: count, purchased: false });
  });
  co.coBuyers.forEach((count, id) => {
    if (count < CO_OCCURRENCE.MIN_SUPPORT) return;
    const current = scores.get(id);
    scores.set(id, { score: (current?.score ?? 0) + count * CO_OCCURRENCE.PURCHASE_MULTIPLIER, purchased: true });
  });
  return scores;
};

export interface ScoringInput {
  products: RecommendationProduct[];
  profile: InterestProfile | null;
  coOccurrence: Map<string, { score: number; purchased: boolean }>;
  contextCategoryIds: string[];
  parents: ParentMap;
}

const SCORE_WEIGHT_TOTAL = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);

const reasonFor = (contributions: Record<ScoreSignal, number>, purchased: boolean): ReasonCode => {
  let best: ScoreSignal | null = null;
  for (const key of Object.keys(contributions) as ScoreSignal[]) {
    if (key === 'globalRanking' || contributions[key] <= 0) continue;
    if (!best || contributions[key] > contributions[best]) best = key;
  }
  switch (best) {
    case 'coOccurrence':
      return purchased ? 'CO_PURCHASED' : 'SIMILAR_TO_VIEWED';
    case 'categoryAffinity':
    case 'recentInterest':
      return 'CATEGORY_INTEREST';
    case 'contextRelevance':
      return 'RELATED_CATEGORY';
    case 'vendorAffinity':
      return 'POPULAR_FOR_YOU';
    default:
      return 'GLOBAL_FALLBACK';
  }
};

/**
 * Personalized score 0–100 = Σ signal × weight ÷ Σ weights × 100, then exact-product penalties.
 * Personal signals are scaled by a confidence that grows with the amount of history, so a customer
 * with a few events is blended smoothly from the general ranking towards their own interests.
 */
export const scoreCandidates = (input: ScoringInput): ScoredRecommendation[] => {
  const { profile, parents } = input;
  const confidence = profile ? Math.min(1, profile.totalInterest / HISTORY.FULL_PERSONALIZATION_AT) : 0;
  const maxCategory = profile ? maxOf(profile.categoryAffinity) : 0;
  const maxRecent = profile ? maxOf(profile.recentCategory) : 0;
  const maxVendor = profile ? maxOf(profile.vendorAffinity) : 0;
  const maxCo = Math.max(0, ...Array.from(input.coOccurrence.values()).map((c) => c.score));
  const contextCategories = new Set(input.contextCategoryIds);
  const contextParents = new Set(
    input.contextCategoryIds.map((id) => parents.get(id) ?? null).filter((id): id is string => !!id)
  );

  return input.products.map((product) => {
    const co = input.coOccurrence.get(product.id);
    const parentId = parents.get(product.categoryId) ?? null;
    const signals: Record<ScoreSignal, number> = {
      globalRanking: Math.min(1, Math.max(0, product.rankingScore / 100)),
      categoryAffinity: profile ? categorySignal(product.categoryId, profile.categoryAffinity, parents, maxCategory) * confidence : 0,
      coOccurrence: co && maxCo > 0 ? co.score / maxCo : 0,
      recentInterest: profile && maxRecent > 0 ? ((profile.recentCategory.get(product.categoryId) ?? 0) / maxRecent) * confidence : 0,
      vendorAffinity: profile && maxVendor > 0 ? ((profile.vendorAffinity.get(product.vendorId) ?? 0) / maxVendor) * confidence : 0,
      contextRelevance: contextCategories.has(product.categoryId)
        ? CONTEXT_RELEVANCE.SAME_CATEGORY
        : parentId && contextParents.has(parentId)
          ? CONTEXT_RELEVANCE.SIBLING_CATEGORY
          : 0,
    };
    const contributions = {} as Record<ScoreSignal, number>;
    let total = 0;
    for (const key of Object.keys(SCORE_WEIGHTS) as ScoreSignal[]) {
      contributions[key] = signals[key] * SCORE_WEIGHTS[key];
      total += contributions[key];
    }
    let score = (total / SCORE_WEIGHT_TOTAL) * 100;
    if (profile?.returnedProducts.has(product.id)) score *= PENALTIES.RETURN_FACTOR;
    else if (profile?.recentlyPurchased.has(product.id)) score *= PENALTIES.RECENT_PURCHASE_FACTOR;
    return { product, score: Math.round(score * 10000) / 10000, reasonCode: reasonFor(contributions, !!co?.purchased) };
  });
};

const byScoreThenId = (a: ScoredRecommendation, b: ScoredRecommendation) =>
  b.score - a.score || (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0);

/**
 * Deterministic greedy re-ranking: walks the score order and takes the best remaining product that
 * does not extend a same-vendor / same-category run or exceed the soft share caps. When nothing
 * qualifies the best remaining product is taken anyway, so relevance is never thrown away.
 */
export const diversify = (sorted: ScoredRecommendation[], limit: number): ScoredRecommendation[] => {
  const remaining = [...sorted];
  const picked: ScoredRecommendation[] = [];
  const vendorCap = Math.max(1, Math.ceil(limit * DIVERSITY.VENDOR_SHARE));
  const categoryCap = Math.max(1, Math.ceil(limit * DIVERSITY.CATEGORY_SHARE));
  const vendorCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  const runLength = (key: (r: ScoredRecommendation) => string, value: string) => {
    let run = 0;
    for (let i = picked.length - 1; i >= 0 && key(picked[i]) === value; i--) run++;
    return run;
  };
  const fits = (item: ScoredRecommendation) => {
    const { vendorId, categoryId } = item.product;
    return (
      runLength((r) => r.product.vendorId, vendorId) < DIVERSITY.MAX_CONSECUTIVE_SAME_VENDOR &&
      runLength((r) => r.product.categoryId, categoryId) < DIVERSITY.MAX_CONSECUTIVE_SAME_CATEGORY &&
      (vendorCount.get(vendorId) ?? 0) < vendorCap &&
      (categoryCount.get(categoryId) ?? 0) < categoryCap
    );
  };

  while (picked.length < limit && remaining.length > 0) {
    let index = remaining.findIndex(fits);
    if (index === -1) index = 0;
    const [item] = remaining.splice(index, 1);
    picked.push(item);
    add(vendorCount, item.product.vendorId, 1);
    add(categoryCount, item.product.categoryId, 1);
  }
  return picked;
};

/** In-stock products first (diversified), out-of-stock only to fill the remaining slots. */
export const rankAndDiversify = (scored: ScoredRecommendation[], limit: number): ScoredRecommendation[] => {
  const sorted = [...scored].sort(byScoreThenId);
  const inStock = diversify(sorted.filter((r) => r.product.stock > 0), limit);
  if (inStock.length >= limit) return inStock;
  return [...inStock, ...sorted.filter((r) => r.product.stock <= 0).slice(0, limit - inStock.length)];
};

// ─── Data loading (bounded, grouped queries) ─────────────────────────────────

const loadParents = async (): Promise<{ parents: ParentMap; categories: Awaited<ReturnType<typeof loadAllCategories>> }> => {
  const categories = await loadAllCategories();
  return { parents: new Map(categories.map((c) => [c.id, c.parentId])), categories };
};

/** The customer's own recent interest events (newest first, capped) plus recent return requests. */
const loadCustomerEvents = async (userId: string, now: Date): Promise<InterestEvent[]> => {
  const select = { type: true, productId: true, categoryId: true, vendorId: true, createdAt: true } as const;
  const [interest, returns] = await Promise.all([
    prisma.userEvent.findMany({
      where: { userId, type: { in: INTEREST_EVENT_TYPES }, createdAt: { gte: daysBefore(now, HISTORY.LOOKBACK_DAYS) } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY.MAX_EVENTS,
      select,
    }),
    prisma.userEvent.findMany({
      where: { userId, type: 'RETURN_REQUEST', productId: { not: null }, createdAt: { gte: daysBefore(now, PENALTIES.RETURN_WINDOW_DAYS) } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY.MAX_EVENTS,
      select,
    }),
  ]);
  return [...interest, ...returns];
};

const confirmedOrderWhere = (since: Date): Prisma.OrderWhereInput => ({
  createdAt: { gte: since },
  status: { not: 'CANCELLED' },
  ...FINANCIALLY_CONFIRMED_ORDER_WHERE,
});

const countDistinct = (pairs: Array<{ productId: string | null; userId: string }>, exclude: Set<string>) => {
  const users = new Map<string, Set<string>>();
  for (const pair of pairs) {
    if (!pair.productId || exclude.has(pair.productId)) continue;
    let set = users.get(pair.productId);
    if (!set) users.set(pair.productId, (set = new Set()));
    set.add(pair.userId);
  }
  return new Map(Array.from(users.entries()).map(([id, set]) => [id, set.size]));
};

/**
 * "Customers who interacted with / bought the seeds also interacted with / bought …", aggregated.
 * Starts from the seed products (never an N×N scan) and excludes the requesting customer.
 */
export const loadCoOccurrence = async (seedIds: string[], excludeUserId: string | null, now: Date): Promise<CoOccurrence> => {
  const empty: CoOccurrence = { coViewers: new Map(), coBuyers: new Map() };
  const seeds = seedIds.slice(0, CO_OCCURRENCE.MAX_SEEDS);
  if (seeds.length === 0) return empty;
  const since = daysBefore(now, CO_OCCURRENCE.LOOKBACK_DAYS);
  const notMe = excludeUserId ? { not: excludeUserId } : undefined;
  const seedSet = new Set(seeds);

  const [viewPeers, buyerOrders] = await Promise.all([
    prisma.userEvent.groupBy({
      by: ['userId'],
      where: { productId: { in: seeds }, type: { in: CO_OCCURRENCE.VIEW_EVENT_TYPES }, createdAt: { gte: since }, ...(notMe ? { userId: notMe } : {}) },
      _max: { createdAt: true },
      orderBy: [{ _max: { createdAt: 'desc' } }, { userId: 'asc' }],
      take: CO_OCCURRENCE.MAX_PEERS,
    }),
    prisma.order.findMany({
      where: { ...confirmedOrderWhere(since), items: { some: { productId: { in: seeds } } }, ...(notMe ? { userId: notMe } : {}) },
      distinct: ['userId'],
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: CO_OCCURRENCE.MAX_PEERS,
      select: { userId: true },
    }),
  ]);

  const viewerIds = viewPeers.map((p) => p.userId);
  const buyerIds = buyerOrders.map((o) => o.userId);

  const [viewPairs, boughtItems] = await Promise.all([
    viewerIds.length
      ? prisma.userEvent.groupBy({
          by: ['productId', 'userId'],
          where: { userId: { in: viewerIds }, type: { in: CO_OCCURRENCE.VIEW_EVENT_TYPES }, createdAt: { gte: since }, productId: { not: null } },
          orderBy: [{ productId: 'asc' }, { userId: 'asc' }],
          take: CO_OCCURRENCE.MAX_PEER_PAIRS,
        })
      : Promise.resolve([] as Array<{ productId: string | null; userId: string }>),
    buyerIds.length
      ? prisma.orderItem.findMany({
          where: { order: { ...confirmedOrderWhere(since), userId: { in: buyerIds } } },
          take: CO_OCCURRENCE.MAX_PEER_PAIRS,
          orderBy: { id: 'asc' },
          select: { productId: true, order: { select: { userId: true } } },
        })
      : Promise.resolve([] as Array<{ productId: string; order: { userId: string } }>),
  ]);

  return {
    coViewers: countDistinct(viewPairs, seedSet),
    coBuyers: countDistinct(boughtItems.map((i) => ({ productId: i.productId, userId: i.order.userId })), seedSet),
  };
};

const candidateIds = (where: Prisma.ProductWhereInput, take: number) =>
  prisma.product
    .findMany({ where: publicProductWhere({ ...where, stock: { gt: 0 } }), orderBy: RECOMMENDED_PRODUCT_ORDER, take, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

const topKeys = (map: Map<string, number>, count: number) =>
  Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, count)
    .map(([key]) => key);

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RecommendationRequest {
  /** Logged-in CUSTOMER id from the verified token, or null. Never taken from the client. */
  userId: string | null;
  context: RecommendationContext;
  productId?: string | null;
  /** Client-reported cart products: recommendation context only, never trusted for anything else. */
  cartProductIds?: string[];
  /** Bounded anonymous browser context. It can influence recommendations only. */
  interestProductIds?: string[];
  interestCategoryIds?: string[];
  limit?: number;
  now?: Date;
}

export const getRecommendations = async (request: RecommendationRequest): Promise<RecommendationResult> => {
  const now = request.now ?? new Date();
  const limit = clampLimit(request.limit, LIMITS.DEFAULT, LIMITS.MAX);
  const { context, userId } = request;
  const empty: RecommendationResult = { context, personalized: false, items: [] };

  const [{ parents, categories }, accountEvents, serverCart, guestProducts] = await Promise.all([
    loadParents(),
    userId ? loadCustomerEvents(userId, now) : Promise.resolve([] as InterestEvent[]),
    userId && context === 'cart'
      ? prisma.cartItem.findMany({ where: { userId }, select: { productId: true }, take: LIMITS.CART_CONTEXT_MAX_IDS })
      : Promise.resolve([] as Array<{ productId: string }>),
    request.interestProductIds?.length
      ? prisma.product.findMany({
          where: publicProductWhere({ id: { in: request.interestProductIds.slice(0, LIMITS.GUEST_PROFILE_MAX_PRODUCTS) } }),
          select: { id: true, categoryId: true, vendorId: true },
        })
      : Promise.resolve([] as Array<{ id: string; categoryId: string; vendorId: string }>),
  ]);
  const guestProductById = new Map(guestProducts.map((product) => [product.id, product]));
  const guestEvents: InterestEvent[] = (request.interestProductIds ?? [])
    .slice(0, LIMITS.GUEST_PROFILE_MAX_PRODUCTS)
    .flatMap((id, index) => {
      const product = guestProductById.get(id);
      return product
        ? [{
            type: 'PRODUCT_VIEW',
            productId: product.id,
            categoryId: product.categoryId,
            vendorId: product.vendorId,
            createdAt: new Date(now.getTime() - index * 60_000),
          }]
        : [];
    });
  const validCategoryIds = new Set(categories.map((category) => category.id));
  for (const [index, categoryId] of (request.interestCategoryIds ?? []).slice(0, LIMITS.GUEST_PROFILE_MAX_CATEGORIES).entries()) {
    if (validCategoryIds.has(categoryId)) {
      guestEvents.push({
        type: 'CATEGORY_VIEW',
        productId: null,
        categoryId,
        vendorId: null,
        createdAt: new Date(now.getTime() - index * 60_000),
      });
    }
  }
  // Anonymous context bridges a brand-new account, but never keeps double-counting once the
  // account has its own positive history. Return markers are retained in either case.
  const hasAccountInterest = accountEvents.some(
    (event) => EVENT_WEIGHTS[event.type as InterestEventType] !== undefined && !!(event.productId || event.categoryId || event.vendorId)
  );
  const events = hasAccountInterest ? accountEvents : [...accountEvents, ...guestEvents];
  const profile = events.length > 0 ? buildInterestProfile(events, parents, now) : null;

  // Context: products the list is "about" and products it must not contain.
  let contextProductIds: string[] = [];
  if (context === 'product') {
    if (!request.productId) return empty;
    const source = await prisma.product.findFirst({ where: publicProductWhere({ id: request.productId }), select: { id: true } });
    if (!source) return empty;
    contextProductIds = [source.id];
  } else if (context === 'cart') {
    const ids = [...serverCart.map((c) => c.productId), ...(request.cartProductIds ?? [])];
    contextProductIds = Array.from(new Set(ids)).slice(0, LIMITS.CART_CONTEXT_MAX_IDS);
  }
  const contextRows = contextProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: contextProductIds } }, select: { id: true, categoryId: true } })
    : [];
  const contextCategoryIds = Array.from(new Set(contextRows.map((r) => r.categoryId)));
  const exclude = new Set(context === 'home' ? [] : contextRows.map((r) => r.id));
  const notExcluded = exclude.size ? { id: { notIn: Array.from(exclude) } } : {};

  const seeds =
    context === 'home'
      ? topKeys(profile?.productInterest ?? new Map(), CO_OCCURRENCE.MAX_SEEDS).filter((id) => !profile?.returnedProducts.has(id))
      : contextRows.map((r) => r.id);
  const co = coOccurrenceScores(await loadCoOccurrence(seeds, userId, now));

  // Candidate pool, in priority order, capped at CANDIDATES.MAX.
  const siblingRoots = Array.from(
    new Set(contextCategoryIds.map((id) => parents.get(id) ?? null).filter((id): id is string => !!id))
  );
  const topCategories = profile ? topKeys(profile.categoryAffinity, CANDIDATES.TOP_CATEGORIES) : [];
  const candidateLists = await Promise.all([
    Promise.resolve(
      Array.from(co.entries())
        .sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1))
        .slice(0, CO_OCCURRENCE.MAX_CANDIDATES)
        .map(([id]) => id)
    ),
    contextCategoryIds.length ? candidateIds({ ...notExcluded, categoryId: { in: contextCategoryIds } }, CANDIDATES.RELATED_CATEGORY) : [],
    siblingRoots.length
      ? candidateIds(
          { ...notExcluded, categoryId: { in: getDescendantCategoryIds(categories, siblingRoots) } },
          CANDIDATES.RELATED_CATEGORY
        )
      : [],
    ...topCategories.map((id) =>
      candidateIds({ ...notExcluded, categoryId: { in: getDescendantCategoryIds(categories, [id]) } }, CANDIDATES.PER_CATEGORY)
    ),
    candidateIds(notExcluded, CANDIDATES.GLOBAL),
  ]);
  const pool: string[] = [];
  const seen = new Set<string>(exclude);
  for (const list of candidateLists) {
    for (const id of list) {
      if (pool.length >= CANDIDATES.MAX) break;
      if (seen.has(id)) continue;
      seen.add(id);
      pool.push(id);
    }
  }
  if (pool.length === 0) return empty;

  // Visibility is re-applied here, so co-occurrence ids of hidden products drop out too.
  const products = await prisma.product.findMany({
    where: publicProductWhere({ id: { in: pool } }),
    include: recommendationInclude,
  });
  const scored = scoreCandidates({ products, profile, coOccurrence: co, contextCategoryIds, parents });
  return {
    context,
    personalized: !!profile && profile.totalInterest >= HISTORY.PERSONALIZED_LABEL_AT,
    items: rankAndDiversify(scored, limit),
  };
};

/**
 * The customer's own recently viewed products: each product once (latest view), public products of
 * approved vendors only, in-stock first, newest view first. Read from UserEvent; no extra table.
 */
export const getRecentlyViewed = async (userId: string, rawLimit?: unknown, now: Date = new Date()): Promise<RecommendationProduct[]> => {
  const limit = clampLimit(rawLimit, LIMITS.RECENTLY_VIEWED_DEFAULT, LIMITS.RECENTLY_VIEWED_MAX);
  const groups = await prisma.userEvent.groupBy({
    by: ['productId'],
    where: { userId, type: 'PRODUCT_VIEW', productId: { not: null }, createdAt: { gte: daysBefore(now, HISTORY.LOOKBACK_DAYS) } },
    _max: { createdAt: true },
    orderBy: [{ _max: { createdAt: 'desc' } }, { productId: 'asc' }],
    take: LIMITS.RECENTLY_VIEWED_CANDIDATES,
  });
  const ids = groups.map((g) => g.productId).filter((id): id is string => !!id);
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: publicProductWhere({ id: { in: ids } }), include: recommendationInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter((row): row is RecommendationProduct => !!row);
  return [...ordered.filter((p) => p.stock > 0), ...ordered.filter((p) => p.stock <= 0)].slice(0, limit);
};

/** Public, current product data for locally stored guest ids, preserving browser recency order. */
export const getGuestRecentlyViewed = async (productIds: string[], rawLimit?: unknown): Promise<RecommendationProduct[]> => {
  const limit = clampLimit(rawLimit, LIMITS.RECENTLY_VIEWED_DEFAULT, LIMITS.RECENTLY_VIEWED_MAX);
  const ids = Array.from(new Set(productIds)).slice(0, LIMITS.GUEST_PROFILE_MAX_PRODUCTS);
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: publicProductWhere({ id: { in: ids } }), include: recommendationInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is RecommendationProduct => !!row).slice(0, limit);
};
