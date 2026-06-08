/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  GoKnary — WhatsApp Business API Service (Twilio Production)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  This module handles all outbound WhatsApp messages via the official
 *  Twilio Node.js SDK using the Content API (pre-approved templates).
 *
 *  ⚠️  CRITICAL META / TWILIO RULES ENFORCED HERE:
 *  ────────────────────────────────────────────────
 *  1. All business-initiated messages use `contentSid` + `contentVariables`
 *     (NOT the deprecated `body` parameter — would trigger Error 63024).
 *  2. Phone numbers are always E.164 prefixed with `whatsapp:`.
 *  3. Every API call is wrapped in try/catch with structured return objects
 *     so a failed message NEVER crashes the Node.js process.
 *
 *  Environment Variables Required:
 *  ───────────────────────────────
 *  TWILIO_ACCOUNT_SID          — Twilio Account SID
 *  TWILIO_AUTH_TOKEN            — Twilio Auth Token
 *  TWILIO_WHATSAPP_NUMBER      — Business WhatsApp sender (whatsapp:+16414065020)
 *  TWILIO_OTP_TEMPLATE_SID     — Content SID for OTP authentication template
 *  TWILIO_TEMPLATE_ORDER_SID   — Content SID for Order Tracking list picker
 */

import Twilio from 'twilio';

// ─── Client Initialization ────────────────────────────────────────────────────

const getAccountSid = () => process.env.TWILIO_ACCOUNT_SID || '';
const getAuthToken = () => process.env.TWILIO_AUTH_TOKEN || '';
const getFromNumber = () => process.env.TWILIO_WHATSAPP_NUMBER || '';

let client: Twilio.Twilio | null = null;

/**
 * Lazy-initialize the Twilio client.
 * If credentials are missing, log a warning but don't crash — the app
 * can still run (WhatsApp features will gracefully degrade).
 */
const getClient = (): Twilio.Twilio | null => {
  if (client) return client;

  const sid = getAccountSid();
  const token = getAuthToken();

  if (!sid || !token) {
    console.error(
      '[WhatsAppService] ❌ TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing. ' +
      'WhatsApp messaging is DISABLED.'
    );
    return null;
  }

  client = Twilio(sid, token);
  console.log('[WhatsAppService] ✅ Twilio client initialized (Production mode).');
  return client;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Structured response for every WhatsApp operation */
interface WhatsAppResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  twilioCode?: number;
}

/**
 * Normalizes any phone number to E.164 `whatsapp:+xxx` format.
 * Accepts: "+201012345678", "whatsapp:+201012345678", "01012345678" (Egypt default).
 */
