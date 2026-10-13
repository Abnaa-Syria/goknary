import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { cancelOrderWithStockRestore } from '../lib/variants';
import { isCodOrder, isOrderFinanciallyConfirmed, settleOrderOnDelivery } from '../lib/vendor-earnings';
import { AuditActor, writeAdminAudit } from '../lib/audit-log';

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export interface TransitionOrderInput {
  orderId: string;
  toStatus: OrderStatus;
  notes?: string;
  vendorId?: string;
  actor?: AuditActor;
}

/** Conditional status claim guarantees only the winner may run financial/inventory side effects. */
export async function transitionOrderStatus(input: TransitionOrderInput) {
  const observed = await prisma.order.findFirst({
    where: { id: input.orderId, ...(input.vendorId ? { vendorId: input.vendorId } : {}) },
    include: { vendor: { select: { id: true, commissionRate: true } } },
  });
  if (!observed) throw new NotFoundError('Order not found');

  const include = {
    user: { select: { name: true, email: true, phone: true } },
    vendor: { select: { storeName: true } },
    items: { include: { product: true } },
  } as const;
  if (observed.status === input.toStatus) {
    return { order: await prisma.order.findUniqueOrThrow({ where: { id: input.orderId }, include }), changed: false };
  }
  if (!ORDER_STATUS_FLOW[observed.status].includes(input.toStatus)) {
    throw new ValidationError(`Invalid status transition from ${observed.status} to ${input.toStatus}`);
  }
  if (input.toStatus !== OrderStatus.CANCELLED && !isOrderFinanciallyConfirmed(observed)) {
    throw new ValidationError('Online payment must be paid before processing this order');
  }

  return prisma.$transaction(async (tx) => {
    const won = input.toStatus === OrderStatus.CANCELLED
      ? await cancelOrderWithStockRestore(tx, observed.id, [observed.status])
      : (await tx.order.updateMany({
          where: { id: observed.id, status: observed.status },
          data: {
            status: input.toStatus,
            ...(input.toStatus === OrderStatus.DELIVERED && isCodOrder(observed.paymentMethod)
              ? { paymentStatus: 'PAID', paidAt: new Date() }
              : {}),
          },
        })).count === 1;
    if (!won) throw new ConflictError('Order status changed concurrently; refresh and try again');

    if (input.toStatus === OrderStatus.DELIVERED) {
      await settleOrderOnDelivery(tx, observed, observed.vendor);
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: observed.id,
        status: input.toStatus,
        notes: input.notes || `Status updated from ${observed.status} to ${input.toStatus}`,
      },
    });
    if (input.actor && ['ADMIN', 'STAFF'].includes(input.actor.role)) {
      await writeAdminAudit(tx, {
        actor: input.actor,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: observed.id,
        metadata: { fromStatus: observed.status, toStatus: input.toStatus },
      });
    }
    return { order: await tx.order.findUniqueOrThrow({ where: { id: observed.id }, include }), changed: true };
  });
}
