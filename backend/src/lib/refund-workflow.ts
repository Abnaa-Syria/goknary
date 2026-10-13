import { Prisma, RefundStatus } from '@prisma/client';
import { getUnitPrice } from './variants';

type Tx = Prisma.TransactionClient;

export const RefundKind = {
  /** Customer returns a delivered item. */
  RETURN: 'RETURN',
  /** Payment captured after the order was cancelled: refund the payment, no item and no stock involved. */
  CANCELLED_PAYMENT: 'CANCELLED_PAYMENT',
} as const;

export type RefundKindValue = (typeof RefundKind)[keyof typeof RefundKind];

export const CURRENT_REFUND_STATUSES = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ITEM_RECEIVED',
  'REFUND_PROCESSING',
  'REFUNDED',
  'REJECTED',
] as const;

export type CurrentRefundStatus = (typeof CURRENT_REFUND_STATUSES)[number];

// Legacy rows keep their stored value; they are read through this mapping. VENDOR_REJECTED maps to
// UNDER_REVIEW because the seller's answer was never final: the platform admin always decided.
// ADMIN_APPROVED is a finished legacy refund (wallet credited and stock restored at the time).
const LEGACY_STATUS_MAP: Partial<Record<RefundStatus, CurrentRefundStatus>> = {
  PENDING: 'REQUESTED',
  VENDOR_APPROVED: 'UNDER_REVIEW',
  VENDOR_REJECTED: 'UNDER_REVIEW',
  ADMIN_APPROVED: 'REFUNDED',
  ADMIN_REJECTED: 'REJECTED',
};

export const isLegacyRefundStatus = (status: RefundStatus) => status in LEGACY_STATUS_MAP;

export const toCurrentRefundStatus = (status: RefundStatus): CurrentRefundStatus =>
  LEGACY_STATUS_MAP[status] ?? (status as CurrentRefundStatus);

export const isCurrentRefundStatus = (value: unknown): value is CurrentRefundStatus =>
  CURRENT_REFUND_STATUSES.includes(value as CurrentRefundStatus);

/** Every stored value (current and legacy) that reads as one of `statuses`. */
export const storedStatusesFor = (statuses: CurrentRefundStatus[]): RefundStatus[] =>
  (Object.values(RefundStatus) as RefundStatus[]).filter((s) => statuses.includes(toCurrentRefundStatus(s)));

/** Seller recommendation implied by legacy statuses (new rows store it in vendorDecision). */
export const legacyVendorDecision = (status: RefundStatus): 'APPROVE' | 'REJECT' | null =>
  status === 'VENDOR_APPROVED' ? 'APPROVE' : status === 'VENDOR_REJECTED' ? 'REJECT' : null;

const RETURN_TRANSITIONS: Record<CurrentRefundStatus, CurrentRefundStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['ITEM_RECEIVED', 'REJECTED'],
  ITEM_RECEIVED: ['REFUND_PROCESSING'],
  REFUND_PROCESSING: ['REFUNDED'],
  REFUNDED: [],
  REJECTED: [],
};

const CANCELLED_PAYMENT_TRANSITIONS: Record<CurrentRefundStatus, CurrentRefundStatus[]> = {
  REQUESTED: [],
  UNDER_REVIEW: [],
  APPROVED: ['REFUND_PROCESSING'],
  ITEM_RECEIVED: [],
  REFUND_PROCESSING: ['REFUNDED'],
  REFUNDED: [],
  REJECTED: [],
};

export const canTransitionRefund = (from: RefundStatus, to: CurrentRefundStatus, kind: string = RefundKind.RETURN) => {
  const table = kind === RefundKind.CANCELLED_PAYMENT ? CANCELLED_PAYMENT_TRANSITIONS : RETURN_TRANSITIONS;
  return table[toCurrentRefundStatus(from)].includes(to);
};

/** Everything except REJECTED counts against the returnable quantity and refundable amount. */
export const isActiveRefund = (status: RefundStatus) => toCurrentRefundStatus(status) !== 'REJECTED';

/** Legacy approvals restored stock immediately; new requests restore it at ITEM_RECEIVED. */
export const hasRestoredStock = (refund: { status: RefundStatus; receivedAt?: Date | null }) =>
  refund.status === 'ADMIN_APPROVED' || refund.receivedAt != null;

