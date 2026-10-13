import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '../lib/prisma';
import kashierService from '../services/kashier.service.js';
import { initiatePayment, markKashierOrdersPaid } from './payment.controller.js';

const responseRecorder = () => {
  const result: any = { statusCode: 200, body: null };
  result.status = (code: number) => { result.statusCode = code; return result; };
  result.json = (body: any) => { result.body = body; return result; };
  return result;
};

describe('Kashier webhook idempotency', () => {
  it('runs payment, history, and cart side effects once for a repeated success webhook', async () => {
    const originalCount = prisma.order.count;
    const originalTransaction = prisma.$transaction;
    let status = 'PENDING';
    let paymentStatus = 'PENDING';
    let historyWrites = 0;
    let cartDeletes = 0;
    const tx: any = {
      order: {
        updateMany: async ({ where, data }: any) => {
          if (where.status === 'PENDING' && status === 'PENDING' && paymentStatus !== 'PAID') {
            status = data.status;
            paymentStatus = data.paymentStatus;
            return { count: 1 };
          }
          return { count: 0 };
        },
        findUnique: async () => ({ status, paymentStatus, paymentTransactionId: 'tx-1', paymentProviderOrderId: 'po-1' }),
        findMany: async () => [{
          userId: 'user-1',
          createdAt: new Date(),
          items: [{ productId: 'product-1', variantId: null, quantity: 1 }],
        }],
      },
      orderStatusHistory: { create: async () => { historyWrites += 1; return {}; } },
      cartItem: {
        findFirst: async () => ({ id: 'cart-1', quantity: 1 }),
        delete: async () => { cartDeletes += 1; return {}; },
        update: async () => ({}),
      },
    };

    (prisma.order as any).count = async () => 1;
    (prisma as any).$transaction = async (work: any) => work(tx);
    try {
      const references = { transactionId: 'tx-1', providerOrderId: 'po-1' };
      const first = await markKashierOrdersPaid(['order-1'], references);
      const duplicate = await markKashierOrdersPaid(['order-1'], references);
      assert.deepEqual(first.paidIds, ['order-1']);
      assert.deepEqual(duplicate.paidIds, []);
      assert.equal(historyWrites, 1);
      assert.equal(cartDeletes, 1);
    } finally {
      (prisma.order as any).count = originalCount;
      (prisma as any).$transaction = originalTransaction;
    }
  });
});

