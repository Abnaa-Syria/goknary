import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { calculateVendorNetEarnings } from '../lib/vendor-earnings';
import { restoreStock } from '../lib/variants';
import { formatPrice as formatAmount } from '../lib/utils';
import { NotificationType, notifyAdmins, notifyUser, notifyVendor, shortId } from '../lib/notify';
import { getGatewayRefundAvailability, processGatewayRefund } from '../lib/gateway-refund';
import { trackAuthenticatedCustomerEvent } from '../lib/user-events';
import {
  CurrentRefundStatus,
  MANUAL_REFUND_METHODS,
  MAX_REFUND_IMAGES,
  REFERENCE_REQUIRED_METHODS,
  REFUND_IMAGE_PATH,
  RefundKind,
  calculateReturnAmount,
  canTransitionRefund,
  checkReturnWindow,
  getDeliveredAt,
  isActiveRefund,
  isCurrentRefundStatus,
  isLegacyRefundStatus,
  legacyVendorDecision,
  parseRefundImages,
  returnableQuantity,
  roundMoney,
  storedStatusesFor,
  toCurrentRefundStatus,
} from '../lib/refund-workflow';

type Tx = Prisma.TransactionClient;
type Actor = { id: string; role: string };

const isAdminRole = (role: string) => role === 'ADMIN' || role === 'STAFF';

const refundInclude = {
  orderItem: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      quantity: true,
      price: true,
      discountPrice: true,
      variantInfo: true,
      product: { select: { id: true, name: true, nameAr: true, slug: true, images: true } },
    },
  },
  order: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      total: true,
      subtotal: true,
      shippingCost: true,
      discountAmount: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentTransactionId: true,
      paymentProviderOrderId: true,
      paidAt: true,
    },
  },
  customer: { select: { id: true, name: true, email: true } },
  history: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.RefundRequestInclude;

type RefundWithRelations = Prisma.RefundRequestGetPayload<{ include: typeof refundInclude }>;

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Invalid input data', details: error.errors });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ error: fallback });
};

// ─── Serialization ───────────────────────────────────────────────────────────

const ADMIN_ACTIONS: Array<[string, CurrentRefundStatus]> = [
  ['APPROVE', 'APPROVED'],
  ['REJECT', 'REJECTED'],
  ['RECEIVE', 'ITEM_RECEIVED'],
  ['START_REFUND', 'REFUND_PROCESSING'],
  ['COMPLETE_MANUAL', 'REFUNDED'],
];

const allowedActions = (refund: Pick<RefundWithRelations, 'status' | 'kind' | 'vendorDecision'>, role: string): string[] => {
  const current = toCurrentRefundStatus(refund.status);
  if (role === 'VENDOR') {
    if (refund.kind !== RefundKind.RETURN) return [];
    const decided = refund.vendorDecision ?? legacyVendorDecision(refund.status);
    const actions: string[] = [];
    if (current === 'REQUESTED') actions.push('START_REVIEW');
    if ((current === 'REQUESTED' || current === 'UNDER_REVIEW') && !decided) actions.push('RECOMMEND');
    return actions;
  }
  if (!isAdminRole(role)) return [];
  return ADMIN_ACTIONS.filter(([, to]) => canTransitionRefund(refund.status, to, refund.kind)).map(([action]) => action);
};

interface SerializeContext {
  returnedByItem?: Map<string, number>;
  vendorNames?: Map<string, string>;
}

const serializeRefund = (refund: RefundWithRelations, role: string, ctx: SerializeContext = {}) => {
  const admin = isAdminRole(role);
  const { order, history, processedBy, gatewayRefundId, ...rest } = refund;
  return {
    ...rest,
    images: parseRefundImages(refund.images),
    currentStatus: toCurrentRefundStatus(refund.status),
    isLegacy: isLegacyRefundStatus(refund.status),
    vendorDecision: refund.vendorDecision ?? legacyVendorDecision(refund.status),
    // Legacy approvals always credited the customer's wallet.
    refundMethod: refund.refundMethod ?? (refund.status === 'ADMIN_APPROVED' ? 'WALLET' : null),
    actions: allowedActions(refund, role),
    returnedQuantity: refund.orderItemId ? ctx.returnedByItem?.get(refund.orderItemId) ?? refund.quantity : 0,
    history: history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus ? toCurrentRefundStatus(h.fromStatus) : null,
      toStatus: toCurrentRefundStatus(h.toStatus),
      actorRole: h.actorRole,
      notes: h.notes,
      createdAt: h.createdAt,
      ...(admin ? { actorId: h.actorId } : {}),
    })),
    order: {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      ...(admin ? { paymentStatus: order.paymentStatus, total: order.total, shippingCost: order.shippingCost, paidAt: order.paidAt } : {}),
    },
    ...(admin
      ? {
          processedBy,
          gatewayRefundId,
          vendorStoreName: ctx.vendorNames?.get(refund.vendorId) ?? null,
          gateway: getGatewayRefundAvailability(order),
        }
      : {}),
  };
};

