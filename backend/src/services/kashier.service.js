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
async createPaymentSession(orderId, amount, customerEmail, currency = 'EGP') {
    try {
      // 1. تظبيط اللينك بشكل صحيح عشان لو الـ env مش موجود ياخد اللوكال هوست
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${baseUrl}/payment-success?order_id=${orderId}`;
      
      const expireAt = new Date();
      expireAt.setHours(expireAt.getHours() + 24);

      const payload = {
        merchantId: this.merchantId,
        amount: String(parseFloat(amount).toFixed(2)),
        currency: currency,
        order: String(orderId),
        expireAt: expireAt.toISOString(),
        maxFailureAttempts: 3,
        paymentType: "credit",
        display: "en",
        type: "one-time",
        customer: {
          email: customerEmail,
          reference: String(orderId)
        },
        merchantRedirect: redirectUrl, // اللينك هيتبعت هنا سليم
        serverWebhook: process.env.KASHIER_WEBHOOK_URL,
        interactionSource: "ECOMMERCE",
        brandColor: "#004aad",
        defaultMethod: "card"
      };

      console.log('🚀 Creating Kashier V3 Session for Order:', orderId);
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

    const computedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(dataToSign)
      .digest('hex');

    return computedSignature === signatureHeader;
  }
}

export default new KashierService();
