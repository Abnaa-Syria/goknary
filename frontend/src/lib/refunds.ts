import { IMAGE_PLACEHOLDER } from '../utils/image';

export type RefundStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ITEM_RECEIVED'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'REJECTED';

export type RefundKind = 'RETURN' | 'CANCELLED_PAYMENT';

export type RefundAction =
  | 'START_REVIEW'
  | 'RECOMMEND'
  | 'APPROVE'
  | 'REJECT'
  | 'RECEIVE'
  | 'START_REFUND'
  | 'COMPLETE_MANUAL';

export type ManualRefundMethod = 'WALLET' | 'CASH' | 'BANK_TRANSFER' | 'VODAFONE_CASH' | 'INSTAPAY';

export interface RefundHistoryEntry {
  id: string;
  fromStatus: RefundStatus | null;
  toStatus: RefundStatus;
  actorRole: string | null;
  actorId?: string | null;
  notes: string | null;
  createdAt: string;
}

export interface GatewayAvailability {
  available: boolean;
  status: string;
  message: string;
  hasPaymentReference: boolean;
}

export interface Refund {
  id: string;
  orderId: string;
  orderItemId: string | null;
  vendorId: string;
  kind: RefundKind;
  quantity: number;
  reason: string;
  description: string | null;
  images: string[];
  amount: number;
  status: string;
  currentStatus: RefundStatus;
  isLegacy: boolean;
  vendorDecision: 'APPROVE' | 'REJECT' | null;
  vendorNotes: string | null;
  adminNotes: string | null;
  refundMethod: string | null;
  manualReference: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  actions: RefundAction[];
  returnedQuantity: number;
  history: RefundHistoryEntry[];
  customer: { id: string; name: string | null; email: string };
  orderItem: {
    id: string;
    quantity: number;
    price: number;
    discountPrice: number | null;
    variantInfo: string | null;
    product: { id: string; name: string; nameAr?: string | null; slug: string; images: string };
  } | null;
  order: {
    id: string;
    status: string;
    createdAt: string;
    paymentMethod: string | null;
    paymentStatus?: string;
    total?: number;
    shippingCost?: number;
    paidAt?: string | null;
  };
  processedBy?: string | null;
  gatewayRefundId?: string | null;
  vendorStoreName?: string | null;
  gateway?: GatewayAvailability;
}

export interface OrderItemRefundSummary {
  id: string;
  status: string;
  quantity: number;
  amount: number;
  createdAt: string;
}

export const REFUND_STATUSES: RefundStatus[] = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ITEM_RECEIVED',
  'REFUND_PROCESSING',
  'REFUNDED',
  'REJECTED',
];

const LEGACY_STATUS_MAP: Record<string, RefundStatus> = {
  PENDING: 'REQUESTED',
  VENDOR_APPROVED: 'UNDER_REVIEW',
  VENDOR_REJECTED: 'UNDER_REVIEW',
  ADMIN_APPROVED: 'REFUNDED',
  ADMIN_REJECTED: 'REJECTED',
};

/** Mirrors the backend mapping so order-detail badges agree with the refunds pages. */
export const toCurrentRefundStatus = (status: string): RefundStatus =>
  LEGACY_STATUS_MAP[status] ?? (status as RefundStatus);

export const isActiveRefundStatus = (status: string) => toCurrentRefundStatus(status) !== 'REJECTED';

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  ITEM_RECEIVED: 'Item received',
  REFUND_PROCESSING: 'Refund processing',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
};

export const REFUND_STATUS_STYLES: Record<RefundStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ITEM_RECEIVED: 'bg-purple-50 text-purple-700 border-purple-200',
  REFUND_PROCESSING: 'bg-orange-50 text-orange-700 border-orange-200',
  REFUNDED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

export const CUSTOMER_STATUS_HINTS: Partial<Record<RefundStatus, string>> = {
  REQUESTED: 'Your request was sent to the store and GoKnary for review.',
  UNDER_REVIEW: 'Your request is being reviewed.',
  APPROVED: 'Approved. Please send the item back so it can be inspected.',
  ITEM_RECEIVED: 'We received the item. Your refund will start shortly.',
  REFUND_PROCESSING: 'Your refund is being processed.',
  REJECTED: 'This request was rejected.',
};

export const RETURN_REASONS = ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'WRONG_SIZE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'] as const;

export const RETURN_REASON_LABELS: Record<(typeof RETURN_REASONS)[number], string> = {
  DAMAGED: 'Arrived damaged',
  DEFECTIVE: 'Defective / not working',
  WRONG_ITEM: 'Wrong item received',
  WRONG_SIZE: 'Wrong size or variant',
  NOT_AS_DESCRIBED: 'Not as described',
  CHANGED_MIND: 'Changed my mind',
  OTHER: 'Other',
};

export const MANUAL_REFUND_METHODS: ManualRefundMethod[] = ['WALLET', 'CASH', 'BANK_TRANSFER', 'VODAFONE_CASH', 'INSTAPAY'];

export const REFERENCE_REQUIRED_METHODS: ManualRefundMethod[] = ['BANK_TRANSFER', 'VODAFONE_CASH', 'INSTAPAY'];

export const REFUND_METHOD_LABELS: Record<string, string> = {
  WALLET: 'Customer wallet',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  VODAFONE_CASH: 'Vodafone Cash',
  INSTAPAY: 'InstaPay',
  KASHIER: 'Kashier (automatic)',
};

export const MAX_REFUND_IMAGES = 5;

export const productImage = (images: string | undefined | null): string => {
  try {
    const parsed = typeof images === 'string' ? JSON.parse(images) : images;
    return Array.isArray(parsed) && parsed[0] ? parsed[0] : IMAGE_PLACEHOLDER;
  } catch {
    return IMAGE_PLACEHOLDER;
  }
};
