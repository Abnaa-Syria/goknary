import type { Order } from '@prisma/client';

type PaymentReferenceFields = Pick<
  Order,
  'paymentMethod' | 'paymentStatus' | 'paymentTransactionId' | 'paymentProviderOrderId' | 'paidAt'
>;

export interface KashierPaymentReference {
  transactionId: string;
  providerOrderId: string | null;
  paidAt: Date | null;
}

/**
 * The captured Kashier transaction an automatic refund must target. Null when there is none
 * (COD, unpaid, or paid before references were stored) — those need a manual refund.
 */
export const getKashierPaymentReference = (order: PaymentReferenceFields): KashierPaymentReference | null => {
  if (order.paymentMethod !== 'KASHIER' || order.paymentStatus !== 'PAID' || !order.paymentTransactionId) {
    return null;
  }
  return {
    transactionId: order.paymentTransactionId,
    providerOrderId: order.paymentProviderOrderId,
    paidAt: order.paidAt,
  };
};

/** Provider identifiers are for admin reconciliation and refunds; customer and vendor responses omit them. */
export const withoutPaymentReferences = <T extends Partial<Pick<Order, 'paymentTransactionId' | 'paymentProviderOrderId'>>>(
  order: T
): Omit<T, 'paymentTransactionId' | 'paymentProviderOrderId'> => {
  const { paymentTransactionId: _transactionId, paymentProviderOrderId: _providerOrderId, ...rest } = order;
  return rest;
};
