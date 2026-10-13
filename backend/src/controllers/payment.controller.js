import kashierService from '../services/kashier.service.js';
import { prisma } from '../lib/prisma.js';
import { restoreOrderStock } from '../lib/variants.js';
import { notifyCustomerOrderStatus, notifyVendorOrderStatus, shortId } from '../lib/notify.js';
import { trackPurchasesForOrders } from '../lib/user-events.js';
import { calculateCheckoutExpiresAt } from '../lib/checkout-expiry-config.js';
import { cancelCheckoutAttempt, markCheckoutPaid } from '../services/checkout-lifecycle.service.js';

/**
 * PaymentController
 * Extracted request data and delegates business logic to KashierService.
 */

const getKashierSignature = (headers) => (
  headers['x-kashier-signature'] ||
  headers['x-signature'] ||
  headers.signature ||
  headers['kashier-signature']
);

const extractKashierOrderReference = (payload) => {
  const orderData = payload.data || payload;
  const candidates = [
    orderData.orderId ||
    payload.orderId,
    orderData.merchantOrderId,
    orderData.merchantOrderID,
    orderData.order,
    payload.merchantOrderId,
    payload.merchantOrderID,
  ].map(cleanReference).filter(Boolean);
  return candidates.find((value) => value.startsWith('gk_checkout_')) || candidates[0] || null;
};

const resolveKashierCheckout = async (payload) => {
  const orderData = payload.data || payload;
  const orderReference = extractKashierOrderReference(payload);
  const orderIdsFromMetadata = orderData.metadata?.orderIds || payload.metadata?.orderIds;
  if (Array.isArray(orderIdsFromMetadata) && orderIdsFromMetadata.some(Boolean)) {
    const orderIds = orderIdsFromMetadata.filter(Boolean);
    const linked = await prisma.order.findFirst({
      where: { id: { in: orderIds }, checkoutAttemptId: { not: null } },
      select: { checkoutAttemptId: true },
    });
    if (linked?.checkoutAttemptId) {
      const attempt = await prisma.checkoutAttempt.findUnique({
        where: { id: linked.checkoutAttemptId },
        include: { orders: { select: { id: true } } },
      });
      if (attempt) {
        return {
          orderIds: attempt.orders.map((order) => order.id),
          checkoutAttemptId: attempt.id,
          orderReference,
        };
      }
    }
    return { orderIds, checkoutAttemptId: null, orderReference };
  }

  if (orderReference) {
    const attempt = await prisma.checkoutAttempt.findUnique({
      where: { providerReference: orderReference },
      include: { orders: { select: { id: true } } },
    });
    if (attempt) {
      return { orderIds: attempt.orders.map((order) => order.id), checkoutAttemptId: attempt.id, orderReference };
    }
  }

  // Backward compatibility for payment sessions created before checkout attempts existed.
  return {
    orderIds: String(orderReference || '').split('__').filter(Boolean),
    checkoutAttemptId: null,
    orderReference,
  };
};

const getKashierOutcome = (payload) => {
  const orderData = payload.data || payload;
  const event = String(payload.event || orderData.event || '').toLowerCase();
  const status = String(
    orderData.status ||
    orderData.paymentStatus ||
    payload.status ||
    payload.paymentStatus ||
    ''
  ).toLowerCase();

  const isSuccess =
    ['success', 'successful', 'completed', 'paid', 'captured'].includes(status) ||
    ['pay_conf', 'transaction.completed', 'payment.success', 'payment_success'].includes(event);
  const isFailure =
    ['failed', 'declined', 'cancelled', 'canceled', 'expired'].includes(status) ||
    ['payment.failed', 'transaction.failed', 'payment_failed'].includes(event);

  return { isSuccess, isFailure, status, event };
};

// The order-reference fields above are what Kashier has always been parsed with. The provider
// identifiers below were not read before; their names must be confirmed against a real (sandbox)
// webhook before automatic refunds depend on them. Missing values are stored as NULL.
const MAX_REFERENCE_LENGTH = 191;

const cleanReference = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const reference = String(value).trim();
  return reference && reference.length <= MAX_REFERENCE_LENGTH ? reference : null;
};

