export type PaymentConfirmationState =
  | 'order-confirmed'
  | 'payment-pending'
  | 'payment-confirmed';

interface ConfirmableOrder {
  status?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
}

const CONFIRMED_ORDER_STATUSES = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']);

export const getPaymentConfirmationState = (
  orders: ConfirmableOrder[]
): PaymentConfirmationState => {
  const allActiveAndPaid =
    orders.length > 0 &&
    orders.every(
      (order) => order.paymentStatus === 'PAID' && order.status !== 'CANCELLED'
    );

  if (allActiveAndPaid) return 'payment-confirmed';

  const allConfirmedCod =
    orders.length > 0 &&
    orders.every(
      (order) =>
        order.paymentMethod === 'COD' &&
        !!order.status &&
        CONFIRMED_ORDER_STATUSES.has(order.status)
    );

  return allConfirmedCod ? 'order-confirmed' : 'payment-pending';
};

export const shouldClearCartAfterConfirmation = (
  state: PaymentConfirmationState
): boolean => state === 'order-confirmed' || state === 'payment-confirmed';

export const isValidOrderReference = (value: string): boolean =>
  /^[A-Za-z0-9_-]{8,64}$/.test(value);

