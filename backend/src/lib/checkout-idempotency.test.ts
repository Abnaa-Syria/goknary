import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IDEMPOTENCY_KEY_REUSE,
  assertMatchingFingerprint,
  createCheckoutAtomically,
  createCheckoutAttemptIdentity,
  fingerprintCheckout,
} from './checkout-idempotency';

const request = (overrides: Record<string, unknown> = {}) => ({
  address: { state: 'Cairo', city: 'Nasr City', line: '1 Main St' },
  shippingMethod: 'Standard',
  couponCode: 'SAVE10',
  notes: '',
  paymentMethod: 'KASHIER' as const,
  items: [
    { productId: 'p-2', variantId: null, quantity: 1 },
    { productId: 'p-1', variantId: 'v-1', quantity: 2 },
  ],
  ...overrides,
});

const makeStore = () => {
  const attempts = new Map<string, any>();
  const orders: any[] = [];
  const stock = new Map([['p-1:v-1', 10], ['p-2:', 10]]);
  let cartClears = 0;
  const tx = {
    checkoutAttempt: {
      create: async ({ data }: any) => {
        const unique = `${data.userId}:${data.idempotencyKey}`;
        if (attempts.has(unique)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        attempts.set(unique, data);
        await Promise.resolve();
        return data;
      },
    },
    order: { create: async ({ data }: any) => { const order = { id: `o-${orders.length + 1}`, ...data }; orders.push(order); return order; } },
    coupon: { update: async () => ({}) },
    cartItem: { deleteMany: async () => { cartClears += 1; return { count: 1 }; } },
  };
  const db = { $transaction: async (work: any) => work(tx) };
  const reserve = async (_tx: any, line: any) => {
    const key = `${line.productId}:${line.variantId || ''}`;
    stock.set(key, (stock.get(key) || 0) - line.quantity);
  };
  return { attempts, orders, stock, db, reserve, get cartClears() { return cartClears; } };
};

const atomicInput = (userId: string, key: string, paymentMethod: 'COD' | 'KASHIER' = 'KASHIER') => {
  const identity = createCheckoutAttemptIdentity();
  return {
    attempt: {
      ...identity,
      userId,
      idempotencyKey: key,
      requestFingerprint: fingerprintCheckout(request({ paymentMethod })),
      paymentMethod,
      status: paymentMethod === 'COD' ? 'COMPLETED' as const : 'ORDERS_CREATED' as const,
      expiresAt: paymentMethod === 'KASHIER' ? new Date('2026-10-11T13:00:00.000Z') : null,
    },
    orders: [
      { stockLines: [{ productId: 'p-1', variantId: 'v-1', quantity: 2, label: 'one' }], data: { vendorId: 'vendor-a' } },
      { stockLines: [{ productId: 'p-2', variantId: null, quantity: 1, label: 'two' }], data: { vendorId: 'vendor-b' } },
    ],
    clearCartWhere: paymentMethod === 'COD' ? { userId } : null,
  };
};

describe('persistent checkout idempotency', () => {
  it('normalizes ordering and rejects the same key with materially different payload', () => {
    const first = fingerprintCheckout(request());
    const reordered = fingerprintCheckout(request({ items: [...request().items].reverse() }));
    assert.equal(reordered, first);
    assert.throws(
      () => assertMatchingFingerprint(first, fingerprintCheckout(request({ address: { state: 'Giza' } }))),
      (error: any) => error.name === IDEMPOTENCY_KEY_REUSE,
    );
  });

  it('creates one multi-vendor group and reserves each stock line once', async () => {
    const store = makeStore();
    const result = await createCheckoutAtomically(store.db, atomicInput('user-a', 'key-000000000001'), store.reserve);
    assert.equal(result.orders.length, 2);
    assert.equal(store.attempts.values().next().value.expiresAt.toISOString(), '2026-10-11T13:00:00.000Z');
    assert.equal(new Set(result.orders.map((order: any) => order.checkoutAttemptId)).size, 1);
    assert.equal(store.stock.get('p-1:v-1'), 8);
    assert.equal(store.stock.get('p-2:'), 9);
  });

  it('uses the database unique gate before stock reservation under concurrent same-key calls', async () => {
    const store = makeStore();
    const key = 'key-000000000002';
    const results = await Promise.allSettled([
      createCheckoutAtomically(store.db, atomicInput('user-a', key), store.reserve),
      createCheckoutAtomically(store.db, atomicInput('user-a', key), store.reserve),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(store.attempts.size, 1);
    assert.equal(store.orders.length, 2);
    assert.equal(store.stock.get('p-1:v-1'), 8);
    assert.equal(store.stock.get('p-2:'), 9);
  });

  it('returns the same order group on a same-key retry with zero extra orders or stock mutation', async () => {
    const store = makeStore();
    const input = atomicInput('user-a', 'key-000000000006');
    const first = await createCheckoutAtomically(store.db, input, store.reserve);
    const beforeStock = [...store.stock.entries()];
    const existing = store.attempts.get('user-a:key-000000000006');
    assertMatchingFingerprint(existing.requestFingerprint, input.attempt.requestFingerprint);
    const replayOrders = store.orders.filter((order) => order.checkoutAttemptId === existing.id);
    assert.deepEqual(replayOrders.map((order) => order.id), first.orders.map((order: any) => order.id));
    assert.equal(store.orders.length, 2);
    assert.deepEqual([...store.stock.entries()], beforeStock);
  });

  it('fails safely when a key is reused with a different checkout payload', async () => {
    const store = makeStore();
    const input = atomicInput('user-a', 'key-000000000007');
    await createCheckoutAtomically(store.db, input, store.reserve);
    const existing = store.attempts.get('user-a:key-000000000007');
    assert.throws(
      () => assertMatchingFingerprint(existing.requestFingerprint, fingerprintCheckout(request({ items: [{ productId: 'p-1', variantId: 'v-1', quantity: 3 }] }))),
      (error: any) => error.name === IDEMPOTENCY_KEY_REUSE,
    );
    assert.equal(store.orders.length, 2);
  });

  it('allows a genuinely new key and scopes uniqueness by user', async () => {
    const store = makeStore();
    await createCheckoutAtomically(store.db, atomicInput('user-a', 'key-000000000003'), store.reserve);
    await createCheckoutAtomically(store.db, atomicInput('user-a', 'key-000000000004'), store.reserve);
    await createCheckoutAtomically(store.db, atomicInput('user-b', 'key-000000000003'), store.reserve);
    assert.equal(store.attempts.size, 3);
    assert.equal(store.orders.length, 6);
  });

  it('keeps COD idempotency while applying COD-only cart cleanup once', async () => {
    const store = makeStore();
    await createCheckoutAtomically(store.db, atomicInput('user-a', 'key-000000000005', 'COD'), store.reserve);
    assert.equal(store.cartClears, 1);
    assert.equal(store.attempts.values().next().value.status, 'COMPLETED');
  });
});
