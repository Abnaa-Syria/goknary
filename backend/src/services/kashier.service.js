import crypto from 'crypto';
import axios from 'axios';

/**
 * KashierService (V3 API Implementation)
 * Handles Session API calls according to Kashier V3 documentation.
 */
class KashierService {
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

async createPaymentSession(orderReference, amount, customerEmail, currency = 'EGP', orderIds = []) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectBase = process.env.KASHIER_REDIRECT_URL || `${baseUrl}/payment-success`;
      const query = orderIds.length > 0
        ? `order_ids=${encodeURIComponent(orderIds.join(','))}&method=kashier`
        : `order_id=${encodeURIComponent(orderReference)}&method=kashier`;
      const redirectUrl = `${redirectBase}${redirectBase.includes('?') ? '&' : '?'}${query}`;
      
      const expireAt = new Date();
      expireAt.setHours(expireAt.getHours() + 24);

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
        headers: {
          'Authorization': this.secretKey,
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      const sessionUrl = response.data?.sessionUrl;
      
      if (!sessionUrl) {
        console.error('Kashier V3 Response:', response.data);
        throw new Error('Session URL not found in Kashier V3 response');
      }

      return sessionUrl;
    } catch (error) {
      console.error('Kashier V3 Session Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to initiate Kashier V3 session');
    }
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