const formatWhatsAppNumber = (phone: string): string => {
  let cleaned = phone.trim();

  // Already in correct format
  if (cleaned.startsWith('whatsapp:+')) return cleaned;

  // Has whatsapp: prefix but missing +
  if (cleaned.startsWith('whatsapp:')) {
    cleaned = cleaned.replace('whatsapp:', '');
  }

  // Local Egyptian number (0xxxxxxxxx) → +20xxxxxxxxx
  if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
    cleaned = '+2' + cleaned;
  }

  // Ensure + prefix
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return `whatsapp:${cleaned}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CASE 1: Send OTP (Authentication Template)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends a one-time password via the approved WhatsApp authentication template.
 *
 * Template Variable Mapping:
 *   {{1}} → The OTP code string (e.g. "482910")
 *
 * The template renders a native "Copy Code" button on the user's device.
 *
 * @param toPhoneNumber — Recipient phone in any accepted format
 * @param otpCode       — The 4-6 digit OTP string
 */
export const sendOTP = async (
  toPhoneNumber: string,
  otpCode: string
): Promise<WhatsAppResult> => {
  const context = '[WhatsAppService - SendOTP]';
  const to = formatWhatsAppNumber(toPhoneNumber);

  console.log(`${context} Preparing OTP message to ${to}`);

  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.error(`${context} Twilio client not available — skipping.`);
      return { success: false, error: 'Twilio client not initialized (missing credentials).' };
    }

    const templateSid = process.env.TWILIO_OTP_TEMPLATE_SID;
    if (!templateSid) {
      console.error(`${context} TWILIO_OTP_TEMPLATE_SID env var is missing.`);
      return { success: false, error: 'OTP template SID not configured.' };
    }

    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_VERIFY_SERVICE_SID || getFromNumber(),
      to,
      contentSid: templateSid,
      contentVariables: JSON.stringify({ '1': otpCode }),
    });

    console.log(
      `${context} ✅ OTP sent successfully | SID: ${message.sid} | To: ${to} | Status: ${message.status}`
    );

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error(`${context} ❌ Failed to send OTP to ${to}`);
    console.error(`${context} Twilio Error Code: ${error.code || 'N/A'}`);
    console.error(`${context} Twilio Error Msg:  ${error.message || 'Unknown error'}`);
    console.error(`${context} More Info:         ${error.moreInfo || 'N/A'}`);

    return {
      success: false,
      error: error.message || 'Failed to send OTP via WhatsApp.',
      twilioCode: error.code,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CASE 1.5: Send Reset OTP (Password Reset Template)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends a password reset OTP via the approved WhatsApp reset template.
 *
 * @param toPhoneNumber — Recipient phone
 * @param otpCode       — The 6-digit reset code
 */
export const sendResetOTP = async (
  toPhoneNumber: string,
  otpCode: string
): Promise<WhatsAppResult> => {
  const context = '[WhatsAppService - SendResetOTP]';
  const to = formatWhatsAppNumber(toPhoneNumber);

  console.log(`${context} Preparing Password Reset OTP message to ${to}`);

  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.error(`${context} Twilio client not available — skipping.`);
      return { success: false, error: 'Twilio client not initialized (missing credentials).' };
    }

    const templateSid = process.env.TWILIO_RESET_TEMPLATE_SID;
    if (!templateSid) {
      console.error(`${context} TWILIO_RESET_TEMPLATE_SID env var is missing.`);
      return { success: false, error: 'Reset template SID not configured.' };
    }

    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_VERIFY_SERVICE_SID || getFromNumber(),
      to,
      contentSid: templateSid,
      contentVariables: JSON.stringify({ '1': otpCode }),
    });

    console.log(
      `${context} ✅ Reset OTP sent successfully | SID: ${message.sid} | To: ${to} | Status: ${message.status}`
    );

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error(`${context} ❌ Failed to send Reset OTP to ${to}`);
    console.error(`${context} Twilio Error Code: ${error.code || 'N/A'}`);
    console.error(`${context} Twilio Error Msg:  ${error.message || 'Unknown error'}`);

    return {
      success: false,
      error: error.message || 'Failed to send Reset OTP via WhatsApp.',
      twilioCode: error.code,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CASE 2: Send Order Tracking Interactive Menu (Utility List Picker Template)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends the pre-approved interactive Order Tracking list picker.
 *
 * This is a static template containing native WhatsApp buttons:
 *   • "View Order Details"
 *   • "Track Shipment"
 *
 * No dynamic content variables are required — the template is fully static.
 * We pass an empty JSON object for contentVariables as required by the API.
 *
 * @param toPhoneNumber — Recipient phone in any accepted format
 */
export const sendOrderTrackingMenu = async (
  toPhoneNumber: string
): Promise<WhatsAppResult> => {
  const context = '[WhatsAppService - SendOrderTrackingMenu]';
  const to = formatWhatsAppNumber(toPhoneNumber);

  console.log(`${context} Preparing Order Tracking menu to ${to}`);

  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.error(`${context} Twilio client not available — skipping.`);
      return { success: false, error: 'Twilio client not initialized (missing credentials).' };
    }

    const templateSid = process.env.TWILIO_TEMPLATE_ORDER_SID;
    if (!templateSid) {
      console.error(`${context} TWILIO_TEMPLATE_ORDER_SID env var is missing.`);
      return { success: false, error: 'Order tracking template SID not configured.' };
    }

    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_VERIFY_SERVICE_SID || getFromNumber(),
      to,
      contentSid: templateSid,
      contentVariables: JSON.stringify({}),
    });

    console.log(
      `${context} ✅ Order menu sent successfully | SID: ${message.sid} | To: ${to} | Status: ${message.status}`
    );

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error(`${context} ❌ Failed to send Order menu to ${to}`);
    console.error(`${context} Twilio Error Code: ${error.code || 'N/A'}`);
    console.error(`${context} Twilio Error Msg:  ${error.message || 'Unknown error'}`);
    console.error(`${context} More Info:         ${error.moreInfo || 'N/A'}`);

    return {
      success: false,
      error: error.message || 'Failed to send Order Tracking menu via WhatsApp.',
      twilioCode: error.code,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CASE 2.1: Send Order Placed Notification (Utility Template)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends an order confirmation notification to the customer.
 * 
 * Template variables:
 *   {{1}} → Customer Name
 *   {{2}} → Order ID
 *   {{3}} → Order Total (EGP)
 */
export const sendOrderPlacedNotification = async (
  toPhoneNumber: string,
  customerName: string,
  orderId: string,
  total: number
): Promise<WhatsAppResult> => {
  const context = '[WhatsAppService - SendOrderPlaced]';
  const to = formatWhatsAppNumber(toPhoneNumber);

  console.log(`${context} Preparing Order Placed message to ${to}`);

  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.error(`${context} Twilio client not available — skipping.`);
      return { success: false, error: 'Twilio client not initialized.' };
    }

    const templateSid = process.env.TWILIO_ORDER_PLACED_TEMPLATE_SID;
    if (!templateSid) {
      console.warn(`${context} TWILIO_ORDER_PLACED_TEMPLATE_SID not configured — skipping.`);
      return { success: false, error: 'Order placed template SID not configured.' };
    }

    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_VERIFY_SERVICE_SID || getFromNumber(),
      to,
      contentSid: templateSid,
      contentVariables: JSON.stringify({
        '1': customerName,
        '2': orderId,
        '3': total.toString(),
      }),
    });

    console.log(
      `${context} ✅ Order placed notification sent | SID: ${message.sid} | To: ${to} | Status: ${message.status}`
    );

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error(`${context} ❌ Failed to send Order Placed message to ${to}`);
    console.error(`${context} Twilio Error Code: ${error.code || 'N/A'}`);
    console.error(`${context} Twilio Error Msg:  ${error.message || 'Unknown error'}`);
    return {
      success: false,
      error: error.message || 'Failed to send Order Placed notification.',
      twilioCode: error.code,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CASE 2.2: Send Order Status Update Notification (Utility Template)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends an order status update notification to the customer.
 * 
 * Template variables:
 *   {{1}} → Customer Name
 *   {{2}} → Order ID
 *   {{3}} → New Status
 */
export const sendOrderStatusNotification = async (
  toPhoneNumber: string,
  customerName: string,
  orderId: string,
  status: string
): Promise<WhatsAppResult> => {
  const context = '[WhatsAppService - SendOrderStatus]';
  const to = formatWhatsAppNumber(toPhoneNumber);

  console.log(`${context} Preparing Order Status message to ${to}`);

  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.error(`${context} Twilio client not available — skipping.`);
      return { success: false, error: 'Twilio client not initialized.' };
    }

    const templateSid = process.env.TWILIO_ORDER_STATUS_TEMPLATE_SID;
    if (!templateSid) {
      console.warn(`${context} TWILIO_ORDER_STATUS_TEMPLATE_SID not configured — skipping.`);
      return { success: false, error: 'Order status template SID not configured.' };
    }

    // Map status into Arabic friendly names
    const statusMapAr: Record<string, string> = {
      'PENDING': 'قيد الانتظار',
      'CONFIRMED': 'تم التأكيد',
      'PROCESSING': 'قيد التجهيز',
      'SHIPPED': 'تم الشحن',
      'DELIVERED': 'تم التوصيل',
      'CANCELLED': 'تم الإلغاء',
    };
    const friendlyStatus = statusMapAr[status] || status;

    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_VERIFY_SERVICE_SID || getFromNumber(),
      to,
      contentSid: templateSid,
      contentVariables: JSON.stringify({
        '1': customerName,
        '2': orderId,
        '3': friendlyStatus,
      }),
    });

    console.log(
      `${context} ✅ Order status notification sent | SID: ${message.sid} | To: ${to} | Status: ${message.status}`
    );

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error(`${context} ❌ Failed to send Order Status message to ${to}`);
    console.error(`${context} Twilio Error Code: ${error.code || 'N/A'}`);
    console.error(`${context} Twilio Error Msg:  ${error.message || 'Unknown error'}`);
    return {
      success: false,
      error: error.message || 'Failed to send Order Status notification.',
      twilioCode: error.code,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CASE 3 (Utility): Send a free-form text reply within the 24-hour window
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends a plain-text WhatsApp message to a user who has messaged us
 * within the last 24 hours (session/conversation window).
 *
 * ⚠️  This will FAIL if the user has NOT messaged us within 24 hours.
 *     For business-initiated messages, use sendOTP or sendOrderTrackingMenu instead.
 *
 * @param toPhoneNumber — Recipient phone
 * @param body          — Free-form text message
 */
export const sendFreeFormMessage = async (
  toPhoneNumber: string,
  body: string
): Promise<WhatsAppResult> => {
  const context = '[WhatsAppService - SendFreeForm]';
  const to = formatWhatsAppNumber(toPhoneNumber);

  console.log(`${context} Sending free-form message to ${to}`);

  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.error(`${context} Twilio client not available — skipping.`);
      return { success: false, error: 'Twilio client not initialized.' };
    }

    const message = await twilioClient.messages.create({
      from: getFromNumber(),
      to,
      body,
    });

    console.log(
      `${context} ✅ Message sent | SID: ${message.sid} | To: ${to} | Status: ${message.status}`
    );

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error(`${context} ❌ Failed to send message to ${to}`);
    console.error(`${context} Twilio Error Code: ${error.code || 'N/A'}`);
    console.error(`${context} Twilio Error Msg:  ${error.message || 'Unknown error'}`);

    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message.',
      twilioCode: error.code,
    };
  }
};

// ─── Default Export ───────────────────────────────────────────────────────────

const whatsappService = {
  sendOTP,
  sendResetOTP,
  sendOrderTrackingMenu,
  sendOrderPlacedNotification,
  sendOrderStatusNotification,
  sendFreeFormMessage,
  formatWhatsAppNumber,
};

export default whatsappService;