const extractKashierPaymentReferences = (payload) => {
  const orderData = payload.data || payload;
  return {
    transactionId: cleanReference(orderData.transactionId || orderData.transaction_id || payload.transactionId),
    providerOrderId: cleanReference(orderData.kashierOrderId || orderData.kashier_order_id || payload.kashierOrderId),
  };
};

// TEMPORARY (sandbox verification): logs the verified webhook's field names, never values.
// Remove once the real payload shape is confirmed.
const ID_LIKE_KEY = /(^|_)id$|Id$|ID$|order|reference|transaction|session/i;

const collectKeyPaths = (value, prefix = '', depth = 0, out = { objects: {}, idLike: [] }) => {
  if (!value || typeof value !== 'object' || depth > 3) return out;
  const node = Array.isArray(value) ? value[0] : value;
  if (!node || typeof node !== 'object') return out;
  const label = prefix || '(root)';
  out.objects[Array.isArray(value) ? `${label}[]` : label] = Object.keys(node);
  for (const [key, child] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') collectKeyPaths(child, path, depth + 1, out);
    else if (ID_LIKE_KEY.test(key) && (typeof child === 'string' || typeof child === 'number')) {
      out.idLike.push({ path, type: typeof child, length: String(child).length, value: String(child) });
    }
  }
  return out;
};

const logVerifiedKashierStructure = async (payload) => {
  try {
    const { objects, idLike } = collectKeyPaths(payload);
    const statusField = ['data.status', 'data.paymentStatus', 'status', 'paymentStatus']
      .find((path) => path.split('.').reduce((node, key) => node?.[key], payload) != null) || 'none';
    const idFields = [];
    for (const field of idLike) {
      const parts = field.value.split('__').filter(Boolean);
      const matches = parts.length > 0 ? await prisma.order.count({ where: { id: { in: parts } } }) : 0;
      idFields.push(`${field.path} (${field.type}, len=${field.length}, matchesOurOrderIds=${matches > 0 && matches === parts.length})`);
    }
    console.log(
      'Kashier verified webhook structure:\n' +
      Object.entries(objects).map(([path, keys]) => `  ${path}: [${keys.join(', ')}]`).join('\n') +
      `\n  event: ${payload.event || payload.data?.event || 'n/a'}` +
      `\n  statusField: ${statusField}` +
      `\n  idLikeFields:\n${idFields.map((f) => `    ${f}`).join('\n') || '    none'}`
    );
  } catch (err) {
    console.warn('Kashier structure diagnostic failed:', err.message);
  }
};

// paymentStatus is a nullable string column; NULL must count as "not paid".
const NOT_PAID = { OR: [{ paymentStatus: null }, { paymentStatus: { not: 'PAID' } }] };

const REFERENCE_FIELDS = [
  ['paymentTransactionId', 'transactionId'],
  ['paymentProviderOrderId', 'providerOrderId'],
];

// For an order that is already PAID: fill references that are still empty, never replace stored ones.
const captureReferencesForPaidOrder = async (tx, id, references) => {
  const current = await tx.order.findUnique({
    where: { id },
    select: { paymentStatus: true, paymentTransactionId: true, paymentProviderOrderId: true },
  });
  if (!current || current.paymentStatus !== 'PAID') return [];

  const data = {};
  const conflicts = [];
  for (const [field, key] of REFERENCE_FIELDS) {
    const incoming = references[key];
    if (!incoming) continue;
    if (!current[field]) data[field] = incoming;
    else if (current[field] !== incoming) conflicts.push({ field, stored: current[field], incoming });
  }

  const fields = Object.keys(data);
  if (fields.length > 0) {
    await tx.order.updateMany({
      where: { id, paymentStatus: 'PAID', ...Object.fromEntries(fields.map((f) => [f, null])) },
      data,
    });
  }
  return conflicts.map((conflict) => ({ id, ...conflict }));
};