/** Active (non-rejected) returned quantity per order item, for "purchased vs returned" displays. */
const loadReturnedQuantities = async (orderItemIds: string[]) => {
  const map = new Map<string, number>();
  if (orderItemIds.length === 0) return map;
  const rows = await prisma.refundRequest.findMany({
    where: { orderItemId: { in: orderItemIds } },
    select: { orderItemId: true, status: true, quantity: true },
  });
  for (const row of rows) {
    if (!row.orderItemId || !isActiveRefund(row.status)) continue;
    map.set(row.orderItemId, (map.get(row.orderItemId) ?? 0) + row.quantity);
  }
  return map;
};

const buildContext = async (refunds: RefundWithRelations[], role: string): Promise<SerializeContext> => {
  const itemIds = Array.from(new Set(refunds.map((r) => r.orderItemId).filter((id): id is string => !!id)));
  const ctx: SerializeContext = { returnedByItem: await loadReturnedQuantities(itemIds) };
  if (isAdminRole(role)) {
    const vendorIds = Array.from(new Set(refunds.map((r) => r.vendorId)));
    const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, storeName: true } });
    ctx.vendorNames = new Map(vendors.map((v) => [v.id, v.storeName]));
  }
  return ctx;
};

// ─── Transition core ─────────────────────────────────────────────────────────

interface TransitionInput {
  to: CurrentRefundStatus;
  notes?: string | null;
  data?: Prisma.RefundRequestUncheckedUpdateManyInput;
  /** Extra conditions for the conditional UPDATE (e.g. receivedAt: null). */
  guard?: Prisma.RefundRequestWhereInput;
}

/**
 * Conditional UPDATE on the status read in this transaction: a concurrent or repeated action finds
 * no matching row and fails, so every side effect that follows runs at most once.
 */
const applyTransition = async (tx: Tx, refund: Pick<RefundWithRelations, 'id' | 'status' | 'kind'>, actor: Actor, input: TransitionInput) => {
  const current = toCurrentRefundStatus(refund.status);
  if (!canTransitionRefund(refund.status, input.to, refund.kind)) {
    throw new ValidationError(`A request in status ${current} cannot be moved to ${input.to}`);
  }
  const { count } = await tx.refundRequest.updateMany({
    where: { id: refund.id, status: refund.status, ...input.guard },
    data: { ...input.data, status: input.to },
  });
  if (count === 0) {
    throw new ConflictError('This request was already updated. Refresh and try again.');
  }
  await tx.refundStatusHistory.create({
    data: {
      refundRequestId: refund.id,
      fromStatus: refund.status,
      toStatus: input.to,
      actorId: actor.id,
      actorRole: actor.role,
      notes: input.notes || null,
    },
  });
};

const loadRefund = async (tx: Tx, id: string) => {
  const refund = await tx.refundRequest.findUnique({ where: { id }, include: refundInclude });
  if (!refund) throw new NotFoundError('Refund request not found');
  return refund;
};

const loadVendorRefund = async (tx: Tx, id: string, actor: Actor) => {
  const vendor = await tx.vendor.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');
  const refund = await loadRefund(tx, id);
  if (refund.vendorId !== vendor.id) throw new ForbiddenError('You do not own this return request');
  if (refund.kind !== RefundKind.RETURN) throw new ForbiddenError('This refund is handled by the platform');
  return refund;
};

const requireReturnItem = (refund: RefundWithRelations) => {
  if (refund.kind !== RefundKind.RETURN || !refund.orderItem) {
    throw new ValidationError('This action applies to item returns only');
  }
  return refund.orderItem;
};

const productLabel = (refund: RefundWithRelations) => ({
  en: refund.orderItem?.product.name ?? `order #${shortId(refund.orderId)}`,
  ar: refund.orderItem?.product.nameAr || refund.orderItem?.product.name || `الطلب #${shortId(refund.orderId)}`,
});

