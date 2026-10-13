import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { prisma } from '../lib/prisma';
import { calculateCheckoutExpiresAt, getCheckoutExpiryBatchSize } from '../lib/checkout-expiry-config';
import { runCheckoutExpirySweep } from '../lib/checkout-expiry-scheduler';
import { cancelCheckoutAttempt, markCheckoutPaid } from './checkout-lifecycle.service';
import {
  normalizeKashierReconciliation,
  processExpiredCheckoutAttempt,
  reconcileCheckoutPayment,
} from './checkout-expiry.service';

const originalTransaction = prisma.$transaction;
const originalAttemptFindFirst = prisma.checkoutAttempt.findFirst;
const originalAttemptUpdateMany = prisma.checkoutAttempt.updateMany;
const originalAttemptFindMany = prisma.checkoutAttempt.findMany;
const originalBatchSize = process.env.CHECKOUT_EXPIRY_BATCH_SIZE;

afterEach(() => {
  (prisma as any).$transaction = originalTransaction;
  (prisma.checkoutAttempt as any).findFirst = originalAttemptFindFirst;
  (prisma.checkoutAttempt as any).updateMany = originalAttemptUpdateMany;
  (prisma.checkoutAttempt as any).findMany = originalAttemptFindMany;
  if (originalBatchSize === undefined) delete process.env.CHECKOUT_EXPIRY_BATCH_SIZE;
  else process.env.CHECKOUT_EXPIRY_BATCH_SIZE = originalBatchSize;
});

const makeLifecycleStore = (options: { expiresAt?: Date | null; status?: string; vendors?: number } = {}) => {
  const attempt: any = {
    id: 'attempt-1', userId: 'user-1', paymentMethod: 'KASHIER',
    status: options.status || 'PAYMENT_READY', providerReference: 'gk_checkout_attempt-1',
    providerSessionId: 'session-1', providerSessionUrl: 'https://pay.example/session-1',
    providerStatus: 'PENDING', paymentInitiationStartedAt: new Date('2026-10-10T12:00:00Z'),
    expiresAt: options.expiresAt === undefined ? new Date('2026-10-10T13:00:00Z') : options.expiresAt,
  };
  const count = options.vendors || 2;
  const orders = Array.from({ length: count }, (_, index) => ({
    id: `order-${index + 1}`, checkoutAttemptId: attempt.id, userId: attempt.userId,
    vendorId: `vendor-${index + 1}`, status: 'PENDING', paymentStatus: 'PENDING',
    paymentTransactionId: null, paymentProviderOrderId: null, couponCode: 'SAVE10',
    createdAt: new Date('2026-10-10T12:00:00Z'),
    items: [{ productId: `product-${index + 1}`, variantId: index === 0 ? 'variant-1' : null, quantity: index + 1 }],
  }));
  const stock = new Map<string, number>([['variant-1', 3], ['product-1', 3], ['product-2', 4]]);
  let couponUsedCount = 1;
  let historyWrites = 0;
  let stockMutations = 0;

  const matchesNotPaid = (where: any, order: any) => {
    if (!where.OR) return true;
    return order.paymentStatus == null || order.paymentStatus !== 'PAID';
  };
  const statusMatches = (condition: any, current: string) => {
    if (!condition) return true;
    if (typeof condition === 'string') return condition === current;
    if (condition.in) return condition.in.includes(current);
    if (condition.notIn) return !condition.notIn.includes(current);
    if (condition.not) return condition.not !== current;
    return true;
  };
  const attemptMatches = (where: any) => {
    if (where.id && where.id !== attempt.id) return false;
    if (where.paymentMethod && where.paymentMethod !== attempt.paymentMethod) return false;
    if (!statusMatches(where.status, attempt.status)) return false;
    if (where.expiresAt?.not === null && attempt.expiresAt == null) return false;
    if (where.expiresAt?.lte && (!attempt.expiresAt || attempt.expiresAt > where.expiresAt.lte)) return false;
    return true;
  };
  const tx: any = {
    checkoutAttempt: {
      updateMany: async ({ where, data }: any) => {
        if (!attemptMatches(where)) return { count: 0 };
        Object.assign(attempt, data);
        return { count: 1 };
      },
      findUnique: async () => ({ status: attempt.status }),
    },
    order: {
      findMany: async ({ where, select }: any) => {
        const selected = where.checkoutAttemptId
          ? orders.filter((order) => order.checkoutAttemptId === where.checkoutAttemptId)
          : orders.filter((order) => where.id.in.includes(order.id));
        if (select?.items) return selected.map((order) => ({ userId: order.userId, createdAt: order.createdAt, items: order.items }));
        return selected.map((order) => ({ ...order }));
      },
      updateMany: async ({ where, data }: any) => {
        const order = orders.find((candidate) => candidate.id === where.id);
        if (!order || (where.checkoutAttemptId && order.checkoutAttemptId !== where.checkoutAttemptId)) return { count: 0 };
        if (!statusMatches(where.status, order.status) || !matchesNotPaid(where, order)) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: any) => orders.find((order) => order.id === where.id) || null,
      findUniqueOrThrow: async ({ where }: any) => orders.find((order) => order.id === where.id),
    },
    orderItem: {
      findMany: async ({ where }: any) => {
        const order = orders.find((candidate) => candidate.id === where.orderId);
        return (order?.items || []).map((item) => ({ ...item, refundRequests: [] }));
      },
    },
    productVariant: {
      updateMany: async ({ where, data }: any) => {
        if (where.id !== 'variant-1') return { count: 0 };
        stock.set('variant-1', (stock.get('variant-1') || 0) + data.stock.increment);
        stockMutations += 1;
        return { count: 1 };
      },
      count: async () => 1,
      aggregate: async () => ({ _sum: { stock: stock.get('variant-1') } }),
    },
    product: {
      update: async ({ where, data }: any) => {
        if (data.stock?.increment) {
          stock.set(where.id, (stock.get(where.id) || 0) + data.stock.increment);
          stockMutations += 1;
        } else if (typeof data.stock === 'number') stock.set(where.id, data.stock);
        return {};
      },
    },
    coupon: {
      updateMany: async ({ where }: any) => {
        if (where.code !== 'SAVE10' || couponUsedCount <= 0) return { count: 0 };
        couponUsedCount -= 1;
        return { count: 1 };
      },
    },
    orderStatusHistory: { create: async () => { historyWrites += 1; return {}; } },
    cartItem: { findFirst: async () => null, delete: async () => ({}), update: async () => ({}) },
  };
  (prisma as any).$transaction = async (work: any) => work(tx);
  (prisma.checkoutAttempt as any).findFirst = async ({ where }: any) => attemptMatches(where)
    ? { ...attempt, orders: orders.map(({ id }) => ({ id })) }
    : null;
  (prisma.checkoutAttempt as any).updateMany = tx.checkoutAttempt.updateMany;
  return {
    attempt, orders, stock,
    get couponUsedCount() { return couponUsedCount; },
    get historyWrites() { return historyWrites; },
    get stockMutations() { return stockMutations; },
  };
};