// Every transition below is a conditional UPDATE evaluated against the row's current state,
// so duplicate webhooks or a cancellation racing the webhook cannot be overwritten.
// References and paidAt are written only by the transition to PAID, so duplicates leave them as is.
export const markKashierOrdersPaid = async (orderIds, references, notes = 'Kashier payment successful') => {
  const existing = await prisma.order.count({ where: { id: { in: orderIds } } });
  if (existing === 0) {
    console.error(`❌ Orders ${orderIds.join(', ')} not found in DB.`);
    return { updated: 0, confirmedIds: [], paidIds: [], lateAfterCancellation: [], referenceConflicts: [] };
  }

  const paidData = {
    paymentStatus: 'PAID',
    paymentTransactionId: references.transactionId,
    paymentProviderOrderId: references.providerOrderId,
    paidAt: new Date(),
  };

  return prisma.$transaction(async (tx) => {
    let updated = 0;
    const confirmedIds = [];
    // Active orders that transitioned to PAID in this call (confirmed now or already past PENDING).
    const paidIds = [];
    const lateAfterCancellation = [];
    const referenceConflicts = [];

    for (const id of orderIds) {
      const confirmed = await tx.order.updateMany({
        where: { id, status: 'PENDING', ...NOT_PAID },
        data: { ...paidData, status: 'CONFIRMED' },
      });
      if (confirmed.count > 0) {
        await tx.orderStatusHistory.create({ data: { orderId: id, status: 'CONFIRMED', notes } });
        confirmedIds.push(id);
        paidIds.push(id);
        updated++;
        continue;
      }

      const active = await tx.order.updateMany({
        where: { id, status: { notIn: ['PENDING', 'CANCELLED'] }, ...NOT_PAID },
        data: paidData,
      });
      if (active.count > 0) {
        const { status } = await tx.order.findUnique({ where: { id }, select: { status: true } });
        await tx.orderStatusHistory.create({ data: { orderId: id, status, notes } });
        paidIds.push(id);
        updated++;
        continue;
      }

      // Cancelled before the payment was confirmed: its stock was already restored, so it must
      // stay cancelled. The captured payment is recorded for a manual refund (no auto refund yet).
      const late = await tx.order.updateMany({
        where: { id, status: 'CANCELLED', ...NOT_PAID },
        data: paidData,
      });
      if (late.count > 0) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            status: 'CANCELLED',
            notes: 'Kashier payment succeeded after the order was cancelled. Order kept cancelled, stock not re-reserved. Manual refund required.',
          },
        });
        lateAfterCancellation.push(id);
        continue;
      }

      referenceConflicts.push(...await captureReferencesForPaidOrder(tx, id, references));
    }

    if (paidIds.length > 0) {
      const paidOrders = await tx.order.findMany({
        where: { id: { in: paidIds } },
        select: {
          userId: true,
          createdAt: true,
          items: { select: { productId: true, variantId: true, quantity: true } },
        },
      });

      for (const order of paidOrders) {
        for (const item of order.items) {
          const cartItem = await tx.cartItem.findFirst({
            where: {
              userId: order.userId,
              productId: item.productId,
              variantId: item.variantId,
              createdAt: { lte: order.createdAt },
            },
          });

          if (!cartItem) continue;
          if (cartItem.quantity <= item.quantity) {
            await tx.cartItem.delete({ where: { id: cartItem.id } });
          } else {
            await tx.cartItem.update({
              where: { id: cartItem.id },
              data: { quantity: { decrement: item.quantity } },
            });
          }
        }
      }
    }

    return { updated, confirmedIds, paidIds, lateAfterCancellation, referenceConflicts };
  });
};

export const markKashierOrdersFailed = async (orderIds, notes) => prisma.$transaction(async (tx) => {
  let updated = 0;
  const cancelledIds = [];

  for (const id of orderIds) {
    const cancelled = await tx.order.updateMany({
      where: { id, status: { not: 'CANCELLED' }, ...NOT_PAID },
      data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
    });
    if (cancelled.count > 0) {
      await restoreOrderStock(tx, id);
      await tx.orderStatusHistory.create({ data: { orderId: id, status: 'CANCELLED', notes } });
      cancelledIds.push(id);
      updated++;
      continue;
    }

    // Already cancelled (stock was restored at that point): only record the failed payment, once.
    const marked = await tx.order.updateMany({
      where: {
        id,
        status: 'CANCELLED',
        OR: [{ paymentStatus: null }, { paymentStatus: { notIn: ['PAID', 'FAILED'] } }],
      },
      data: { paymentStatus: 'FAILED' },
    });
    if (marked.count > 0) {
      await tx.orderStatusHistory.create({ data: { orderId: id, status: 'CANCELLED', notes } });
      updated++;
    }
  }

  return { updated, cancelledIds };
});