const notifyCustomerStatus = (refund: RefundWithRelations, en: { title: string; message: string }, ar: { title: string; message: string }, type: (typeof NotificationType)[keyof typeof NotificationType] = NotificationType.RETURN_STATUS_CHANGED) =>
  notifyUser(refund.customerId, {
    type,
    title: en.title,
    titleAr: ar.title,
    message: en.message,
    messageAr: ar.message,
    link: '/account/refunds',
    entityType: 'REFUND',
    entityId: refund.id,
  });

const notifyVendorStatus = (refund: RefundWithRelations, en: { title: string; message: string }, ar: { title: string; message: string }, type: (typeof NotificationType)[keyof typeof NotificationType] = NotificationType.RETURN_STATUS_CHANGED) =>
  notifyVendor(refund.vendorId, {
    type,
    title: en.title,
    titleAr: ar.title,
    message: en.message,
    messageAr: ar.message,
    link: '/vendor/refunds',
    entityType: 'REFUND',
    entityId: refund.id,
  });

interface ActionResult {
  refundId: string;
  message: string;
  /** Runs after the transaction commits, with the refreshed request. */
  notify?: (refund: RefundWithRelations) => Promise<unknown>;
}

type ActionFn = (tx: Tx, req: AuthRequest, actor: Actor) => Promise<ActionResult>;

const runAction = (fn: ActionFn) => async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const actor = { id: req.user.id, role: req.user.role };
    const result = await prisma.$transaction((tx) => fn(tx, req, actor));
    const refund = await prisma.refundRequest.findUniqueOrThrow({ where: { id: result.refundId }, include: refundInclude });
    await result.notify?.(refund);
    res.json({ message: result.message, refund: serializeRefund(refund, actor.role, await buildContext([refund], actor.role)) });
  } catch (error) {
    sendError(res, error, 'Failed to update the refund request');
  }
};

const notesSchema = z.object({ notes: z.string().trim().max(2000).optional() });

// ─── Customer ────────────────────────────────────────────────────────────────

const createRefundSchema = z.object({
  orderItemId: z.string().min(1),
  // Omitted by older clients: defaults to every unit that can still be returned.
  quantity: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(500),
  description: z.string().trim().max(2000).optional(),
  images: z
    .array(z.string().regex(REFUND_IMAGE_PATH, 'Images must be uploaded through the upload endpoint'))
    .max(MAX_REFUND_IMAGES, `At most ${MAX_REFUND_IMAGES} images are allowed`)
    .optional(),
});

// POST /api/refunds
export const createRefundRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const actor = { id: req.user.id, role: req.user.role };
    const input = createRefundSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      // Serializes concurrent requests for the same item so the returnable quantity cannot be exceeded.
      await tx.$queryRaw`SELECT id FROM order_items WHERE id = ${input.orderItemId} FOR UPDATE`;

      const item = await tx.orderItem.findUnique({
        where: { id: input.orderItemId },
        include: {
          order: { include: { vendor: { select: { returnWindowDays: true } } } },
          refundRequests: { select: { status: true, quantity: true, amount: true } },
        },
      });
      if (!item) throw new NotFoundError('Order item not found');
      if (item.order.userId !== actor.id) throw new ForbiddenError('You do not own this order');
      if (item.order.status !== 'DELIVERED') throw new ValidationError('Returns can only be requested for delivered orders');

      const window = checkReturnWindow(item.order.vendor.returnWindowDays, await getDeliveredAt(tx, item.orderId));
      if (!window.allowed) throw new ValidationError(window.message || 'Returns are not available for this order');

      const remaining = returnableQuantity(item, item.refundRequests);
      const quantity = input.quantity ?? remaining;
      if (remaining === 0) throw new ValidationError('All units of this item already have a return request');
      if (quantity > remaining) throw new ValidationError(`Only ${remaining} unit(s) of this item can still be returned`);

      const refund = await tx.refundRequest.create({
        data: {
          orderId: item.orderId,
          orderItemId: item.id,
          customerId: actor.id,
          vendorId: item.order.vendorId,
          kind: RefundKind.RETURN,
          quantity,
          reason: input.reason,
          description: input.description || null,
          images: input.images?.length ? JSON.stringify(input.images) : null,
          amount: calculateReturnAmount(item, item.order, quantity, item.refundRequests),
          status: 'REQUESTED',
        },
        include: refundInclude,
      });
      await tx.refundStatusHistory.create({
        data: { refundRequestId: refund.id, fromStatus: null, toStatus: 'REQUESTED', actorId: actor.id, actorRole: actor.role, notes: input.reason },
      });
      return refund;
    });

    trackAuthenticatedCustomerEvent(req.user, {
      type: 'RETURN_REQUEST',
      productId: created.orderItem?.productId ?? null,
      vendorId: created.vendorId,
      orderId: created.orderId,
      orderItemId: created.orderItemId,
      metadata: {
        refundRequestId: created.id,
        variantId: created.orderItem?.variantId ?? null,
        quantity: created.quantity,
      },
      dedupeKey: `RETURN_REQUEST:${created.id}`,
    });

    const label = productLabel(created);
    await notifyVendor(created.vendorId, {
      type: NotificationType.RETURN_REQUESTED,
      title: 'New return request',
      titleAr: 'طلب إرجاع جديد',
      message: `A customer requested to return ${created.quantity} × "${label.en}" from order #${shortId(created.orderId)}.`,
      messageAr: `عميل طلب إرجاع ${created.quantity} × "${label.ar}" من الطلب رقم #${shortId(created.orderId)}.`,
      link: '/vendor/refunds',
      entityType: 'REFUND',
      entityId: created.id,
    });

    const refreshed = await prisma.refundRequest.findUniqueOrThrow({ where: { id: created.id }, include: refundInclude });
    res.status(201).json({
      message: 'Return request submitted successfully',
      refundRequest: serializeRefund(refreshed, actor.role, await buildContext([refreshed], actor.role)),
    });
  } catch (error) {
    sendError(res, error, 'Failed to submit return request');
  }
};

