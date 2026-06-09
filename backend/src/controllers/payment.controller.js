import kashierService from '../services/kashier.service.js';
import { prisma } from '../lib/prisma.js';

/**
 * PaymentController
 * Extracted request data and delegates business logic to KashierService.
 */

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
    // Kashier sends signature in the headers (x-kashier-signature)
    const signature = req.headers['x-kashier-signature'];
    const payload = req.body;

    // 1. Verify the signature via Service
    const isValid = kashierService.verifyWebhookSignature(req.rawBody || payload, signature);

    if (!isValid) {
      console.error('❌ Kashier Webhook: Invalid Signature detected.');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // 2. Extract payment status and order ID
    // Note: Payload structure varies based on event, adjusting for common 'payment_success'
    const event = payload.event;
    const orderData = payload.data || payload; // Fallback to root if not nested

    console.log(`🔔 Kashier Webhook received. Event: ${event || 'payment_update'}`);

    // 3. Perform DB update logic
    const orderReference = orderData.orderId || orderData.merchantOrderId || orderData.order || payload.orderId;
    const orderIdsFromMetadata = orderData.metadata?.orderIds || payload.metadata?.orderIds;
    const orderIds = Array.isArray(orderIdsFromMetadata)
      ? orderIdsFromMetadata
      : String(orderReference || '').split('__').filter(Boolean);
    const status = orderData.status;

    const normalizedStatus = status ? String(status).toLowerCase() : '';
    const isSuccess =
      ['success', 'completed', 'paid'].includes(normalizedStatus) ||
      (event && ['pay_conf', 'transaction.completed', 'payment.success'].includes(event));
    const isFailure =
      ['failed', 'declined', 'cancelled', 'canceled', 'expired'].includes(normalizedStatus) ||
      (event && ['payment.failed', 'transaction.failed'].includes(event));

    if (orderIds.length === 0) {
      console.error('❌ Kashier Webhook: Missing orderId in payload.');
      return res.status(200).send('OK');
    }

    if (isSuccess) {
      console.log(`✅ SUCCESS: Orders ${orderIds.join(', ')} have been PAID.`);
      try {
        const orders = await prisma.order.findMany({
          where: { id: { in: orderIds } },
          include: { items: true },
        });
        if (orders.length === 0) {
          console.error(`❌ Orders ${orderIds.join(', ')} not found in DB.`);
          return res.status(200).send('OK');
        }

        const unpaidOrders = orders.filter((order) => order.paymentStatus !== 'PAID');
        if (unpaidOrders.length === 0) {
          console.log(`ℹ️ Orders ${orderIds.join(', ')} are already marked as PAID.`);
          return res.status(200).send('OK');
        }

        await prisma.$transaction(async (tx) => {
          await tx.order.updateMany({
            where: { id: { in: unpaidOrders.map((order) => order.id) } },
            data: {
              paymentStatus: 'PAID',
            },
          });

          for (const order of unpaidOrders) {
            const finalStatus = order.status === 'PENDING' ? 'CONFIRMED' : order.status;
            await tx.order.update({
              where: { id: order.id },
              data: { status: finalStatus },
            });

            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                status: finalStatus,
                notes: 'Kashier payment successful',
              },
            });
          }
        });

        console.log(`✅ Orders ${orderIds.join(', ')} paymentStatus updated to PAID.`);
      } catch (dbError) {
        console.error(`❌ DB error updating paid orders ${orderIds.join(', ')}:`, dbError.message);
      }
    } else if (isFailure) {
      console.log(`❌ FAILED: Orders ${orderIds.join(', ')} payment failed with status: ${status || event}`);
      try {
        const orders = await prisma.order.findMany({ where: { id: { in: orderIds } } });
        const unpaidIds = orders
          .filter((order) => order.paymentStatus !== 'PAID')
          .map((order) => order.id);

        if (unpaidIds.length > 0) {
          await prisma.$transaction(async (tx) => {
            for (const order of orders.filter((item) => unpaidIds.includes(item.id))) {
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
                  notes: `Kashier payment failed: ${status || event || 'unknown'}`,
                },
              });
            }
          });
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