describe('checkout expiry reconciliation', () => {
  it('uses one configurable 24-hour default expiry calculation', () => {
    const now = new Date('2026-10-10T13:00:00.000Z');
    assert.equal(
      calculateCheckoutExpiresAt(now, {}).toISOString(),
      '2026-10-11T13:00:00.000Z',
    );
    assert.equal(
      calculateCheckoutExpiresAt(now, { CHECKOUT_PAYMENT_TTL_HOURS: '6' }).toISOString(),
      '2026-10-10T19:00:00.000Z',
    );
  });

  it('normalizes paid, final unpaid, pending, and unknown provider states', () => {
    assert.equal(normalizeKashierReconciliation({ status: 'CAPTURED' }).state, 'PAID');
    assert.equal(normalizeKashierReconciliation({ status: 'EXPIRED' }).state, 'FINAL_UNPAID');
    assert.equal(normalizeKashierReconciliation({ status: 'PENDING' }).state, 'PENDING');
    assert.equal(normalizeKashierReconciliation({ status: 'unexpected' }).state, 'UNKNOWN');
  });

  it('treats never-initiated ORDERS_CREATED as final unpaid without contacting Kashier', async () => {
    let calls = 0;
    const result = await reconcileCheckoutPayment({
      id: 'a', status: 'ORDERS_CREATED', paymentInitiationStartedAt: null,
      providerSessionId: null, providerSessionUrl: null, providerReference: 'ref', orders: [],
    } as any, {
      findPaymentOrderByReference: async () => { calls += 1; return null; },
      getPaymentSession: async () => null,
    });
    assert.equal(result.state, 'FINAL_UNPAID');
    assert.equal(result.providerStatus, 'NOT_INITIATED');
    assert.equal(calls, 0);
  });

  it('recovers a lost initiation response when the provider finds the pending session', async () => {
    const result = await reconcileCheckoutPayment({
      id: 'a', status: 'PAYMENT_INITIATING', paymentInitiationStartedAt: new Date(),
      providerSessionId: null, providerSessionUrl: null, providerReference: 'ref', orders: [],
    } as any, {
      findPaymentOrderByReference: async () => ({ status: 'PENDING', sessionId: 's-1', sessionUrl: 'https://pay/s-1' }),
      getPaymentSession: async () => null,
    });
    assert.equal(result.state, 'PENDING');
    assert.equal(result.sessionId, 's-1');
    assert.equal(result.sessionUrl, 'https://pay/s-1');
  });

  it('returns UNKNOWN on provider timeout and never claims a final result', async () => {
    const result = await reconcileCheckoutPayment({
      id: 'a', status: 'PAYMENT_READY', paymentInitiationStartedAt: new Date(),
      providerSessionId: 's', providerSessionUrl: 'url', providerReference: 'ref', orders: [],
    } as any, {
      findPaymentOrderByReference: async () => { throw new Error('timeout'); },
      getPaymentSession: async () => null,
    });
    assert.equal(result.state, 'UNKNOWN');
  });

  it('leaves provider PENDING and UNKNOWN attempts recoverable with stock untouched', async () => {
    for (const state of ['PENDING', 'UNKNOWN'] as const) {
      const store = makeLifecycleStore();
      const result = await processExpiredCheckoutAttempt(store.attempt.id, {
        now: new Date('2026-10-10T14:00:00Z'),
        reconcile: async () => ({ state, providerStatus: state, references: {} }),
      });
      assert.equal(result.outcome, state);
      assert.equal(store.orders.every((order) => order.status === 'PENDING'), true);
      assert.equal(store.stockMutations, 0);
      assert.equal(store.couponUsedCount, 1);
    }
  });

  it('completes the normal paid transition when reconciliation finds a captured payment', async () => {
    const store = makeLifecycleStore();
    const result = await processExpiredCheckoutAttempt(store.attempt.id, {
      now: new Date('2026-10-10T14:00:00Z'),
      reconcile: async () => ({
        state: 'PAID', providerStatus: 'CAPTURED',
        references: { transactionId: 'tx-recovered', providerOrderId: 'po-recovered' },
      }),
      notify: false,
      track: false,
    });
    assert.equal(result.outcome, 'PAID');
    assert.equal(store.attempt.status, 'PAID');
    assert.equal(store.orders.every((order) => order.status === 'CONFIRMED'), true);
    assert.equal(store.stockMutations, 0);
    assert.equal(store.couponUsedCount, 1);
  });
});