// GET /api/refunds/eligibility/:orderId
export const getReturnEligibility = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, userId: req.user.id },
      include: {
        vendor: { select: { returnWindowDays: true } },
        items: { include: { refundRequests: { select: { id: true, status: true, quantity: true, amount: true, createdAt: true } } } },
      },
    });
    if (!order) throw new NotFoundError('Order not found');

    const delivered = order.status === 'DELIVERED';
    const window = checkReturnWindow(order.vendor.returnWindowDays, delivered ? await getDeliveredAt(prisma, order.id) : null);
    const canRequest = delivered && window.allowed;

    res.json({
      orderId: order.id,
      delivered,
      windowDays: window.windowDays,
      deliveredAt: window.deliveredAt,
      deadline: window.deadline,
      windowOpen: canRequest,
      message: !delivered ? 'Returns open once the order is delivered' : window.message ?? null,
      items: order.items.map((item) => {
        const remaining = returnableQuantity(item, item.refundRequests);
        return {
          orderItemId: item.id,
          purchasedQuantity: item.quantity,
          returnableQuantity: remaining,
          eligible: canRequest && remaining > 0,
          requests: item.refundRequests.map((r) => ({
            id: r.id,
            currentStatus: toCurrentRefundStatus(r.status),
            quantity: r.quantity,
            amount: r.amount,
            createdAt: r.createdAt,
          })),
        };
      }),
    });
  } catch (error) {
    sendError(res, error, 'Failed to check return eligibility');
  }
};

// ─── Shared reads ────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.string().optional(),
  kind: z.enum([RefundKind.RETURN, RefundKind.CANCELLED_PAYMENT]).optional(),
});

// GET /api/refunds
export const getRefundRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role;
    const { status, kind } = listQuerySchema.parse(req.query);
    const where: Prisma.RefundRequestWhereInput = {};

    if (role === 'CUSTOMER') {
      where.customerId = req.user.id;
    } else if (role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
      where.vendorId = vendor.id;
      // Payment refunds of cancelled orders are an internal platform matter.
      where.kind = RefundKind.RETURN;
    }
    if (status && isCurrentRefundStatus(status)) where.status = { in: storedStatusesFor([status]) };
    if (kind && role !== 'VENDOR') where.kind = kind;

    const refunds = await prisma.refundRequest.findMany({ where, include: refundInclude, orderBy: { createdAt: 'desc' } });
    const ctx = await buildContext(refunds, role);
    res.json({ refunds: refunds.map((r) => serializeRefund(r, role, ctx)) });
  } catch (error) {
    sendError(res, error, 'Failed to fetch refund requests');
  }
};

// GET /api/refunds/:id
export const getRefundRequestById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const refund = await prisma.refundRequest.findUnique({ where: { id: req.params.id }, include: refundInclude });
    if (!refund) throw new NotFoundError('Refund request not found');

    if (req.user.role === 'CUSTOMER' && refund.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!vendor || refund.vendorId !== vendor.id || refund.kind !== RefundKind.RETURN) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ refund: serializeRefund(refund, req.user.role, await buildContext([refund], req.user.role)) });
  } catch (error) {
    sendError(res, error, 'Failed to fetch refund request details');
  }
};

