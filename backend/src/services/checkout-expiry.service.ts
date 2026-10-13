import { CheckoutAttempt, Order } from '@prisma/client';
import { prisma } from '../lib/prisma';
import kashierService from './kashier.service.js';
import {
  cancelCheckoutAttempt,
  markCheckoutPaid,
  PaymentReferences,
  unpaidCheckoutAttemptStates,
} from './checkout-lifecycle.service';

export type ReconciliationState = 'PAID' | 'FINAL_UNPAID' | 'PENDING' | 'UNKNOWN';

export interface ReconciliationResult {
  state: ReconciliationState;
  providerStatus: string;
  references: PaymentReferences;
  sessionId?: string | null;
  sessionUrl?: string | null;
}

type ExpirableAttempt = CheckoutAttempt & { orders: Pick<Order, 'id'>[] };

type KashierReconciliationClient = {
  findPaymentOrderByReference(reference: string): Promise<any>;
  getPaymentSession(sessionId: string): Promise<any>;
};

const PAID_STATUSES = new Set(['CAPTURED', 'PAID', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED']);
const FINAL_UNPAID_STATUSES = new Set(['FAILED', 'FAILURE', 'DECLINED', 'CANCELLED', 'CANCELED', 'REVERSED', 'EXPIRED', 'REJECTED']);
const PENDING_STATUSES = new Set(['INITIATED', 'AUTHORIZED', 'PENDING', 'PROCESSING', 'OPEN', 'OPENED', 'CREATED']);

const normalizedStatus = (value: unknown) => String(value || '').trim().toUpperCase();

export const normalizeKashierReconciliation = (record: any): ReconciliationResult => {
  const status = normalizedStatus(record?.status);
  const transactions = Array.isArray(record?.transactions) ? record.transactions : [];
  const paidTransaction = transactions.find((transaction: any) => {
    const transactionStatus = normalizedStatus(transaction?.status);
    const responseCode = normalizedStatus(transaction?.transactionResponseCode);
    return transactionStatus === 'SUCCESS' && ['APPROVED', 'CAPTURED', 'SUCCESS'].includes(responseCode);
  });
  const references = {
    transactionId: paidTransaction?.transactionId || paidTransaction?.transactionInfoId || record?.transactionId || null,
    providerOrderId: record?.providerOrderId || record?.orderId || null,
  };
  const common = {
    providerStatus: status || 'UNKNOWN',
    references,
    sessionId: record?.sessionId || null,
    sessionUrl: record?.sessionUrl || null,
  };

  if (PAID_STATUSES.has(status) || paidTransaction) return { state: 'PAID', ...common };
  if (FINAL_UNPAID_STATUSES.has(status)) return { state: 'FINAL_UNPAID', ...common };
  if (PENDING_STATUSES.has(status)) return { state: 'PENDING', ...common };
  return { state: 'UNKNOWN', ...common };
};

/**
 * Queries Kashier outside any DB transaction. A successful exact-reference lookup with no
 * provider order/session after the shared expiry is a final unpaid outcome; transport errors are
 * UNKNOWN and must never release inventory.
 */
export const reconcileCheckoutPayment = async (
  attempt: ExpirableAttempt,
  provider: KashierReconciliationClient = kashierService,
): Promise<ReconciliationResult> => {
  const wasNeverInitiated =
    attempt.status === 'ORDERS_CREATED' &&
    !attempt.paymentInitiationStartedAt &&
    !attempt.providerSessionId &&
    !attempt.providerSessionUrl;
  if (wasNeverInitiated) {
    return { state: 'FINAL_UNPAID', providerStatus: 'NOT_INITIATED', references: {} };
  }

  try {
    const order = await provider.findPaymentOrderByReference(attempt.providerReference);
    if (order) return normalizeKashierReconciliation(order);
    if (attempt.providerSessionId) {
      const session = await provider.getPaymentSession(attempt.providerSessionId);
      if (session) return normalizeKashierReconciliation(session);
    }
    return { state: 'FINAL_UNPAID', providerStatus: 'NOT_FOUND', references: {} };
  } catch (error) {
    console.warn(
      `[checkout-expiry] Kashier reconciliation unavailable for attempt ${attempt.id}:`,
      error instanceof Error ? error.message : error,
    );
    return { state: 'UNKNOWN', providerStatus: 'RECONCILIATION_UNKNOWN', references: {} };
  }
};

export interface ProcessExpiredOptions {
  now?: Date;
  reconcile?: (attempt: ExpirableAttempt) => Promise<ReconciliationResult>;
  notify?: boolean;
  track?: boolean;
}

export const processExpiredCheckoutAttempt = async (attemptId: string, options: ProcessExpiredOptions = {}) => {
  const now = options.now ?? new Date();
  const attempt = await prisma.checkoutAttempt.findFirst({
    where: {
      id: attemptId,
      paymentMethod: 'KASHIER',
      status: { in: unpaidCheckoutAttemptStates },
      expiresAt: { not: null, lte: now },
    },
    include: { orders: { select: { id: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!attempt) return { outcome: 'SKIPPED' as const };

  const reconciliation = await (options.reconcile || reconcileCheckoutPayment)(attempt);

  // Persist useful provider recovery data only while the attempt is still unpaid. This update is
  // informational; the terminal winner remains the conditional update in the lifecycle service.
  if (reconciliation.sessionId || reconciliation.sessionUrl || reconciliation.providerStatus) {
    await prisma.checkoutAttempt.updateMany({
      where: { id: attempt.id, status: { in: unpaidCheckoutAttemptStates } },
      data: {
        providerStatus: reconciliation.providerStatus,
        ...(reconciliation.sessionId ? { providerSessionId: reconciliation.sessionId } : {}),
        ...(reconciliation.sessionUrl ? { providerSessionUrl: reconciliation.sessionUrl } : {}),
        ...(reconciliation.state === 'PENDING' && reconciliation.sessionUrl ? { status: 'PAYMENT_READY' as const } : {}),
      },
    });
  }

  if (reconciliation.state === 'PAID') {
    const result = await markCheckoutPaid({
      attemptId: attempt.id,
      orderIds: attempt.orders.map((order) => order.id),
      references: reconciliation.references,
      providerStatus: reconciliation.providerStatus,
      notes: 'Kashier payment recovered by expiry reconciliation',
      notify: options.notify,
      track: options.track,
    });
    return { outcome: result.won ? 'PAID' as const : 'LOST_RACE' as const, reconciliation, result };
  }

  if (reconciliation.state === 'FINAL_UNPAID') {
    const result = await cancelCheckoutAttempt({
      attemptId: attempt.id,
      now,
      requireExpired: true,
      providerStatus: reconciliation.providerStatus,
      reason: `Online checkout expired after provider reconciliation (${reconciliation.providerStatus}).`,
      notify: options.notify,
    });
    return { outcome: result.won ? 'CANCELLED' as const : 'LOST_RACE' as const, reconciliation, result };
  }

  return { outcome: reconciliation.state === 'UNKNOWN' ? 'UNKNOWN' as const : 'PENDING' as const, reconciliation };
};
