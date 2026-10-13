import { createHash, randomUUID } from 'crypto';
import { ValidationError } from './errors';

export const IDEMPOTENCY_KEY_REUSE = 'IDEMPOTENCY_KEY_REUSE';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const child = (value as Record<string, unknown>)[key];
        if (child !== undefined) result[key] = canonicalize(child);
        return result;
      }, {});
  }
  return typeof value === 'string' ? value.trim() : value;
};

export interface CheckoutFingerprintInput {
  address: unknown;
  shippingMethod?: string;
  couponCode?: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
  notes?: string;
  paymentMethod: 'COD' | 'KASHIER';
}

export const fingerprintCheckout = (input: CheckoutFingerprintInput): string => {
  const normalized = {
    address: canonicalize(input.address),
    shippingMethod: (input.shippingMethod || 'Standard').trim(),
    couponCode: input.couponCode?.trim().toUpperCase() || null,
    notes: input.notes?.trim() || null,
    paymentMethod: input.paymentMethod,
    items: input.items
      .map((item) => ({
        productId: item.productId.trim(),
        variantId: item.variantId?.trim() || null,
        quantity: item.quantity,
      }))
      .sort((a, b) => `${a.productId}:${a.variantId || ''}`.localeCompare(`${b.productId}:${b.variantId || ''}`)),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
};

export const readIdempotencyKey = (headerValue: unknown, bodyValue?: unknown): string => {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const key = String(raw || bodyValue || '').trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new ValidationError('A valid Idempotency-Key header is required');
  }
  return key;
};

export const createCheckoutAttemptIdentity = () => {
  const id = randomUUID();
  return { id, providerReference: `gk_checkout_${id}` };
};

export const assertMatchingFingerprint = (stored: string, incoming: string) => {
  if (stored !== incoming) {
    const error = new Error('This idempotency key was already used with a different checkout payload');
    error.name = IDEMPOTENCY_KEY_REUSE;
    throw error;
  }
};

interface AtomicCheckoutInput {
  attempt: {
    id: string;
    providerReference: string;
    userId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    paymentMethod: 'COD' | 'KASHIER';
    status: 'COMPLETED' | 'ORDERS_CREATED';
    expiresAt?: Date | null;
  };
  orders: Array<{
    stockLines: Array<{ productId: string; variantId?: string | null; quantity: number; label: string }>;
    data: Record<string, unknown>;
    include?: Record<string, unknown>;
  }>;
  couponId?: string | null;
  clearCartWhere?: Record<string, unknown> | null;
}

/**
 * The attempt insert deliberately happens before any stock mutation. The database unique key is
 * therefore the concurrency gate for the entire multi-vendor order group.
 */
export const createCheckoutAtomically = async (
  db: any,
  input: AtomicCheckoutInput,
  reserve: (tx: any, line: AtomicCheckoutInput['orders'][number]['stockLines'][number]) => Promise<void>,
) => db.$transaction(async (tx: any) => {
  const attempt = await tx.checkoutAttempt.create({ data: input.attempt });
  const orders = [];
  for (const order of input.orders) {
    for (const line of order.stockLines) await reserve(tx, line);
    orders.push(await tx.order.create({ data: { ...order.data, checkoutAttemptId: attempt.id }, include: order.include }));
  }
  if (input.couponId) {
    await tx.coupon.update({ where: { id: input.couponId }, data: { usedCount: { increment: 1 } } });
  }
  if (input.clearCartWhere) await tx.cartItem.deleteMany({ where: input.clearCartWhere });
  return { attempt, orders };
}, { maxWait: 10_000, timeout: 20_000 });
