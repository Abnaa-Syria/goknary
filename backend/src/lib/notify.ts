import { prisma } from './prisma';

export const NotificationType = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURN_STATUS_CHANGED: 'RETURN_STATUS_CHANGED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  PRODUCT_APPROVED: 'PRODUCT_APPROVED',
  PRODUCT_REJECTED: 'PRODUCT_REJECTED',
  PAYOUT_STATUS_CHANGED: 'PAYOUT_STATUS_CHANGED',
  TICKET_UPDATED: 'TICKET_UPDATED',
  DISCOUNT_SUGGESTION: 'DISCOUNT_SUGGESTION',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

export interface NotificationPayload {
  type: NotificationTypeValue;
  title: string;
  message: string;
  titleAr?: string;
  messageAr?: string;
  /** In-app path only (e.g. `/account/orders/123`); anything else is dropped. */
  link?: string;
  entityType?: string;
  entityId?: string;
}

const toData = (userId: string, payload: NotificationPayload) => ({
  userId,
  type: payload.type,
  title: payload.title,
  message: payload.message,
  titleAr: payload.titleAr ?? null,
  messageAr: payload.messageAr ?? null,
  link: payload.link && payload.link.startsWith('/') && !payload.link.startsWith('//') ? payload.link : null,
  entityType: payload.entityType ?? null,
  entityId: payload.entityId ?? null,
});

/**
 * Notifications are side effects: they never throw, so a failure here cannot roll back or fail
 * the business operation that triggered them. Call them after the main transaction commits.
 */
export const notifyMany = async (userIds: Array<string | null | undefined>, payload: NotificationPayload) => {
  const recipients = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (recipients.length === 0) return;
  try {
    await prisma.notification.createMany({ data: recipients.map((id) => toData(id, payload)) });
  } catch (error) {
    console.error(`Failed to create ${payload.type} notification:`, error instanceof Error ? error.message : error);
  }
};

export const notifyUser = (userId: string | null | undefined, payload: NotificationPayload) =>
  notifyMany([userId], payload);

/** Platform admins (role ADMIN), the same recipients the order flow already notified. */
export const notifyAdmins = async (payload: NotificationPayload) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await notifyMany(admins.map((a) => a.id), payload);
  } catch (error) {
    console.error(`Failed to notify admins (${payload.type}):`, error instanceof Error ? error.message : error);
  }
};

export const notifyVendor = async (vendorId: string, payload: NotificationPayload) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { userId: true } });
    await notifyUser(vendor?.userId, payload);
  } catch (error) {
    console.error(`Failed to notify vendor (${payload.type}):`, error instanceof Error ? error.message : error);
  }
};

const ORDER_STATUS_TEXT: Record<string, { en: string; ar: string }> = {
  PENDING: { en: 'is pending', ar: 'قيد الانتظار' },
  CONFIRMED: { en: 'has been confirmed', ar: 'تم تأكيده' },
  PROCESSING: { en: 'is being prepared', ar: 'جاري تجهيزه' },
  SHIPPED: { en: 'has been shipped', ar: 'تم شحنه' },
  DELIVERED: { en: 'has been delivered', ar: 'تم توصيله' },
  CANCELLED: { en: 'has been cancelled', ar: 'تم إلغاؤه' },
  REFUNDED: { en: 'has been refunded', ar: 'تم استرداده' },
};

export const shortId = (id: string) => id.slice(-8).toUpperCase();

/** Customer-facing order status notification (link to the customer's order page). */
export const notifyCustomerOrderStatus = async (userId: string, orderId: string, status: string, extra?: { en: string; ar: string }) => {
  if (status === 'PENDING') return;
  const text = ORDER_STATUS_TEXT[status] ?? { en: `status changed to ${status}`, ar: `تغيرت حالته إلى ${status}` };
  return notifyUser(userId, {
    type: NotificationType.ORDER_STATUS_CHANGED,
    title: `Order #${shortId(orderId)} ${text.en}`,
    titleAr: `طلبك #${shortId(orderId)} ${text.ar}`,
    message: extra?.en ?? `Your order #${shortId(orderId)} ${text.en}.`,
    messageAr: extra?.ar ?? `طلبك رقم #${shortId(orderId)} ${text.ar}.`,
    link: `/account/orders/${orderId}`,
    entityType: 'ORDER',
    entityId: orderId,
  });
};

/** Vendor-facing order status notification (link to the vendor's order page). */
export const notifyVendorOrderStatus = (vendorId: string, orderId: string, status: string, reason: { en: string; ar: string }) => {
  const text = ORDER_STATUS_TEXT[status] ?? { en: `status changed to ${status}`, ar: `تغيرت حالته إلى ${status}` };
  return notifyVendor(vendorId, {
    type: NotificationType.ORDER_STATUS_CHANGED,
    title: `Order #${shortId(orderId)} ${text.en}`,
    titleAr: `الطلب #${shortId(orderId)} ${text.ar}`,
    message: reason.en,
    messageAr: reason.ar,
    link: `/vendor/orders/${orderId}`,
    entityType: 'ORDER',
    entityId: orderId,
  });
};
