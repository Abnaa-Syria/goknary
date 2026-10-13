import { CheckoutAttemptStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { restoreOrderStock } from '../lib/variants';
import { notifyCustomerOrderStatus, notifyVendorOrderStatus, shortId } from '../lib/notify';
import { trackPurchasesForOrders } from '../lib/user-events';

type Tx = Prisma.TransactionClient;

export interface PaymentReferences {
  transactionId?: string | null;
  providerOrderId?: string | null;
}

const UNPAID_ATTEMPT_STATES: CheckoutAttemptStatus[] = [
  'ORDERS_CREATED',
  'PAYMENT_INITIATING',
  'PAYMENT_READY',
  'PAYMENT_FAILED',
];
const notPaid = (): Prisma.OrderWhereInput => ({
  OR: [{ paymentStatus: null }, { paymentStatus: { not: 'PAID' } }],
});

const notifyCancellation = async (orders: Array<{ id: string; userId: string; vendorId: string }>) => {
  for (const order of orders) {
    const ref = shortId(order.id);
    await notifyCustomerOrderStatus(order.userId, order.id, 'CANCELLED', {
      en: 'Your unpaid online checkout expired and the reserved items were released.',
      ar: 'انتهت مهلة الدفع الإلكتروني وتم تحرير المنتجات المحجوزة.',
    });
    await notifyVendorOrderStatus(order.vendorId, order.id, 'CANCELLED', {
      en: `Order #${ref} was cancelled because its online payment expired.`,
      ar: `تم إلغاء الطلب رقم #${ref} لانتهاء مهلة الدفع الإلكتروني.`,
    });
  }
};

const notifyPaymentConfirmed = async (orderIds: string[]) => {
  if (orderIds.length === 0) return;
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, userId: true, vendorId: true },
  });
  for (const order of orders) {
    const ref = shortId(order.id);
    await notifyCustomerOrderStatus(order.userId, order.id, 'CONFIRMED', {
      en: 'Your payment was received successfully.',
      ar: 'تم استلام الدفع بنجاح.',
    });
    await notifyVendorOrderStatus(order.vendorId, order.id, 'CONFIRMED', {
      en: `Payment for order #${ref} was confirmed. You can start preparing it.`,
      ar: `تم تأكيد الدفع للطلب رقم #${ref}. يمكن بدء تجهيزه.`,
    });
  }
};

export interface CancelCheckoutOptions {
  attemptId: string;
  reason: string;
  now?: Date;
  requireExpired?: boolean;
  providerStatus?: string | null;
  notify?: boolean;
}

/**
 * Checkout-level cancellation gate. The attempt transition is the single winner token; stock,
 * coupon and histories are changed only by the transaction that changed that row to CANCELLED.
 */
export const cancelCheckoutAttempt = async (options: CancelCheckoutOptions) => {
  const now = options.now ?? new Date();
  const requireExpired = options.requireExpired ?? true;
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.checkoutAttempt.updateMany({
      where: {
        id: options.attemptId,
        paymentMethod: 'KASHIER',
        status: { in: UNPAID_ATTEMPT_STATES },
        ...(requireExpired ? { expiresAt: { not: null, lte: now } } : {}),
      },
      data: {
        status: 'CANCELLED',
        providerStatus: options.providerStatus || 'EXPIRED',
      },
    });
    if (claimed.count === 0) return { won: false, cancelledOrders: [] as Array<{ id: string; userId: string; vendorId: string }> };

    const orders = await tx.order.findMany({
      where: { checkoutAttemptId: options.attemptId },
      select: { id: true, userId: true, vendorId: true, status: true, paymentStatus: true, couponCode: true },
      orderBy: { createdAt: 'asc' },
    });

    // Defensive protection for attempts created before the atomic paid transition existed.
    // Throwing rolls back the attempt claim and every side effect.
    if (orders.some((order) => order.paymentStatus === 'PAID')) {
      throw new Error('Cannot expire a checkout containing a paid order');
    }

    const cancelledOrders: Array<{ id: string; userId: string; vendorId: string }> = [];
    for (const order of orders) {
      const cancelled = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING', ...notPaid() },
        data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
      });
      if (cancelled.count === 0) continue;
      await restoreOrderStock(tx, order.id);
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: 'CANCELLED', notes: options.reason },
      });
      cancelledOrders.push({ id: order.id, userId: order.userId, vendorId: order.vendorId });
    }

    // Coupon use is checkout-scoped even though its code is copied to every vendor order.
    const couponCode = orders.map((order) => order.couponCode).find(Boolean);
    if (couponCode) {
      await tx.coupon.updateMany({
        where: { code: couponCode, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }

    return { won: true, cancelledOrders };
  }, { maxWait: 10_000, timeout: 20_000 });

  if (result.won && options.notify !== false && result.cancelledOrders.length > 0) {
    try {
      await notifyCancellation(result.cancelledOrders);
    } catch (error) {
      console.error('[checkout-expiry] cancellation notification failed:', error instanceof Error ? error.message : error);
    }
  }
  return result;
};