describe('payment initiation idempotency', () => {
  it('creates one provider session and returns the stored continuation on retry', async () => {
    const repository: any = prisma.checkoutAttempt;
    const originals = {
      findFirst: repository.findFirst,
      findUnique: repository.findUnique,
      updateMany: repository.updateMany,
      update: repository.update,
      createPaymentSession: kashierService.createPaymentSession,
    };
    const state: any = {
      id: 'attempt-1', userId: 'user-a', paymentMethod: 'KASHIER', status: 'ORDERS_CREATED',
      providerReference: 'gk_checkout_attempt-1', providerSessionUrl: null, providerSessionId: null,
      paymentInitiationStartedAt: null, expiresAt: new Date(Date.now() + 86_400_000), user: { email: 'buyer@example.com' },
      orders: [{ id: 'order-1', total: 100, paymentStatus: 'PENDING', status: 'PENDING', createdAt: new Date() }],
    };
    let providerCalls = 0;
    repository.findFirst = async ({ where }: any) => where.userId === state.userId ? { ...state } : null;
    repository.findUnique = async () => ({ ...state });
    repository.updateMany = async ({ where, data }: any) => {
      const allowed = !where.status || (where.status.in ? where.status.in.includes(state.status) : where.status === state.status);
      if (!allowed) return { count: 0 };
      Object.assign(state, data);
      return { count: 1 };
    };
    repository.update = async ({ data }: any) => { Object.assign(state, data); return { ...state }; };
    kashierService.createPaymentSession = async (reference: string, _amount: any, _email: any, _currency: any, _orderIds: any, expiresAt: Date) => {
      providerCalls += 1;
      assert.equal(reference, state.providerReference);
      assert.equal(expiresAt.toISOString(), state.expiresAt.toISOString());
      return { sessionId: 'session-1', sessionUrl: 'https://example.test/session-1', status: 'CREATED', expiresAt: state.expiresAt };
    };
    try {
      const req: any = { user: { id: 'user-a' }, body: { checkoutAttemptId: state.id, amount: 100 } };
      const first = responseRecorder();
      await initiatePayment(req, first);
      const retry = responseRecorder();
      await initiatePayment(req, retry);
      assert.equal(first.statusCode, 200);
      assert.equal(retry.statusCode, 200);
      assert.equal(retry.body.sessionUrl, first.body.sessionUrl);
      assert.equal(providerCalls, 1);
    } finally {
      repository.findFirst = originals.findFirst;
      repository.findUnique = originals.findUnique;
      repository.updateMany = originals.updateMany;
      repository.update = originals.update;
      kashierService.createPaymentSession = originals.createPaymentSession;
    }
  });

  it('keeps an ambiguous provider result pending and does not issue an immediate second session request', async () => {
    const repository: any = prisma.checkoutAttempt;
    const originals = {
      findFirst: repository.findFirst, findUnique: repository.findUnique,
      updateMany: repository.updateMany, update: repository.update,
      createPaymentSession: kashierService.createPaymentSession,
      findPaymentSessionByReference: kashierService.findPaymentSessionByReference,
    };
    const state: any = {
      id: 'attempt-2', userId: 'user-a', paymentMethod: 'KASHIER', status: 'ORDERS_CREATED',
      providerReference: 'gk_checkout_attempt-2', providerSessionUrl: null,
      paymentInitiationStartedAt: null, expiresAt: new Date(Date.now() + 86_400_000), user: { email: 'buyer@example.com' },
      orders: [{ id: 'order-2', total: 100, paymentStatus: 'PENDING', status: 'PENDING', createdAt: new Date() }],
    };
    let providerCalls = 0;
    repository.findFirst = async () => ({ ...state });
    repository.findUnique = async () => ({ ...state });
    repository.update = async ({ data }: any) => { Object.assign(state, data); return { ...state }; };
    repository.updateMany = async ({ where, data }: any) => {
      let matches = true;
      if (where.status?.in) matches = where.status.in.includes(state.status);
      else if (typeof where.status === 'string') matches = where.status === state.status;
      if (where.paymentInitiationStartedAt?.lte) matches = matches && state.paymentInitiationStartedAt <= where.paymentInitiationStartedAt.lte;
      if (!matches) return { count: 0 };
      Object.assign(state, data);
      return { count: 1 };
    };
    kashierService.createPaymentSession = async () => {
      providerCalls += 1;
      throw Object.assign(new Error('timeout'), { ambiguous: true });
    };
    kashierService.findPaymentSessionByReference = async () => null;
    try {
      const req: any = { user: { id: 'user-a' }, body: { checkoutAttemptId: state.id, amount: 100 } };
      const first = responseRecorder();
      await initiatePayment(req, first);
      const retry = responseRecorder();
      await initiatePayment(req, retry);
      assert.equal(first.statusCode, 202);
      assert.equal(first.body.code, 'PAYMENT_PROVIDER_RESULT_UNKNOWN');
      assert.equal(retry.statusCode, 409);
      assert.equal(retry.body.code, 'PAYMENT_INITIATION_PENDING');
      assert.equal(providerCalls, 1);
    } finally {
      repository.findFirst = originals.findFirst;
      repository.findUnique = originals.findUnique;
      repository.updateMany = originals.updateMany;
      repository.update = originals.update;
      kashierService.createPaymentSession = originals.createPaymentSession;
      kashierService.findPaymentSessionByReference = originals.findPaymentSessionByReference;
    }
  });

  it('retries a confirmed provider rejection with the same attempt/reference and orders', async () => {
    const repository: any = prisma.checkoutAttempt;
    const originals = {
      findFirst: repository.findFirst, findUnique: repository.findUnique,
      updateMany: repository.updateMany, update: repository.update,
      createPaymentSession: kashierService.createPaymentSession,
      findPaymentSessionByReference: kashierService.findPaymentSessionByReference,
    };
    const state: any = {
      id: 'attempt-3', userId: 'user-a', paymentMethod: 'KASHIER', status: 'ORDERS_CREATED',
      providerReference: 'gk_checkout_attempt-3', providerSessionUrl: null,
      paymentInitiationStartedAt: null, expiresAt: new Date(Date.now() + 86_400_000), user: { email: 'buyer@example.com' },
      orders: [{ id: 'order-3', total: 100, paymentStatus: 'PENDING', status: 'PENDING', createdAt: new Date() }],
    };
    const references: string[] = [];
    repository.findFirst = async () => ({ ...state });
    repository.findUnique = async () => ({ ...state });
    repository.update = async ({ data }: any) => { Object.assign(state, data); return { ...state }; };
    repository.updateMany = async ({ where, data }: any) => {
      const matches = where.status?.in ? where.status.in.includes(state.status) : (!where.status || where.status === state.status);
      if (!matches) return { count: 0 };
      Object.assign(state, data);
      return { count: 1 };
    };
    kashierService.findPaymentSessionByReference = async () => null;
    kashierService.createPaymentSession = async (reference: string) => {
      references.push(reference);
      if (references.length === 1) throw Object.assign(new Error('rejected'), { ambiguous: false, providerCode: 'INVALID' });
      return { sessionId: 'session-3', sessionUrl: 'https://example.test/session-3', status: 'CREATED', expiresAt: state.expiresAt };
    };
    try {
      const req: any = { user: { id: 'user-a' }, body: { checkoutAttemptId: state.id, amount: 100 } };
      const first = responseRecorder();
      await initiatePayment(req, first);
      const retry = responseRecorder();
      await initiatePayment(req, retry);
      assert.equal(first.statusCode, 502);
      assert.equal(retry.statusCode, 200);
      assert.deepEqual(references, [state.providerReference, state.providerReference]);
      assert.deepEqual(retry.body.orderIds, ['order-3']);
    } finally {
      repository.findFirst = originals.findFirst;
      repository.findUnique = originals.findUnique;
      repository.updateMany = originals.updateMany;
      repository.update = originals.update;
      kashierService.createPaymentSession = originals.createPaymentSession;
      kashierService.findPaymentSessionByReference = originals.findPaymentSessionByReference;
    }
  });

  it('does not let another user initiate or read an attempt', async () => {
    const repository: any = prisma.checkoutAttempt;
    const original = repository.findFirst;
    repository.findFirst = async ({ where }: any) => where.userId === 'owner' ? { id: 'attempt-owner' } : null;
    try {
      const response = responseRecorder();
      await initiatePayment({ user: { id: 'attacker' }, body: { checkoutAttemptId: 'attempt-owner' } } as any, response);
      assert.equal(response.statusCode, 404);
    } finally {
      repository.findFirst = original;
    }
  });
});