describe('atomic checkout cancellation lifecycle', () => {
  it('cancels an expired multi-vendor group, restores variant/product stock, and coupon once', async () => {
    const store = makeLifecycleStore();
    const first = await cancelCheckoutAttempt({
      attemptId: store.attempt.id, now: new Date('2026-10-10T14:00:00Z'),
      reason: 'expired', notify: false,
    });
    const second = await cancelCheckoutAttempt({
      attemptId: store.attempt.id, now: new Date('2026-10-10T14:00:00Z'),
      reason: 'expired again', notify: false,
    });
    assert.equal(first.won, true);
    assert.equal(second.won, false);
    assert.equal(store.attempt.status, 'CANCELLED');
    assert.deepEqual(store.orders.map((order) => order.status), ['CANCELLED', 'CANCELLED']);
    assert.equal(store.stock.get('variant-1'), 4);
    assert.equal(store.stock.get('product-2'), 6);
    assert.equal(store.stockMutations, 2);
    assert.equal(store.couponUsedCount, 0);
    assert.equal(store.historyWrites, 2);
  });

  it('does not expire historical attempts with expiresAt null', async () => {
    const store = makeLifecycleStore({ expiresAt: null });
    const result = await cancelCheckoutAttempt({ attemptId: store.attempt.id, reason: 'expired', notify: false });
    assert.equal(result.won, false);
    assert.equal(store.orders.every((order) => order.status === 'PENDING'), true);
    assert.equal(store.stockMutations, 0);
  });

  it('lets PAID win atomically without cancellation, stock, or coupon compensation', async () => {
    const store = makeLifecycleStore();
    const [paid, cancelled] = await Promise.all([
      markCheckoutPaid({
        attemptId: store.attempt.id, orderIds: store.orders.map((order) => order.id),
        references: { transactionId: 'tx-1', providerOrderId: 'po-1' }, notify: false, track: false,
      }),
      cancelCheckoutAttempt({
        attemptId: store.attempt.id, now: new Date('2026-10-10T14:00:00Z'),
        reason: 'expired', notify: false,
      }),
    ]);
    assert.equal(paid.won, true);
    assert.equal(cancelled.won, false);
    assert.equal(store.attempt.status, 'PAID');
    assert.equal(store.orders.every((order) => order.status === 'CONFIRMED'), true);
    assert.equal(store.stockMutations, 0);
    assert.equal(store.couponUsedCount, 1);

    const historyAfterFirst = store.historyWrites;
    const repeated = await markCheckoutPaid({
      attemptId: store.attempt.id, orderIds: store.orders.map((order) => order.id),
      references: { transactionId: 'tx-1', providerOrderId: 'po-1' }, notify: false, track: false,
    });
    assert.deepEqual(repeated.paidIds, []);
    assert.equal(store.historyWrites, historyAfterFirst);
  });

  it('lets CANCELLED win atomically and routes a late paid webhook to manual-refund state', async () => {
    const store = makeLifecycleStore();
    const cancelled = await cancelCheckoutAttempt({
      attemptId: store.attempt.id,
      now: new Date('2026-10-10T14:00:00Z'),
      reason: 'expired',
      notify: false,
    });
    const paid = await markCheckoutPaid({
      attemptId: store.attempt.id, orderIds: store.orders.map((order) => order.id),
      references: { transactionId: 'tx-late' }, notify: false, track: false,
    });
    assert.equal(cancelled.won, true);
    assert.equal(paid.won, false);
    assert.equal(store.attempt.status, 'CANCELLED');
    assert.equal(store.orders.every((order) => order.status === 'CANCELLED'), true);
    assert.equal(store.orders.every((order) => order.paymentStatus === 'PAID'), true);
    assert.equal(store.stockMutations, 2);

    const repeated = await markCheckoutPaid({
      attemptId: store.attempt.id, orderIds: store.orders.map((order) => order.id),
      references: { transactionId: 'tx-late' }, notify: false, track: false,
    });
    assert.deepEqual(repeated.lateAfterCancellation, []);
    assert.equal(store.stockMutations, 2);
    assert.equal(store.historyWrites, 4);
  });

  it('keeps COD outside the online-expiry transition', async () => {
    const store = makeLifecycleStore();
    store.attempt.paymentMethod = 'COD';
    const result = await cancelCheckoutAttempt({ attemptId: store.attempt.id, reason: 'expired', notify: false });
    assert.equal(result.won, false);
    assert.equal(store.stockMutations, 0);
  });

  it('uses the central cancellation path for final provider expiry', async () => {
    const store = makeLifecycleStore();
    const result = await processExpiredCheckoutAttempt(store.attempt.id, {
      now: new Date('2026-10-10T14:00:00Z'),
      reconcile: async () => ({ state: 'FINAL_UNPAID', providerStatus: 'EXPIRED', references: {} }),
      notify: false,
      track: false,
    });
    assert.equal(result.outcome, 'CANCELLED');
    assert.equal(store.orders.every((order) => order.status === 'CANCELLED'), true);
    assert.equal(store.stockMutations, 2);
    assert.equal(store.couponUsedCount, 0);
  });
});

