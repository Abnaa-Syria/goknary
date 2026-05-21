import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const testUrl = 'https://test-api.kashier.io/v3/payment/sessions';
const liveUrl = 'https://api.kashier.io/v3/payment/sessions';

const merchantId = process.env.KASHIER_MERCHANT_ID;
const apiKey = process.env.KASHIER_PAYMENT_API_KEY;
const secretKey = process.env.KASHIER_SECRET_KEY;

const payload = {
  merchantId: merchantId,
  amount: "100.00",
  currency: "EGP",
  order: "test_order_" + Date.now(),
  expireAt: new Date(Date.now() + 24*3600*1000).toISOString(),
  maxFailureAttempts: 3,
  paymentType: "credit",
  display: "en",
  type: "one-time",
  customer: {
    email: "test@example.com",
    reference: "test_customer"
  },
  merchantRedirect: "https://synopsis-clammy-dork.ngrok-free.dev/payment-success",
  serverWebhook: "https://synopsis-clammy-dork.ngrok-free.dev/api/payment/webhook",
  interactionSource: "ECOMMERCE",
  brandColor: "#004aad",
  defaultMethod: "card"
};

const run = async () => {
  const combinations = [
    { name: '1. Auth: secretKey, api-key: apiKey', headers: { 'Authorization': secretKey, 'api-key': apiKey } },
    { name: '2. Auth: apiKey, api-key: apiKey', headers: { 'Authorization': apiKey, 'api-key': apiKey } },
    { name: '3. Auth: secretKey', headers: { 'Authorization': secretKey } },
    { name: '4. Auth: apiKey', headers: { 'Authorization': apiKey } },
    { name: '5. Auth: Bearer secretKey', headers: { 'Authorization': `Bearer ${secretKey}` } },
    { name: '6. Auth: Bearer apiKey', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: '7. api-key: secretKey', headers: { 'api-key': secretKey } },
    { name: '8. api-key: apiKey', headers: { 'api-key': apiKey } },
    { name: '9. Auth: Basic base64(merchantId:apiKey)', headers: { 'Authorization': 'Basic ' + Buffer.from(`${merchantId}:${apiKey}`).toString('base64') } },
    { name: '10. Auth: Basic base64(apiKey:)', headers: { 'Authorization': 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64') } },
    { name: '11. Auth: Basic base64(secretKey:)', headers: { 'Authorization': 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64') } }
  ];

  for (const url of [testUrl, liveUrl]) {
    console.log(`\n======================================================`);
    console.log(`Testing URL: ${url}`);
    for (const combo of combinations) {
      try {
        const response = await axios.post(url, payload, {
          headers: {
            ...combo.headers,
            'Content-Type': 'application/json'
          }
        });
        console.log(`✅ [${combo.name}] SUCCESS! Response data:`, response.data);
      } catch (err) {
        console.log(`❌ [${combo.name}] FAILED! Status: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
      }
    }
  }
};

run();
