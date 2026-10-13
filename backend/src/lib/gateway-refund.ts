import type { Order } from '@prisma/client';
import { getKashierPaymentReference } from './payment-reference';

// TODO(KASHIER_REFUND_REFERENCE_NOT_VERIFIED): gateway refunds stay disabled until a Kashier sandbox
// webhook confirms which stored fields (paymentTransactionId / paymentProviderOrderId) the refund API
// expects and the refund call is implemented. Until then every refund is completed manually.

export type GatewayRefundStatus =
  | 'NOT_GATEWAY_PAYMENT'
  | 'NOT_PAID'
  | 'NO_PAYMENT_REFERENCE'
  | 'GATEWAY_REFUND_NOT_ENABLED';

export interface GatewayRefundAvailability {
  available: boolean;
  status: GatewayRefundStatus;
  message: string;
  hasPaymentReference: boolean;
}

type PaymentFields = Pick<
  Order,
  'paymentMethod' | 'paymentStatus' | 'paymentTransactionId' | 'paymentProviderOrderId' | 'paidAt'
>;

export const getGatewayRefundAvailability = (order: PaymentFields): GatewayRefundAvailability => {
  const hasPaymentReference = getKashierPaymentReference(order) !== null;
  if ((order.paymentMethod || '').toUpperCase() !== 'KASHIER') {
    return { available: false, status: 'NOT_GATEWAY_PAYMENT', message: 'This order was not paid online. Use a manual refund.', hasPaymentReference };
  }
  if (order.paymentStatus !== 'PAID') {
    return { available: false, status: 'NOT_PAID', message: 'This order has no captured payment to refund.', hasPaymentReference };
  }
  if (!hasPaymentReference) {
    return { available: false, status: 'NO_PAYMENT_REFERENCE', message: 'No Kashier transaction reference is stored for this order. Use a manual refund.', hasPaymentReference };
  }
  return {
    available: false,
    status: 'GATEWAY_REFUND_NOT_ENABLED',
    message: 'Kashier refund verification pending. Use a manual refund for now.',
    hasPaymentReference,
  };
};

/**
 * Entry point for automatic refunds. It does not contact Kashier yet (see the TODO above) and never
 * changes the refund request: the caller keeps it in REFUND_PROCESSING for a manual completion.
 */
export const processGatewayRefund = async (order: PaymentFields): Promise<{ ok: false; status: GatewayRefundStatus; message: string }> => {
  const availability = getGatewayRefundAvailability(order);
  return { ok: false, status: availability.status, message: availability.message };
};