// ─── Vendor actions ──────────────────────────────────────────────────────────

const vendorStartReview: ActionFn = async (tx, req, actor) => {
  const { notes } = notesSchema.parse(req.body ?? {});
  const refund = await loadVendorRefund(tx, req.params.id, actor);
  await applyTransition(tx, refund, actor, { to: 'UNDER_REVIEW', notes: notes || 'Seller started reviewing the return' });
  return {
    refundId: refund.id,
    message: 'Return moved to review',
    notify: (r) => {
      const label = productLabel(r);
      return notifyCustomerStatus(
        r,
        { title: 'Your return is under review', message: `The seller is reviewing your return of "${label.en}".` },
        { title: 'طلب الإرجاع قيد المراجعة', message: `البائع بيراجع طلب إرجاع "${label.ar}".` }
      );
    },
  };
};

const recommendSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().trim().min(3).max(2000),
});

const vendorRecommendWith = (decision: 'APPROVE' | 'REJECT', notes: string): ActionFn => async (tx, req, actor) => {
  const refund = await loadVendorRefund(tx, req.params.id, actor);
  const current = toCurrentRefundStatus(refund.status);
  if (current !== 'REQUESTED' && current !== 'UNDER_REVIEW') {
    throw new ValidationError(`A request in status ${current} can no longer be reviewed by the seller`);
  }
  if (refund.vendorDecision ?? legacyVendorDecision(refund.status)) {
    throw new ConflictError('You already sent your recommendation for this return');
  }

  const historyNote = `Seller recommends ${decision === 'APPROVE' ? 'approval' : 'rejection'}: ${notes}`;
  if (current === 'REQUESTED') {
    await applyTransition(tx, refund, actor, {
      to: 'UNDER_REVIEW',
      notes: historyNote,
      data: { vendorDecision: decision, vendorNotes: notes },
      guard: { vendorDecision: null },
    });
  } else {
    const { count } = await tx.refundRequest.updateMany({
      where: { id: refund.id, status: refund.status, vendorDecision: null },
      data: { vendorDecision: decision, vendorNotes: notes },
    });
    if (count === 0) throw new ConflictError('This request was already updated. Refresh and try again.');
    await tx.refundStatusHistory.create({
      data: { refundRequestId: refund.id, fromStatus: refund.status, toStatus: refund.status, actorId: actor.id, actorRole: actor.role, notes: historyNote },
    });
  }

  return {
    refundId: refund.id,
    message: 'Recommendation sent to the platform',
    notify: async (r) => {
      const label = productLabel(r);
      const approve = decision === 'APPROVE';
      await notifyCustomerStatus(
        r,
        {
          title: approve ? 'Return accepted by the seller' : 'Return declined by the seller',
          message: approve
            ? 'The seller accepted your return request. It is now waiting for final platform review.'
            : 'The seller declined your return request. The platform will make the final decision.',
        },
        {
          title: approve ? 'البائع وافق على طلب الإرجاع' : 'البائع رفض طلب الإرجاع',
          message: approve
            ? 'البائع وافق على طلب الإرجاع، والطلب الآن في انتظار المراجعة النهائية من المنصة.'
            : 'البائع رفض طلب الإرجاع، والقرار النهائي هيكون من إدارة المنصة.',
        }
      );
      await notifyAdmins({
        type: NotificationType.RETURN_STATUS_CHANGED,
        title: 'Return request awaiting decision',
        titleAr: 'طلب إرجاع في انتظار القرار',
        message: `The seller ${approve ? 'recommends approving' : 'recommends rejecting'} the return of "${label.en}" (${formatAmount(r.amount)}).`,
        messageAr: `البائع ${approve ? 'بيرشح الموافقة على' : 'بيرشح رفض'} إرجاع "${label.ar}" (${formatAmount(r.amount)}).`,
        link: '/admin/refunds',
        entityType: 'REFUND',
        entityId: r.id,
      });
    },
  };
};

const vendorRecommend: ActionFn = (tx, req, actor) => {
  const { decision, notes } = recommendSchema.parse(req.body);
  return vendorRecommendWith(decision, notes)(tx, req, actor);
};

export const startVendorReview = runAction(vendorStartReview);
export const recommendRefund = runAction(vendorRecommend);

// ─── Admin actions ───────────────────────────────────────────────────────────