// Runs after the payment transaction has committed; notify helpers never throw.
const notifyKashierOutcome = async (orderIds, outcome) => {
  if (orderIds.length === 0) return;
  try {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, userId: true, vendorId: true },
    });
    for (const order of orders) {
      const ref = shortId(order.id);
      if (outcome === 'PAID') {
        await notifyCustomerOrderStatus(order.userId, order.id, 'CONFIRMED', {
          en: 'Your payment was received successfully.',
          ar: 'تم استلام الدفع بنجاح.',
        });
        await notifyVendorOrderStatus(order.vendorId, order.id, 'CONFIRMED', {
          en: `Payment for order #${ref} was confirmed. You can start preparing it.`,
          ar: `تم تأكيد الدفع للطلب رقم #${ref}. تقدر تبدأ تجهيزه.`,
        });
      } else {
        await notifyCustomerOrderStatus(order.userId, order.id, 'CANCELLED', {
          en: 'The payment failed, so the order was cancelled.',
          ar: 'عملية الدفع فشلت، فتم إلغاء الطلب.',
        });
        await notifyVendorOrderStatus(order.vendorId, order.id, 'CANCELLED', {
          en: `Order #${ref} was cancelled because the payment failed.`,
          ar: `الطلب رقم #${ref} اتلغى بسبب فشل الدفع.`,
        });
      }
    }
  } catch (err) {
    console.error('Failed to dispatch Kashier payment notifications:', err.message);
  }
};

const persistReadyPaymentSession = async (attemptId, session) => {
  await prisma.checkoutAttempt.update({
    where: { id: attemptId },
    data: {
      providerSessionId: session.sessionId,
      providerSessionUrl: session.sessionUrl,
      providerStatus: session.status || 'READY',
    },
  });
  // A fast webhook may already have moved the attempt to PAID. Never regress it to PAYMENT_READY.
  await prisma.checkoutAttempt.updateMany({
    where: { id: attemptId, status: { in: ['ORDERS_CREATED', 'PAYMENT_INITIATING', 'PAYMENT_FAILED'] } },
    data: { status: 'PAYMENT_READY' },
  });
  return prisma.checkoutAttempt.findUnique({
    where: { id: attemptId },
    include: { user: { select: { email: true } }, orders: { orderBy: { createdAt: 'asc' } } },
  });
};

/**
 * Initiates a payment by creating a Kashier Session.
 * POST /api/payment/initiate
 */
