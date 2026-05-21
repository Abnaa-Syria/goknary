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
    const { orderId, amount, customerEmail, currency } = req.body;

    // 1. Validate required data
    if (!orderId || !amount || !customerEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'orderId, amount, and customerEmail are required' 
      });
    }

    // 2. Call service to get session URL
    const sessionUrl = await kashierService.createPaymentSession(
      orderId,
      amount,
      customerEmail,
      currency || 'EGP'
    );

    // 3. Return sessionUrl to frontend for redirection
    return res.status(200).json({
      success: true,
      sessionUrl
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
    const orderId = orderData.orderId || orderData.merchantOrderId;
    const status = orderData.status;

    if (status === 'SUCCESS' || event === 'pay_conf') {
      console.log(`✅ SUCCESS: Order ${orderId} has been PAID.`);
      try {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'CONFIRMED',
              statusHistory: {
                create: {
                  status: 'CONFIRMED',
                  notes: `Kashier payment successful. Signature: ${signature || 'N/A'}`
                }
              }
            }
          });
          console.log(`✅ Order ${orderId} status successfully updated to CONFIRMED.`);
        } else {
          console.error(`❌ Order ${orderId} not found in DB.`);
        }
      } catch (dbError) {
        console.error(`❌ DB error updating order ${orderId}:`, dbError.message);
      }
    } else {
      console.log(`ℹ️ INFO: Order ${orderId} status updated to: ${status}`);
    }

    // 4. Respond quickly with 200 OK
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Handling Error:', error.message);
    return res.status(500).send('Webhook Error');
  }
};