const captureReferencesForPaidOrder = async (tx: Tx, id: string, references: PaymentReferences) => {
  const current = await tx.order.findUnique({
    where: { id },
    select: { paymentStatus: true, paymentTransactionId: true, paymentProviderOrderId: true },
  });
  if (!current || current.paymentStatus !== 'PAID') return [];
  const data: Prisma.OrderUpdateManyMutationInput = {};
  const conflicts: Array<{ id: string; field: string; stored: string; incoming: string }> = [];
  for (const [field, incoming] of [
    ['paymentTransactionId', references.transactionId],
    ['paymentProviderOrderId', references.providerOrderId],
  ] as const) {
    if (!incoming) continue;
    const stored = current[field];
    if (!stored) (data as Record<string, unknown>)[field] = incoming;
    else if (stored !== incoming) conflicts.push({ id, field, stored, incoming });
  }
  if (Object.keys(data).length > 0) {
    await tx.order.updateMany({ where: { id, paymentStatus: 'PAID' }, data });
  }
  return conflicts;
};

export interface MarkPaidOptions {
  attemptId?: string | null;
  orderIds: string[];
  references: PaymentReferences;
  notes?: string;
  providerStatus?: string | null;
  notify?: boolean;
  track?: boolean;
}

/** Atomic PAID winner plus the existing cancelled-but-paid/manual-refund path. */
export const markCheckoutPaid = async (options: MarkPaidOptions) => {
  const notes = options.notes || 'Kashier payment successful';
  const result = await prisma.$transaction(async (tx) => {
    const orderScope = options.attemptId ? { checkoutAttemptId: options.attemptId } : {};
    let won = true;
    let cancelledWinner = false;
    if (options.attemptId) {
      const claimed = await tx.checkoutAttempt.updateMany({
        where: { id: options.attemptId, status: { in: UNPAID_ATTEMPT_STATES } },
        data: { status: 'PAID', providerStatus: options.providerStatus || 'PAID' },
      });
      won = claimed.count === 1;
      if (!won) {
        const attempt = await tx.checkoutAttempt.findUnique({ where: { id: options.attemptId }, select: { status: true } });
        cancelledWinner = attempt?.status === 'CANCELLED';
        if (!cancelledWinner && attempt?.status !== 'PAID') {
          return { won: false, paidIds: [], confirmedIds: [], lateAfterCancellation: [], referenceConflicts: [] };
        }
      }
    }

    const paidData = {
      paymentStatus: 'PAID',
      paymentTransactionId: options.references.transactionId || null,
      paymentProviderOrderId: options.references.providerOrderId || null,
      paidAt: new Date(),
    };
    const confirmedIds: string[] = [];
    const paidIds: string[] = [];
    const lateAfterCancellation: string[] = [];
    const referenceConflicts: Array<{ id: string; field: string; stored: string; incoming: string }> = [];

    for (const id of options.orderIds) {
      if (!cancelledWinner) {
        const confirmed = await tx.order.updateMany({
          where: { id, ...orderScope, status: 'PENDING', ...notPaid() },
          data: { ...paidData, status: 'CONFIRMED' },
        });
        if (confirmed.count > 0) {
          await tx.orderStatusHistory.create({ data: { orderId: id, status: 'CONFIRMED', notes } });
          confirmedIds.push(id);
          paidIds.push(id);
          continue;
        }

        const active = await tx.order.updateMany({
          where: { id, ...orderScope, status: { notIn: ['PENDING', 'CANCELLED'] }, ...notPaid() },
          data: paidData,
        });
        if (active.count > 0) {
          const current = await tx.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
          await tx.orderStatusHistory.create({ data: { orderId: id, status: current.status, notes } });
          paidIds.push(id);
          continue;
        }
      }

      const late = await tx.order.updateMany({
        where: { id, ...orderScope, status: 'CANCELLED', ...notPaid() },
        data: paidData,
      });
      if (late.count > 0) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            status: 'CANCELLED',
            notes: 'Kashier payment succeeded after final cancellation. Stock remains released; manual cancelled-payment refund required.',
          },
        });
        lateAfterCancellation.push(id);
        continue;
      }
      referenceConflicts.push(...await captureReferencesForPaidOrder(tx, id, options.references));
    }

    if (paidIds.length > 0) {
      const orders = await tx.order.findMany({
        where: { id: { in: paidIds } },
        select: { userId: true, createdAt: true, items: { select: { productId: true, variantId: true, quantity: true } } },
      });
      for (const order of orders) {
        for (const item of order.items) {
          const cartItem = await tx.cartItem.findFirst({
            where: { userId: order.userId, productId: item.productId, variantId: item.variantId, createdAt: { lte: order.createdAt } },
          });
          if (!cartItem) continue;
          if (cartItem.quantity <= item.quantity) await tx.cartItem.delete({ where: { id: cartItem.id } });
          else await tx.cartItem.update({ where: { id: cartItem.id }, data: { quantity: { decrement: item.quantity } } });
        }
      }
    }

    return { won, paidIds, confirmedIds, lateAfterCancellation, referenceConflicts };
  }, { maxWait: 10_000, timeout: 20_000 });

  if (result.paidIds.length > 0 && options.track !== false) {
    void trackPurchasesForOrders(result.paidIds);
  }
  if (result.confirmedIds.length > 0 && options.notify !== false) {
    try {
      await notifyPaymentConfirmed(result.confirmedIds);
    } catch (error) {
      console.error('[checkout-payment] confirmation notification failed:', error instanceof Error ? error.message : error);
    }
  }
  return result;
};

export const unpaidCheckoutAttemptStates = UNPAID_ATTEMPT_STATES;