const adminApprove = (notes?: string): ActionFn => async (tx, req, actor) => {
  const refund = await loadRefund(tx, req.params.id);
  const item = requireReturnItem(refund);
  const siblings = await tx.refundRequest.findMany({
    where: { orderItemId: item.id, id: { not: refund.id } },
    select: { status: true, quantity: true, amount: true },
  });
  // Recomputed from the purchase snapshot, so legacy requests (coupon ignored) cannot over-refund.
  const amount = calculateReturnAmount(item, refund.order, refund.quantity, siblings);
  await applyTransition(tx, refund, actor, {
    to: 'APPROVED',
    notes: notes || 'Return approved by the platform',
    data: { amount, ...(notes ? { adminNotes: notes } : {}) },
  });
  return {
    refundId: refund.id,
    message: 'Return approved. Mark the item as received when it arrives.',
    notify: async (r) => {
      const label = productLabel(r);
      await notifyCustomerStatus(
        r,
        { title: 'Return approved', message: `Your return of "${label.en}" was approved. Please send the item back; the refund of ${formatAmount(r.amount)} follows once it is received.` },
        { title: 'تمت الموافقة على الإرجاع', message: `تمت الموافقة على إرجاع "${label.ar}". ابعت المنتج، وهيتم رد ${formatAmount(r.amount)} بعد استلامه.` }
      );
      await notifyVendorStatus(
        r,
        { title: 'Return approved by the platform', message: `The return of ${r.quantity} × "${label.en}" was approved. The item will be sent back.` },
        { title: 'المنصة وافقت على الإرجاع', message: `تمت الموافقة على إرجاع ${r.quantity} × "${label.ar}"، والمنتج هيترجع.` }
      );
    },
  };
};

const adminReject = (notes: string): ActionFn => async (tx, req, actor) => {
  const refund = await loadRefund(tx, req.params.id);
  await applyTransition(tx, refund, actor, { to: 'REJECTED', notes, data: { adminNotes: notes } });
  return {
    refundId: refund.id,
    message: 'Return request rejected',
    notify: async (r) => {
      const label = productLabel(r);
      await notifyCustomerStatus(
        r,
        { title: 'Return request rejected', message: `Your return of "${label.en}" was rejected: ${notes}` },
        { title: 'تم رفض طلب الإرجاع', message: `تم رفض طلب إرجاع "${label.ar}": ${notes}` }
      );
      if (r.kind === RefundKind.RETURN) {
        await notifyVendorStatus(
          r,
          { title: 'Return rejected by the platform', message: `The return request for "${label.en}" was rejected.` },
          { title: 'المنصة رفضت طلب الإرجاع', message: `تم رفض طلب إرجاع "${label.ar}".` }
        );
      }
    },
  };
};

const adminReceive: ActionFn = async (tx, req, actor) => {
  const { notes } = notesSchema.parse(req.body ?? {});
  const refund = await loadRefund(tx, req.params.id);
  const item = requireReturnItem(refund);
  await applyTransition(tx, refund, actor, {
    to: 'ITEM_RECEIVED',
    notes: notes || 'Returned item received',
    data: { receivedAt: new Date() },
    guard: { receivedAt: null },
  });
  // Same variant (or product) the customer bought; runs only for the call that performed the transition.
  await restoreStock(tx, { productId: item.productId, variantId: item.variantId, quantity: refund.quantity });
  return {
    refundId: refund.id,
    message: 'Item marked as received and stock restored',
    notify: (r) => {
      const label = productLabel(r);
      return notifyCustomerStatus(
        r,
        { title: 'Returned item received', message: `We received your returned "${label.en}". Your refund will be processed next.` },
        { title: 'تم استلام المنتج المرتجع', message: `استلمنا "${label.ar}" المرتجع، وهيتم تنفيذ الاسترداد قريب.` }
      );
    },
  };
};

const adminStartRefund: ActionFn = async (tx, req, actor) => {
  const { notes } = notesSchema.parse(req.body ?? {});
  const refund = await loadRefund(tx, req.params.id);
  await applyTransition(tx, refund, actor, { to: 'REFUND_PROCESSING', notes: notes || 'Refund processing started' });
  return {
    refundId: refund.id,
    message: 'Refund processing started',
    notify: (r) =>
      notifyCustomerStatus(
        r,
        { title: 'Refund in progress', message: `Your refund of ${formatAmount(r.amount)} is being processed.` },
        { title: 'جاري تنفيذ الاسترداد', message: `جاري تنفيذ استرداد ${formatAmount(r.amount)}.` }
      ),
  };
};