// ─── Return window ───────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most recent DELIVERED entry of the order history (orders have no dedicated delivered-at column). */
export const getDeliveredAt = async (tx: Pick<Tx, 'orderStatusHistory'>, orderId: string): Promise<Date | null> => {
  const entry = await tx.orderStatusHistory.findFirst({
    where: { orderId, status: 'DELIVERED' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return entry?.createdAt ?? null;
};

export interface ReturnWindowCheck {
  allowed: boolean;
  message?: string;
  windowDays: number | null;
  deliveredAt: Date | null;
  deadline: Date | null;
}

/**
 * `windowDays` is the vendor's returnWindowDays: 0 = no returns, null = no fixed window (there is no
 * platform default, so this keeps the pre-F9 behaviour of accepting returns for delivered orders).
 */
export const checkReturnWindow = (
  windowDays: number | null | undefined,
  deliveredAt: Date | null,
  now: Date = new Date()
): ReturnWindowCheck => {
  const days = windowDays ?? null;
  if (days === 0) {
    return { allowed: false, message: 'This store does not accept returns', windowDays: 0, deliveredAt, deadline: null };
  }
  if (days === null) {
    return { allowed: true, windowDays: null, deliveredAt, deadline: null };
  }
  if (!deliveredAt) {
    return { allowed: false, message: 'The delivery date of this order could not be determined', windowDays: days, deliveredAt, deadline: null };
  }
  const deadline = new Date(deliveredAt.getTime() + days * DAY_MS);
  if (now > deadline) {
    return { allowed: false, message: `The ${days}-day return window for this order has ended`, windowDays: days, deliveredAt, deadline };
  }
  return { allowed: true, windowDays: days, deliveredAt, deadline };
};

// ─── Quantities and amounts ──────────────────────────────────────────────────

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

interface ItemSnapshot {
  price: number;
  discountPrice: number | null;
  quantity: number;
}

interface OrderTotals {
  subtotal: number;
  discountAmount: number | null;
}

interface ExistingRequest {
  status: RefundStatus;
  quantity: number;
  amount: number;
}

/**
 * What the customer actually paid for the whole line: the purchase-time unit price (product discount
 * included) minus the line's share of the order coupon, allocated by line value. Shipping is excluded.
 */
export const itemNetPaid = (item: ItemSnapshot, order: OrderTotals) => {
  const lineGross = getUnitPrice(item) * item.quantity;
  const couponShare = order.subtotal > 0 ? ((order.discountAmount || 0) * lineGross) / order.subtotal : 0;
  return Math.max(0, lineGross - couponShare);
};

export const returnableQuantity = (item: { quantity: number }, requests: ExistingRequest[]) =>
  Math.max(0, item.quantity - requests.filter((r) => isActiveRefund(r.status)).reduce((sum, r) => sum + r.quantity, 0));

/**
 * Amount for returning `quantity` units, allocated cumulatively so that all returns of a line add up
 * to exactly the line's net paid amount, and capped by what is still unrefunded on that line.
 */
export const calculateReturnAmount = (item: ItemSnapshot, order: OrderTotals, quantity: number, others: ExistingRequest[]) => {
  if (item.quantity <= 0 || quantity <= 0) return 0;
  const active = others.filter((r) => isActiveRefund(r.status));
  const lineNet = itemNetPaid(item, order);
  const unitsBefore = active.reduce((sum, r) => sum + r.quantity, 0);
  const allocated =
    roundMoney((lineNet * Math.min(item.quantity, unitsBefore + quantity)) / item.quantity) -
    roundMoney((lineNet * Math.min(item.quantity, unitsBefore)) / item.quantity);
  const remaining = roundMoney(lineNet) - active.reduce((sum, r) => sum + r.amount, 0);
  return Math.max(0, roundMoney(Math.min(allocated, remaining)));
};

// ─── Manual refund methods and evidence images ──────────────────────────────

export const MANUAL_REFUND_METHODS = ['WALLET', 'CASH', 'BANK_TRANSFER', 'VODAFONE_CASH', 'INSTAPAY'] as const;
export type ManualRefundMethod = (typeof MANUAL_REFUND_METHODS)[number];
export const REFERENCE_REQUIRED_METHODS: ManualRefundMethod[] = ['BANK_TRANSFER', 'VODAFONE_CASH', 'INSTAPAY'];

export const MAX_REFUND_IMAGES = 5;
/** Only files stored by the existing upload endpoint (`/uploads/<uuid>.<ext>`). */
export const REFUND_IMAGE_PATH = /^\/uploads\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i;

export const parseRefundImages = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};