export const initiatePayment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { checkoutAttemptId, amount } = req.body;
    if (!checkoutAttemptId) {
      return res.status(400).json({ 
        success: false, 
        message: 'checkoutAttemptId is required'
      });
    }

    let attempt = await prisma.checkoutAttempt.findFirst({
      where: { id: checkoutAttemptId, userId },
      include: {
        user: { select: { email: true } },
        orders: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Checkout attempt was not found',
      });
    }
    if (attempt.paymentMethod !== 'KASHIER' || attempt.orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Checkout attempt is not eligible for online payment',
      });
    }

    const formatReadyResponse = (current) => ({
      success: true,
      sessionUrl: current.providerSessionUrl,
      checkoutAttemptId: current.id,
      orderIds: current.orders.map((order) => order.id),
      amount: Number(current.orders.reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(2)),
      paymentStatus: current.status,
    });

    if (attempt.status === 'PAYMENT_READY' && attempt.providerSessionUrl) {
      return res.status(200).json(formatReadyResponse(attempt));
    }
    if (attempt.status === 'PAID' || attempt.orders.every((order) => order.paymentStatus === 'PAID')) {
      return res.status(200).json({
        success: true,
        checkoutAttemptId: attempt.id,
        orderIds: attempt.orders.map((order) => order.id),
        paymentStatus: 'PAID',
      });
    }
    if (attempt.status === 'CANCELLED' || attempt.orders.some((order) => order.status === 'CANCELLED')) {
      return res.status(409).json({ success: false, code: 'CHECKOUT_CANCELLED', message: 'Checkout is no longer payable' });
    }

    if (!attempt.expiresAt) {
      const fallbackExpiry = calculateCheckoutExpiresAt();
      await prisma.checkoutAttempt.updateMany({
        where: { id: attempt.id, expiresAt: null },
        data: { expiresAt: fallbackExpiry },
      });
      attempt = await prisma.checkoutAttempt.findUnique({
        where: { id: attempt.id },
        include: { user: { select: { email: true } }, orders: { orderBy: { createdAt: 'asc' } } },
      });
    }

    const serverAmount = attempt.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const clientAmount = parseFloat(amount);
    if (!Number.isNaN(clientAmount) && Math.abs(serverAmount - clientAmount) > 0.01) {
      console.warn(`Kashier amount mismatch. client=${clientAmount} server=${serverAmount}`);
    }

    const now = new Date();
    let ownsInitiation = (await prisma.checkoutAttempt.updateMany({
      where: { id: attempt.id, status: { in: ['ORDERS_CREATED', 'PAYMENT_FAILED'] } },
      data: { status: 'PAYMENT_INITIATING', paymentInitiationStartedAt: now, providerStatus: 'INITIATING' },
    })).count === 1;

    if (!ownsInitiation) {
      attempt = await prisma.checkoutAttempt.findUnique({
        where: { id: attempt.id },
        include: { user: { select: { email: true } }, orders: { orderBy: { createdAt: 'asc' } } },
      });
      if (attempt?.status === 'PAYMENT_READY' && attempt.providerSessionUrl) {
        return res.status(200).json(formatReadyResponse(attempt));
      }

      // The first create may have succeeded even if its HTTP response was lost. Always reconcile
      // by the stable merchant reference before considering another provider request.
      try {
        const recovered = await kashierService.findPaymentSessionByReference(attempt.providerReference);
        if (recovered?.sessionUrl) {
          attempt = await persistReadyPaymentSession(attempt.id, { ...recovered, status: recovered.status || 'RECOVERED' });
          return res.status(200).json(formatReadyResponse(attempt));
        }
      } catch (reconcileError) {
        console.warn('Kashier reconciliation unavailable:', reconcileError.message);
      }

      const staleBefore = new Date(Date.now() - 60_000);
      ownsInitiation = (await prisma.checkoutAttempt.updateMany({
        where: {
          id: attempt.id,
          status: 'PAYMENT_INITIATING',
          paymentInitiationStartedAt: { lte: staleBefore },
        },
        data: { paymentInitiationStartedAt: new Date(), providerStatus: 'RETRYING_AFTER_RECONCILIATION' },
      })).count === 1;

      if (!ownsInitiation) {
        return res.status(409).json({
          success: false,
          code: 'PAYMENT_INITIATION_PENDING',
          recoverable: true,
          message: 'Payment initialization is still being confirmed. Retry shortly with the same checkout.',
        });
      }
    }

    const email = attempt.user?.email || 'customer@goknary.com';
    let session;
    try {
      session = await kashierService.createPaymentSession(
        attempt.providerReference,
        serverAmount,
        email,
        'EGP',
        attempt.orders.map((order) => order.id),
        attempt.expiresAt,
      );
    } catch (providerError) {
      try {
        const recovered = await kashierService.findPaymentSessionByReference(attempt.providerReference);
        if (recovered?.sessionUrl) {
          attempt = await persistReadyPaymentSession(attempt.id, { ...recovered, status: recovered.status || 'RECOVERED' });
          return res.status(200).json(formatReadyResponse(attempt));
        }
      } catch (reconcileError) {
        console.warn('Kashier reconciliation after create failure unavailable:', reconcileError.message);
      }

      if (providerError.ambiguous) {
        return res.status(202).json({
          success: false,
          code: 'PAYMENT_PROVIDER_RESULT_UNKNOWN',
          recoverable: true,
          message: 'Payment initialization is being reconciled. Retry with the same checkout.',
        });
      }

      await prisma.checkoutAttempt.updateMany({
        where: { id: attempt.id, status: 'PAYMENT_INITIATING' },
        data: { status: 'PAYMENT_FAILED', providerStatus: providerError.providerCode || 'CONFIRMED_FAILURE' },
      });
      return res.status(502).json({
        success: false,
        code: 'PAYMENT_INITIATION_FAILED',
        recoverable: true,
        message: 'Payment provider rejected the session request. Retry uses the same checkout.',
      });
    }

    // Persist outside the provider-error catch. If persistence fails after Kashier succeeded,
    // the attempt remains PAYMENT_INITIATING and the next retry reconciles by the stable reference.
    attempt = await persistReadyPaymentSession(attempt.id, session);
    return res.status(200).json(formatReadyResponse(attempt));

  } catch (error) {
    console.error('Payment Initiation Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to initiate payment'
    });
  }
};

