import { Request, Response } from 'express';
import { resolveCustomerIdFromRequest } from '../lib/user-events';
import { toPublicProduct } from '../lib/visibility';
import { LIMITS, RECOMMENDATION_CONTEXTS, RecommendationContext } from '../lib/recommendation-config';
import { RecommendationProduct, getGuestRecentlyViewed, getRecentlyViewed, getRecommendations } from '../lib/recommendations';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const parseContext = (raw: unknown): RecommendationContext | null =>
  typeof raw === 'string' && (RECOMMENDATION_CONTEXTS as readonly string[]).includes(raw) ? (raw as RecommendationContext) : null;

/** Comma-separated (or repeated) ids; anything that is not an id is dropped, and the list is capped. */
const parseIdList = (raw: unknown, max: number = LIMITS.CART_CONTEXT_MAX_IDS): string[] => {
  const values = (Array.isArray(raw) ? raw : [raw]).flatMap((v) => (typeof v === 'string' ? v.split(',') : []));
  return Array.from(new Set(values.map((v) => v.trim()).filter((v) => ID_PATTERN.test(v)))).slice(0, max);
};

/** Customers only ever receive product data: no scores, reasons, ranking fields or activity of anyone. */
const serializePublicProduct = (product: RecommendationProduct) => toPublicProduct(product);

// GET /api/recommendations?context=home|product|cart&productId=&cartProductIds=&limit=
// The customer is resolved from the Bearer token only; a userId in the request is never read.
export const getRecommendationsHandler = async (req: Request, res: Response) => {
  const context = parseContext(req.query.context);
  if (!context) {
    return res.status(400).json({ error: `context must be one of: ${RECOMMENDATION_CONTEXTS.join(', ')}` });
  }
  const productId = typeof req.query.productId === 'string' && ID_PATTERN.test(req.query.productId) ? req.query.productId : null;
  if (context === 'product' && !productId) {
    return res.status(400).json({ error: 'productId is required for context=product' });
  }

  try {
    const userId = await resolveCustomerIdFromRequest(req);
    const result = await getRecommendations({
      userId,
      context,
      productId,
      cartProductIds: context === 'cart' ? parseIdList(req.query.cartProductIds) : [],
      interestProductIds: parseIdList(req.query.interestProductIds, LIMITS.GUEST_PROFILE_MAX_PRODUCTS),
      interestCategoryIds: parseIdList(req.query.interestCategoryIds, LIMITS.GUEST_PROFILE_MAX_CATEGORIES),
      limit: req.query.limit as unknown as number,
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({
      context: result.context,
      personalized: result.personalized,
      products: result.items.map((item) => serializePublicProduct(item.product)),
    });
  } catch (error) {
    console.error('[recommendations] Failed to build recommendations:', error instanceof Error ? error.name : 'unknown error');
    res.status(500).json({ error: 'Failed to load recommendations' });
  }
};

// GET /api/recommendations/recently-viewed?limit= — empty for guests and non-customer roles.
export const getRecentlyViewedHandler = async (req: Request, res: Response) => {
  try {
    const userId = await resolveCustomerIdFromRequest(req);
    res.set('Cache-Control', 'private, no-store');
    const guestIds = parseIdList(req.query.guestProductIds, LIMITS.GUEST_PROFILE_MAX_PRODUCTS);
    const accountProducts = userId ? await getRecentlyViewed(userId, req.query.limit) : [];
    const guestProducts = await getGuestRecentlyViewed(guestIds, req.query.limit);
    const products = Array.from(
      new Map([...accountProducts, ...guestProducts].map((product) => [product.id, product])).values()
    ).slice(0, LIMITS.RECENTLY_VIEWED_MAX);
    res.json({ products: products.map(serializePublicProduct) });
  } catch (error) {
    console.error('[recommendations] Failed to load recently viewed:', error instanceof Error ? error.name : 'unknown error');
    res.status(500).json({ error: 'Failed to load recently viewed products' });
  }
};
