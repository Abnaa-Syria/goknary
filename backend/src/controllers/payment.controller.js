import kashierService from '../services/kashier.service.js';
import { prisma } from '../lib/prisma.js';

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

const extractKashierOrderIds = (payload) => {
  const orderData = payload.data || payload;
  const orderReference =
    orderData.orderId ||
    orderData.merchantOrderId ||
    orderData.merchantOrderID ||
    orderData.order ||
    payload.orderId ||
    payload.merchantOrderId ||
    payload.merchantOrderID;

  const orderIdsFromMetadata = orderData.metadata?.orderIds || payload.metadata?.orderIds;
  return Array.isArray(orderIdsFromMetadata)
    ? orderIdsFromMetadata.filter(Boolean)
    : String(orderReference || '').split('__').filter(Boolean);
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

const markKashierOrdersPaid = async (orderIds, notes = 'Kashier payment successful') => {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: true },
  });

  if (orders.length === 0) {
    console.error(`❌ Orders ${orderIds.join(', ')} not found in DB.`);
    return { updated: 0 };
  }

  const unpaidOrders = orders.filter((order) => order.paymentStatus !== 'PAID');
  if (unpaidOrders.length === 0) {
    console.log(`ℹ️ Orders ${orderIds.join(', ')} are already marked as PAID.`);
    return { updated: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const order of unpaidOrders) {
      const finalStatus = ['PENDING', 'CANCELLED'].includes(order.status) ? 'CONFIRMED' : order.status;
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: finalStatus,
          paymentStatus: 'PAID',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: finalStatus,
          notes,
        },
      });
    }
  });

  return { updated: unpaidOrders.length };
};

const markKashierOrdersFailed = async (orderIds, notes) => {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: true },
  });
  const unpaidOrders = orders.filter((order) => order.paymentStatus !== 'PAID');

  if (unpaidOrders.length === 0) {
    return { updated: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const order of unpaidOrders) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
        },
      });

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'CANCELLED',
          notes,
        },
      });
    }
  });

  return { updated: unpaidOrders.length };
};

/**
 * Initiates a payment by creating a Kashier Session.
 * POST /api/payment/initiate
 */
export const initiatePayment = async (req, res) => {
  try {
    const { orderId, orderIds, amount, customerEmail, currency } = req.body;
    const ids = Array.isArray(orderIds)
      ? orderIds.filter(Boolean)
      : [orderId].filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'orderId or orderIds are required' 
      });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      include: { user: { select: { email: true } } },
    });

    if (orders.length !== ids.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more orders were not found',
      });
    }

    const payableOrders = orders.filter((order) => order.paymentStatus !== 'PAID');
    if (payableOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Orders are already paid',
      });
    }

    const serverAmount = payableOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const clientAmount = parseFloat(amount);
    if (!Number.isNaN(clientAmount) && Math.abs(serverAmount - clientAmount) > 0.01) {
      console.warn(`Kashier amount mismatch. client=${clientAmount} server=${serverAmount}`);
    }

    const orderReference = payableOrders.map((order) => order.id).join('__');
    const email = payableOrders[0]?.user?.email || customerEmail || 'customer@goknary.com';

    const sessionUrl = await kashierService.createPaymentSession(
      orderReference,
      serverAmount,
      email,
      currency || 'EGP',
      payableOrders.map((order) => order.id)
    );

    return res.status(200).json({
      success: true,
      sessionUrl,
      orderReference,
      orderIds: payableOrders.map((order) => order.id),
      amount: Number(serverAmount.toFixed(2)),
    });
  } catch (error) {
    console.error('Payment Initiation Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
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

    const orderIds = extractKashierOrderIds(payload);
    const { isSuccess, isFailure, status, event } = getKashierOutcome(payload);

    console.log(`🔔 Kashier Webhook received. Event: ${event || 'payment_update'} Status: ${status || 'n/a'}`);

    if (orderIds.length === 0) {
      console.error('❌ Kashier Webhook: Missing orderId in payload.');
      return res.status(200).send('OK');
    }

    if (isSuccess) {
      console.log(`✅ SUCCESS: Orders ${orderIds.join(', ')} have been PAID.`);
      try {
        await markKashierOrdersPaid(orderIds);
        console.log(`✅ Orders ${orderIds.join(', ')} paymentStatus updated to PAID.`);
      } catch (dbError) {
        console.error(`❌ DB error updating paid orders ${orderIds.join(', ')}:`, dbError.message);
      }
    } else if (isFailure) {
      console.log(`❌ FAILED: Orders ${orderIds.join(', ')} payment failed with status: ${status || event}`);
      try {
        await markKashierOrdersFailed(orderIds, `Kashier payment failed: ${status || event || 'unknown'}`);
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