describe('checkout expiry scheduler', () => {
  it('queries a bounded indexed candidate batch and excludes null expiry semantically', async () => {
    process.env.CHECKOUT_EXPIRY_BATCH_SIZE = '37';
    let query: any;
    (prisma.checkoutAttempt as any).findMany = async (args: any) => { query = args; return []; };
    const summary = await runCheckoutExpirySweep(new Date('2026-10-10T14:00:00Z'));
    assert.equal(summary.scanned, 0);
    assert.equal(query.take, 37);
    assert.equal(query.where.paymentMethod, 'KASHIER');
    assert.equal(query.where.expiresAt.not, null);
    assert.ok(query.where.expiresAt.lte instanceof Date);
    assert.equal(getCheckoutExpiryBatchSize(), 37);
  });

  it('continues a batch when one attempt fails', async () => {
    (prisma.checkoutAttempt as any).findMany = async () => [{ id: 'bad' }, { id: 'good' }];
    const processed: string[] = [];
    const summary = await runCheckoutExpirySweep(new Date(), async (id: string) => {
      processed.push(id);
      if (id === 'bad') throw new Error('one attempt failed');
      return { outcome: 'CANCELLED' } as any;
    });
    assert.deepEqual(processed, ['bad', 'good']);
    assert.equal(summary.failed, 1);
    assert.equal(summary.cancelled, 1);
  });
});
