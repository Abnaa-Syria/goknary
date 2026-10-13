import crypto from 'crypto';
import axios from 'axios';
import { calculateCheckoutExpiresAt } from '../lib/checkout-expiry-config.js';

/**
 * KashierService (V3 API Implementation)
 * Handles Session API calls according to Kashier V3 documentation.
 */
export class KashierService {
  constructor() {
    this.merchantId = process.env.KASHIER_MERCHANT_ID;
    this.apiKey = process.env.KASHIER_PAYMENT_API_KEY;
    this.secretKey = process.env.KASHIER_SECRET_KEY;
    
    // V3 Endpoints
    this.testUrl = 'https://test-api.kashier.io/v3/payment/sessions';
    this.liveUrl = 'https://api.kashier.io/v3/payment/sessions';
    
    // Determine environment (Kashier V3 uses different domains for test/live)
    // Check if KASHIER_MODE is explicitly set to 'live' or 'test'. Otherwise, auto-detect from merchantId
    const mode = process.env.KASHIER_MODE || (this.merchantId?.includes('TEST') ? 'test' : 'live');
    const isTest = mode === 'test';
    this.baseUrl = isTest ? this.testUrl : this.liveUrl;
    
    console.log(`ℹ️ Kashier Service initialized in ${mode.toUpperCase()} mode. Base URL: ${this.baseUrl}`);
  }

  /**
   * Calls Kashier V3 Session API to create a payment session.
   * Returns the sessionUrl for redirection.
   */
  generateOrderHash(orderId, amount, currency = 'EGP', customerReference = '') {
    const path = `/?payment=${this.merchantId}.${orderId}.${String(parseFloat(amount).toFixed(2))}.${currency}${customerReference ? `.${customerReference}` : ''}`;
    return crypto.createHmac('sha256', this.apiKey).update(path).digest('hex');
  }

  get headers() {
    return {
      'Authorization': this.secretKey,
      'api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /** @param {Date|string|null} checkoutExpiresAt */
async createPaymentSession(orderReference, amount, customerEmail, currency = 'EGP', orderIds = [], checkoutExpiresAt = null) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectBase = process.env.KASHIER_REDIRECT_URL || `${baseUrl}/payment-success`;
      const query = orderIds.length > 0
        ? `order_ids=${encodeURIComponent(orderIds.join(','))}&method=kashier`
        : `order_id=${encodeURIComponent(orderReference)}&method=kashier`;
      const redirectUrl = `${redirectBase}${redirectBase.includes('?') ? '&' : '?'}${query}`;
      
      const expireAt = checkoutExpiresAt ? new Date(checkoutExpiresAt) : calculateCheckoutExpiresAt();
      if (Number.isNaN(expireAt.getTime())) throw new Error('Invalid checkout expiration timestamp');

      const normalizedAmount = String(parseFloat(amount).toFixed(2));
      this.generateOrderHash(orderReference, normalizedAmount, currency, orderReference);

      const payload = {
        merchantId: this.merchantId,
        amount: normalizedAmount,
        currency: currency,
        order: String(orderReference),
        expireAt: expireAt.toISOString(),
        maxFailureAttempts: 3,
        paymentType: "credit",
        display: "en",
        type: "one-time",
        customer: {
          email: customerEmail,
          reference: String(orderReference)
        },
        merchantRedirect: redirectUrl,
        serverWebhook: process.env.KASHIER_WEBHOOK_URL,
        interactionSource: "ECOMMERCE",
        brandColor: "#004aad",
        defaultMethod: "card"
      };

      console.log('🚀 Creating Kashier V3 Session for Order Reference:', orderReference);
      console.log('🚀 Kashier V3 Redirect URL:', redirectUrl);

      // شيلت الـ console.log(response) من هنا عشان كانت هتعمل Crash

      const response = await axios.post(this.baseUrl, payload, {
        headers: this.headers
      });

      const sessionUrl = response.data?.sessionUrl;
      
      if (!sessionUrl) {
        console.error('Kashier V3 Response:', response.data);
        throw new Error('Session URL not found in Kashier V3 response');
      }

      return {
        sessionId: response.data?._id || response.data?.id || null,
        sessionUrl,
        status: response.data?.status || 'CREATED',
        expiresAt: expireAt,
      };
    } catch (error) {
      console.error('Kashier V3 Session Error:', error.response?.data || error.message);
      const wrapped = new Error(error.response?.data?.message || 'Failed to initiate Kashier V3 session');
      wrapped.statusCode = error.response?.status || null;
      wrapped.providerCode = error.response?.data?.code || error.response?.data?.errorCode || null;
      // A timeout/no response, 5xx, or duplicate-reference response can all mean that Kashier
      // created the session but our response was lost. These outcomes must be reconciled, not retried blindly.
      wrapped.ambiguous = !error.response || error.response.status >= 500 || wrapped.providerCode === 'ERR_ORD_02';
      throw wrapped;
    }
  }

