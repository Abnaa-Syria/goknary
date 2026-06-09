import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const IN_FLIGHT_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] as const;

export function calculateVendorNetEarnings(
  orderTotal: number,
  commissionRate?: number | null
) {
  const rate = commissionRate ?? 10;
  const commissionAmount = Math.round(orderTotal * (rate / 100) * 100) / 100;
  const netEarnings = Math.round((orderTotal - commissionAmount) * 100) / 100;

  return { commissionRate: rate, commissionAmount, netEarnings };
}

export function isCodOrder(paymentMethod?: string | null): boolean {
  return (paymentMethod || 'COD').toUpperCase() === 'COD';
}

/** Vendor earnings can be reserved only after payment is confirmed (or COD). */
export function isOrderFinanciallyConfirmed(order: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
}): boolean {
  if (isCodOrder(order.paymentMethod)) return true;
  return (order.paymentStatus || '').toUpperCase() === 'PAID';
}

/** Balance is credited to the vendor only after delivery and payment confirmation. */
export function canSettleVendorEarnings(order: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
}): boolean {
  return isOrderFinanciallyConfirmed(order);
}

export function countsTowardPendingEarnings(order: {
  status: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
}): boolean {
  return (
    IN_FLIGHT_ORDER_STATUSES.includes(order.status as (typeof IN_FLIGHT_ORDER_STATUSES)[number]) &&
    isOrderFinanciallyConfirmed(order)
  );
}

type TxClient = Prisma.TransactionClient;

export async function settleOrderOnDelivery(
  tx: TxClient,
  order: {
    id: string;
    vendorId: string;
    total: number;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
  },
  vendor: { id: string; commissionRate?: number | null }
): Promise<boolean> {
  if (!canSettleVendorEarnings(order)) {
    return false;
  }

  const existing = await tx.commission.findFirst({
    where: { orderId: order.id },
  });
  if (existing) return false;

  const { commissionRate, commissionAmount, netEarnings } = calculateVendorNetEarnings(
    order.total,
    vendor.commissionRate
  );

  await tx.vendor.update({
    where: { id: vendor.id },
    data: {
      balance: { increment: netEarnings },
    },
  });

  await tx.commission.create({
    data: {
      vendorId: vendor.id,
      orderId: order.id,
      commissionRate,
      commissionAmount,
      status: 'paid',
      paidAt: new Date(),
    },
  });

  return true;
}

export async function calculatePendingEarnings(
  vendorId: string,
  commissionRate?: number | null
): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      vendorId,
      status: { in: [...IN_FLIGHT_ORDER_STATUSES] },
    },
    select: {
      total: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });

  return orders
    .filter(countsTowardPendingEarnings)
    .reduce((sum, order) => sum + calculateVendorNetEarnings(order.total, commissionRate).netEarnings, 0);
}

export async function calculateDeliveredEarnings(
  vendorId: string,
  commissionRate?: number | null,
  since?: Date
): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      vendorId,
      status: 'DELIVERED',
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      total: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });

  return orders.filter(isOrderFinanciallyConfirmed).reduce(
    (sum, order) => sum + calculateVendorNetEarnings(order.total, commissionRate).netEarnings,
    0
  );
}
