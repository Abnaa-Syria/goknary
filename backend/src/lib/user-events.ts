import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { isIssuedBeforePasswordChange, verifyAccessToken } from './jwt';
import { getUnitPrice } from './variants';

/**
 * First-party behavior tracking (F1). Only logged-in CUSTOMER accounts are tracked; guests,
 * vendors, admins and staff never produce events. Nothing here talks to an external service.
 *
 * Tracking is best-effort: every function in this module swallows its own errors so a failed
 * insert can never break the cart, wishlist, checkout, payment or refund flow that triggered it.
 */

export const USER_EVENT_TYPES = [
  'PRODUCT_VIEW',
  'CATEGORY_VIEW',
  'SEARCH',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'ADD_TO_WISHLIST',
  'REMOVE_FROM_WISHLIST',
  'PURCHASE',
  'RETURN_REQUEST',
] as const;

export type UserEventType = (typeof USER_EVENT_TYPES)[number];

/** The only types `POST /api/events` accepts. Everything else is recorded by the server itself. */
export const CLIENT_TRACKABLE_EVENT_TYPES = ['PRODUCT_VIEW', 'CATEGORY_VIEW'] as const;

export type ClientTrackableEventType = (typeof CLIENT_TRACKABLE_EVENT_TYPES)[number];

export const isUserEventType = (value: unknown): value is UserEventType =>
  typeof value === 'string' && (USER_EVENT_TYPES as readonly string[]).includes(value);

export const isClientTrackableEventType = (value: unknown): value is ClientTrackableEventType =>
  typeof value === 'string' && (CLIENT_TRACKABLE_EVENT_TYPES as readonly string[]).includes(value);

/** Recommended raw-event retention. Not enforced automatically; see the F1 report. */
export const USER_EVENT_RETENTION_MONTHS = 12;

const SEARCH_QUERY_MAX_LENGTH = 191;
const METADATA_STRING_MAX_LENGTH = 100;

// Allow-list: personal data (email, phone, address, name), IP/User-Agent, tokens and payment
// references can never reach the metadata column because their keys are dropped here.
const METADATA_KEYS = [
  'source',
  'quantity',
  'variantId',
  'results',
  'unitPrice',
  'lineTotal',
  'paymentMethod',
  'refundRequestId',
] as const;

type MetadataKey = (typeof METADATA_KEYS)[number];

export type UserEventMetadata = Partial<Record<MetadataKey, string | number | boolean | null | undefined>>;

export interface TrackUserEventInput {
  userId: string;
  type: UserEventType;
  productId?: string | null;
  categoryId?: string | null;
  vendorId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  searchQuery?: string | null;
  metadata?: UserEventMetadata;
  /** Makes the event idempotent: a second insert with the same key is silently ignored. */
  dedupeKey?: string | null;
}

export type CustomerEventInput = Omit<TrackUserEventInput, 'userId'>;

export const sanitizeEventMetadata = (metadata: UserEventMetadata | undefined): string | null => {
  if (!metadata) return null;
  const clean: Record<string, string | number | boolean> = {};
  for (const key of METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === 'string') {
      clean[key] = value.slice(0, METADATA_STRING_MAX_LENGTH);
    } else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      clean[key] = value;
    }
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
};

export const normalizeSearchQuery = (query: string | null | undefined): string | null => {
  if (typeof query !== 'string') return null;
  const trimmed = query.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, SEARCH_QUERY_MAX_LENGTH) : null;
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// Only the error class/code is logged: Prisma messages can echo the values being written.
const describeTrackingError = (error: unknown): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `Prisma ${error.code}`;
  if (error instanceof Error) return error.name;
  return 'unknown error';
};

const logTrackingFailure = (type: string, error: unknown) => {
  console.error(`[user-events] Failed to record ${type} event: ${describeTrackingError(error)}`);
};

/**
 * Records one event. Never throws. When a productId is given without its category/vendor, both are
 * read from the product so analytics can group events by category and vendor.
 */