  async getPaymentSession(sessionId) {
    const response = await axios.get(`${this.baseUrl}/${encodeURIComponent(sessionId)}/payment`, {
      headers: this.headers,
    });
    const data = response.data?.data || response.data;
    return {
      sessionId: data?.sessionId || data?._id || data?.id || sessionId,
      sessionUrl: data?.sessionUrl || data?.url || null,
      status: data?.status || null,
      merchantOrderId: data?.merchantOrderId || data?.orderReference || null,
      transactionId: data?.transactionId || null,
      providerOrderId: data?.orderId && data.orderId !== 'NA' ? data.orderId : null,
    };
  }

  /** Provider reconciliation endpoint: exact-match our stable merchant order reference. */
  async findPaymentOrderByReference(orderReference) {
    const ordersUrl = this.baseUrl.replace('/payment/sessions', '/payment/orders');
    const response = await axios.get(ordersUrl, {
      headers: this.headers,
      params: { search: orderReference, limit: 20 },
    });
    const body = response.data?.data || response.data;
    const rows = Array.isArray(body) ? body : (body?.orders || body?.docs || body?.data || []);
    const match = rows.find((row) => (
      String(row?.merchantOrderId || row?.orderReference || row?.order || '') === String(orderReference)
    ));
    if (!match) return null;
    const successfulTransaction = (match.transactions || []).find((transaction) => (
      String(transaction?.status || '').toUpperCase() === 'SUCCESS' &&
      ['APPROVED', 'CAPTURED', 'SUCCESS'].includes(String(transaction?.transactionResponseCode || '').toUpperCase())
    ));
    return {
      status: match.status || null,
      merchantOrderId: match.merchantOrderId || match.orderReference || null,
      providerOrderId: match.orderId || match.kashierOrderId || null,
      transactionId: successfulTransaction?.transactionId || successfulTransaction?.transactionInfoId || match.transactionId || null,
      sessionId: match.sessionId || match.paymentSessionId || match.session?._id || null,
      sessionUrl: match.sessionUrl || match.session?.sessionUrl || null,
      transactions: Array.isArray(match.transactions) ? match.transactions : [],
    };
  }

  /** Recover a session after an ambiguous create response using the stable merchant reference. */
  async findPaymentSessionByReference(orderReference) {
    const order = await this.findPaymentOrderByReference(orderReference);
    if (!order) return null;
    if (!order.sessionId) return order;
    const session = await this.getPaymentSession(order.sessionId);
    return {
      ...order,
      ...session,
      status: order.status || session.status,
      transactionId: order.transactionId || session.transactionId,
      providerOrderId: order.providerOrderId || session.providerOrderId,
    };
  }

  /**
   * Verifies the webhook signature using the Secret Key.
   * Note: V3 might use a different signature algorithm, but HMAC SHA256 is standard.
   */
  verifyWebhookSignature(reqBody, signatureHeader) {
    if (!signatureHeader || !reqBody) return false;

    const dataToSign = Buffer.isBuffer(reqBody) 
      ? reqBody 
      : (typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody));

    const signatures = Array.isArray(signatureHeader) ? signatureHeader : [signatureHeader];
    const keys = [this.apiKey, this.secretKey].filter(Boolean);

    return keys.some((key) => {
      const computedSignature = crypto
        .createHmac('sha256', key)
        .update(dataToSign)
        .digest('hex');

      return signatures.some((signature) => {
        const normalized = String(signature || '').replace(/^sha256=/i, '').trim();
        return computedSignature === normalized;
      });
    });
  }
}

export default new KashierService();