const completeManualSchema = z.object({
  method: z.enum(MANUAL_REFUND_METHODS),
  reference: z.string().trim().max(191).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const adminCompleteManual: ActionFn = async (tx, req, actor) => {
  const { method, reference, notes } = completeManualSchema.parse(req.body);
  if (REFERENCE_REQUIRED_METHODS.includes(method) && !reference) {
    throw new ValidationError(`A transfer reference is required for ${method} refunds`);
  }
  const refund = await loadRefund(tx, req.params.id);
  await applyTransition(tx, refund, actor, {
    to: 'REFUNDED',
    notes: notes || `Refund completed manually (${method})`,
    data: {
      refundMethod: method,
      manualReference: reference || null,
      refundedAt: new Date(),
      processedBy: actor.id,
      ...(notes ? { adminNotes: notes } : {}),
    },
    guard: { refundedAt: null },
  });

  if (method === 'WALLET') {
    await tx.user.update({ where: { id: refund.customerId }, data: { walletBalance: { increment: refund.amount } } });
  }

  // Undo the vendor's share only if the order was settled to the vendor (commission row exists).
  if (refund.kind === RefundKind.RETURN) {
    const commission = await tx.commission.findFirst({ where: { orderId: refund.orderId }, select: { commissionRate: true } });
    if (commission) {
      const { netEarnings } = calculateVendorNetEarnings(refund.amount, commission.commissionRate);
      await tx.vendor.update({ where: { id: refund.vendorId }, data: { balance: { decrement: netEarnings } } });
    }
  }

  return {
    refundId: refund.id,
    message: 'Refund completed',
    notify: async (r) => {
      const label = productLabel(r);
      const viaWallet = method === 'WALLET';
      await notifyCustomerStatus(
        r,
        {
          title: 'Refund completed',
          message: viaWallet
            ? `${formatAmount(r.amount)} has been added to your wallet balance.`
            : `Your refund of ${formatAmount(r.amount)} was sent (${method.replace('_', ' ').toLowerCase()}).`,
        },
        {
          title: 'تم استرداد المبلغ',
          message: viaWallet ? `تمت إضافة ${formatAmount(r.amount)} إلى رصيد محفظتك.` : `تم تحويل استرداد بقيمة ${formatAmount(r.amount)}.`,
        },
        NotificationType.REFUND_COMPLETED
      );
      if (r.kind === RefundKind.RETURN) {
        await notifyVendorStatus(
          r,
          { title: 'Refund completed', message: `The refund for the return of "${label.en}" (${formatAmount(r.amount)}) was completed. Your balance was adjusted.` },
          { title: 'تم تنفيذ الاسترداد', message: `تم تنفيذ استرداد إرجاع "${label.ar}" (${formatAmount(r.amount)}) وتعديل رصيدك.` },
          NotificationType.REFUND_COMPLETED
        );
      }
    },
  };
};

const rejectSchema = z.object({ notes: z.string().trim().min(3).max(2000) });

export const approveRefund = runAction((tx, req, actor) => adminApprove(notesSchema.parse(req.body ?? {}).notes)(tx, req, actor));
export const rejectRefund = runAction((tx, req, actor) => adminReject(rejectSchema.parse(req.body).notes)(tx, req, actor));
export const receiveRefundItem = runAction(adminReceive);
export const startRefundProcessing = runAction(adminStartRefund);
export const completeManualRefund = runAction(adminCompleteManual);

// POST /api/refunds/:id/gateway — automatic refund is not enabled yet; never changes the request.
export const requestGatewayRefund = async (req: AuthRequest, res: Response) => {
  try {
    const refund = await prisma.refundRequest.findUnique({ where: { id: req.params.id }, include: refundInclude });
    if (!refund) throw new NotFoundError('Refund request not found');
    if (toCurrentRefundStatus(refund.status) !== 'REFUND_PROCESSING') {
      throw new ValidationError('Start refund processing before choosing a refund method');
    }
    const result = await processGatewayRefund(refund.order);
    res.status(409).json({ error: result.message, code: result.status });
  } catch (error) {
    sendError(res, error, 'Failed to request the gateway refund');
  }
};

// ─── Payments captured after cancellation ────────────────────────────────────

// GET /api/refunds/payment-issues
export const getCancelledPaidOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'CANCELLED', paymentStatus: 'PAID' },
      select: {
        id: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        paymentMethod: true,
        paymentStatus: true,
        paymentTransactionId: true,
        paymentProviderOrderId: true,
        paidAt: true,
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, storeName: true } },
        refundRequests: { select: { id: true, kind: true, status: true, amount: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      orders: orders.map(({ refundRequests, paymentTransactionId: _tx, paymentProviderOrderId: _po, ...order }) => {
        const paymentRefund = refundRequests.find((r) => r.kind === RefundKind.CANCELLED_PAYMENT && isActiveRefund(r.status));
        const gateway = getGatewayRefundAvailability({ ...order, paymentTransactionId: _tx, paymentProviderOrderId: _po });
        return {
          ...order,
          paymentReferenceAvailable: gateway.hasPaymentReference,
          gateway,
          refund: paymentRefund
            ? { id: paymentRefund.id, currentStatus: toCurrentRefundStatus(paymentRefund.status), amount: paymentRefund.amount }
            : null,
        };
      }),
    });
  } catch (error) {
    sendError(res, error, 'Failed to load cancelled paid orders');
  }
};