/**
 * Handles incoming webhooks from Kashier to update order status.
 * POST /api/payment/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    // Kashier sends signature in one of these headers depending on integration mode.
    const signature = getKashierSignature(req.headers);
    const payload = req.body;

    // 1. Verify the signature via Service
    const isValid = kashierService.verifyWebhookSignature(req.rawBody || payload, signature);

    if (!isValid) {
      console.error('❌ Kashier Webhook: Invalid Signature detected.');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    await logVerifiedKashierStructure(payload);

    const { orderIds, checkoutAttemptId } = await resolveKashierCheckout(payload);
    const { isSuccess, isFailure, status, event } = getKashierOutcome(payload);

    console.log(`🔔 Kashier Webhook received. Event: ${event || 'payment_update'} Status: ${status || 'n/a'}`);

    if (orderIds.length === 0) {
      console.error('❌ Kashier Webhook: Missing orderId in payload.');
      return res.status(200).send('OK');
    }

    if (isSuccess) {
      const references = extractKashierPaymentReferences(payload);
      console.log(
        `✅ SUCCESS: Orders ${orderIds.join(', ')} have been PAID. ` +
        `transactionId=${references.transactionId || 'n/a'} kashierOrderId=${references.providerOrderId || 'n/a'}`
      );
      if (!references.transactionId) {
        // Field names only (no values), to confirm the real payload shape for refunds.
        console.warn(`⚠️ Kashier success webhook has no transaction id. Payload fields: ${Object.keys(payload.data || payload).join(', ')}`);
      }
      try {
        const result = checkoutAttemptId
          ? await markCheckoutPaid({
              attemptId: checkoutAttemptId,
              orderIds,
              references,
              providerStatus: status || event || 'PAID',
              notes: 'Kashier payment successful',
            })
          : await markKashierOrdersPaid(orderIds, references);
        const { confirmedIds, paidIds, lateAfterCancellation, referenceConflicts } = result;
        console.log(`✅ Orders ${orderIds.join(', ')} paymentStatus updated to PAID.`);
        // CheckoutAttempt payments dispatch post-commit effects in the central lifecycle service.
        if (!checkoutAttemptId) void trackPurchasesForOrders(paidIds);
        for (const conflict of referenceConflicts) {
          console.warn(
            `⚠️ Kashier webhook for already-paid order ${conflict.id} carries a different ${conflict.field} ` +
            `(stored=${conflict.stored} incoming=${conflict.incoming}). Stored reference kept; review manually.`
          );
        }
        if (!checkoutAttemptId) await notifyKashierOutcome(confirmedIds, 'PAID');
        if (lateAfterCancellation.length > 0) {
          console.warn(
            `⚠️ Late Kashier payment success received for cancelled orders ${lateAfterCancellation.join(', ')}. ` +
            `Current status: CANCELLED. Event: ${event || status || 'n/a'}. Orders kept cancelled; manual refund required.`
          );
        }
      } catch (dbError) {
        console.error(`❌ DB error updating paid orders ${orderIds.join(', ')}:`, dbError.message);
      }
    } else if (isFailure) {
      console.log(`❌ FAILED: Orders ${orderIds.join(', ')} payment failed with status: ${status || event}`);
      try {
        if (checkoutAttemptId) {
          await cancelCheckoutAttempt({
            attemptId: checkoutAttemptId,
            requireExpired: false,
            providerStatus: status || event || 'FAILED',
            reason: `Kashier payment failed: ${status || event || 'unknown'}`,
          });
        } else {
          const { cancelledIds } = await markKashierOrdersFailed(orderIds, `Kashier payment failed: ${status || event || 'unknown'}`);
          await notifyKashierOutcome(cancelledIds, 'FAILED');
        }
      } catch (dbError) {
        console.error(`❌ DB error marking failed payment for orders ${orderIds.join(', ')}:`, dbError.message);
      }
    } else {
      console.log(`ℹ️ INFO: Orders ${orderIds.join(', ')} webhook ignored. status=${status || 'n/a'} event=${event || 'n/a'}`);
    }

    // 4. Respond quickly with 200 OK
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Handling Error:', error.message);
    return res.status(500).send('Webhook Error');
  }
};