export const trackUserEvent = async (input: TrackUserEventInput): Promise<void> => {
  try {
    let { categoryId, vendorId } = input;
    if (input.productId && (categoryId === undefined || vendorId === undefined)) {
      const product = await prisma.product.findUnique({
        where: { id: input.productId },
        select: { categoryId: true, vendorId: true },
      });
      if (categoryId === undefined) categoryId = product?.categoryId ?? null;
      if (vendorId === undefined) vendorId = product?.vendorId ?? null;
    }

    await prisma.userEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        productId: input.productId ?? null,
        categoryId: categoryId ?? null,
        vendorId: vendorId ?? null,
        orderId: input.orderId ?? null,
        orderItemId: input.orderItemId ?? null,
        searchQuery: normalizeSearchQuery(input.searchQuery),
        metadata: sanitizeEventMetadata(input.metadata),
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  } catch (error) {
    if (input.dedupeKey && isUniqueViolation(error)) return;
    logTrackingFailure(input.type, error);
  }
};

/**
 * Resolves the logged-in customer from an optional Bearer token on routes that do not run
 * `authenticate` (cart, product search). Returns null for guests, invalid/expired tokens,
 * revoked sessions and every non-CUSTOMER role. Never throws and never touches `req.user`.
 */
export const resolveCustomerIdFromRequest = async (req: Request): Promise<string | null> => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;

    let decoded: { id?: string; role?: string; iat?: number };
    try {
      decoded = verifyAccessToken(header.substring(7));
    } catch {
      return null;
    }
    if (!decoded?.id || decoded.role !== 'CUSTOMER') return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, passwordChangedAt: true },
    });
    if (!user || user.role !== 'CUSTOMER') return null;
    if (isIssuedBeforePasswordChange(decoded.iat, user.passwordChangedAt)) return null;
    return decoded.id;
  } catch {
    return null;
  }
};

/** Fire-and-forget: resolves the customer from the request token, then records the event. */
export const trackCustomerEventFromRequest = (req: Request, event: CustomerEventInput): void => {
  void (async () => {
    const userId = await resolveCustomerIdFromRequest(req);
    if (!userId) return;
    await trackUserEvent({ ...event, userId });
  })().catch((error) => logTrackingFailure(event.type, error));
};

/** For routes behind `authenticate`: records only when the authenticated user is a CUSTOMER. */
export const trackAuthenticatedCustomerEvent = (
  user: { id: string; role: string } | undefined,
  event: CustomerEventInput
): void => {
  if (!user || user.role !== 'CUSTOMER') return;
  void trackUserEvent({ ...event, userId: user.id });
};

/**
 * One PURCHASE event per order item, for orders whose purchase is confirmed (COD at creation,
 * Kashier on the verified paid webhook). `PURCHASE:<orderItemId>` dedupe keys make repeated calls
 * (duplicate webhooks, retries) harmless. Never throws.
 */
export const trackPurchasesForOrders = async (orderIds: string[]): Promise<void> => {
  if (orderIds.length === 0) return;
  try {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        userId: true,
        vendorId: true,
        paymentMethod: true,
        user: { select: { role: true } },
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            price: true,
            discountPrice: true,
            product: { select: { categoryId: true } },
          },
        },
      },
    });

    const data: Prisma.UserEventCreateManyInput[] = [];
    for (const order of orders) {
      if (order.user?.role !== 'CUSTOMER') continue;
      for (const item of order.items) {
        const unitPrice = getUnitPrice(item);
        data.push({
          userId: order.userId,
          type: 'PURCHASE',
          productId: item.productId,
          categoryId: item.product?.categoryId ?? null,
          vendorId: order.vendorId,
          orderId: order.id,
          orderItemId: item.id,
          metadata: sanitizeEventMetadata({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice,
            lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
            paymentMethod: order.paymentMethod,
          }),
          dedupeKey: `PURCHASE:${item.id}`,
        });
      }
    }

    if (data.length > 0) {
      await prisma.userEvent.createMany({ data, skipDuplicates: true });
    }
  } catch (error) {
    logTrackingFailure('PURCHASE', error);
  }
};