// POST /api/refunds/orders/:orderId/cancelled-payment
export const createCancelledPaymentRefund = runAction(async (tx, req, actor) => {
  const { notes } = notesSchema.parse(req.body ?? {});
  const orderId = req.params.orderId;
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { refundRequests: { select: { kind: true, status: true, amount: true } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.status !== 'CANCELLED' || order.paymentStatus !== 'PAID') {
    throw new ValidationError('Only cancelled orders with a captured payment qualify for this refund');
  }
  if (order.refundRequests.some((r) => r.kind === RefundKind.CANCELLED_PAYMENT && isActiveRefund(r.status))) {
    throw new ConflictError('A payment refund is already open for this order');
  }
  const alreadyRefunded = order.refundRequests.filter((r) => isActiveRefund(r.status)).reduce((sum, r) => sum + r.amount, 0);
  const amount = roundMoney(order.total - alreadyRefunded);
  if (amount <= 0) throw new ValidationError('Nothing is left to refund for this order');

  // No item and no stock: the stock was already restored when the order was cancelled.
  const refund = await tx.refundRequest.create({
    data: {
      orderId: order.id,
      orderItemId: null,
      customerId: order.userId,
      vendorId: order.vendorId,
      kind: RefundKind.CANCELLED_PAYMENT,
      quantity: 0,
      reason: 'PAYMENT_AFTER_CANCELLATION',
      amount,
      status: 'APPROVED',
      adminNotes: notes || null,
    },
  });
  await tx.refundStatusHistory.create({
    data: {
      refundRequestId: refund.id,
      fromStatus: null,
      toStatus: 'APPROVED',
      actorId: actor.id,
      actorRole: actor.role,
      notes: notes || 'Refund opened for a payment captured after cancellation',
    },
  });

  return {
    refundId: refund.id,
    message: 'Payment refund opened',
    notify: (r) =>
      notifyCustomerStatus(
        r,
        { title: 'Refund opened for your cancelled order', message: `We are refunding ${formatAmount(r.amount)} paid for cancelled order #${shortId(r.orderId)}.` },
        { title: 'تم فتح استرداد لطلبك الملغي', message: `هنرجعلك ${formatAmount(r.amount)} المدفوعة للطلب الملغي رقم #${shortId(r.orderId)}.` }
      ),
  };
});

// ─── Legacy endpoints (kept for older clients) ───────────────────────────────

const legacyVendorSchema = z.object({
  status: z.enum(['VENDOR_APPROVED', 'VENDOR_REJECTED']),
  notes: z.string().trim().max(2000).optional(),
});

// PATCH /api/refunds/:id/vendor
export const updateVendorRefundStatus = runAction((tx, req, actor) => {
  const { status, notes } = legacyVendorSchema.parse(req.body);
  const decision = status === 'VENDOR_APPROVED' ? 'APPROVE' : 'REJECT';
  return vendorRecommendWith(decision, notes || `Seller ${decision === 'APPROVE' ? 'approved' : 'rejected'} the return`)(tx, req, actor);
});

const legacyAdminSchema = z.object({
  status: z.enum(['ADMIN_APPROVED', 'ADMIN_REJECTED']),
  notes: z.string().trim().max(2000).optional(),
});

// PATCH /api/refunds/:id/admin — approval no longer refunds or restores stock on its own;
// the item must be received and the refund completed through the new actions.
export const updateAdminRefundStatus = runAction((tx, req, actor) => {
  const { status, notes } = legacyAdminSchema.parse(req.body);
  return status === 'ADMIN_APPROVED'
    ? adminApprove(notes)(tx, req, actor)
    : adminReject(notes || 'Rejected by the platform')(tx, req, actor);
});
