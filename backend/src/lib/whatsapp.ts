import { Console } from 'console';
import twilio from 'twilio';

// ─── Twilio Client Init ───────────────────────────────────────────────────────

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();

// 🟢 NEW: ضفنا متغيرات للـ Template SIDs اللي هتاخدها من تويليو بعد الموافقة
const OTP_TEMPLATE_SID = process.env.TWILIO_OTP_TEMPLATE_SID?.trim(); 
const RESET_TEMPLATE_SID = process.env.TWILIO_RESET_TEMPLATE_SID?.trim();

// Strip any trailing comments (e.g. "whatsapp:+14155238886  # comment")
const RAW_FROM = (process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886')
  .split('#')[0]   // drop inline comments
  .trim();

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.warn('[WhatsApp] ⚠️  TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing — OTPs will NOT be sent.');
}

if (!OTP_TEMPLATE_SID) {
  console.warn('[WhatsApp] ⚠️  TWILIO_OTP_TEMPLATE_SID missing — Ensure you have a verified template for production.');
}

const client = ACCOUNT_SID && AUTH_TOKEN ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures a phone number is formatted as  whatsapp:+XXXXXXXXXX
 */
const toWhatsAppNumber = (raw: string): string => {
  const stripped = raw.trim();

  if (stripped.startsWith('whatsapp:')) {
    const digits = stripped.slice('whatsapp:'.length);
    const normalised = digits.startsWith('+') ? digits : `+${digits}`;
    return `whatsapp:${normalised}`;
  }

  const normalised = stripped.startsWith('+') ? stripped : `+${stripped}`;
  return `whatsapp:${normalised}`;
};

// ─── Send WhatsApp OTP ────────────────────────────────────────────────────────

export const sendWhatsAppOTP = async (phone: string, otp: string, expiresMinutes = 10): Promise<void> => {
  if (!client) {
    throw new Error('[WhatsApp] Twilio client not initialised — check env vars.');
  }

  const to = toWhatsAppNumber(phone);
  const from = toWhatsAppNumber(RAW_FROM);

  console.log(`🚨 ATTEMPTING TO SEND WHATSAPP TO: ${to}  FROM: ${from}`);
  console.log(`   OTP: ${otp}  |  Expires in: ${expiresMinutes} min`);

  try {
    // 🟢 التعديل الجوهري: استخدام القوالب بدل النص الحر
    const message = await client.messages.create({ 
      from, 
      to, 
      contentSid: OTP_TEMPLATE_SID || 'HX_YOUR_VERIFICATION_TEMPLATE_SID_HERE', 
      contentVariables: JSON.stringify({
        "1": otp,
        // "2": String(expiresMinutes) // لو القالب بتاعك فيه متغير تاني للدقايق، شيل الكومنت عن السطر ده
      })
    });
    
    console.log(`✅ WhatsApp OTP sent successfully. SID: ${message.sid}  Status: ${message.status}`);
  } catch (error: any) {
    console.error('❌ TWILIO API ERROR:', error?.message ?? error);
    console.error('   Code:', error?.code);
    console.error('   Status:', error?.status);
    console.error('   More info:', error?.moreInfo);
    throw error;
  }
};

// ─── Send WhatsApp Password Reset OTP ────────────────────────────────────────

export const sendWhatsAppPasswordReset = async (phone: string, otp: string, expiresMinutes = 10): Promise<void> => {
  if (!client) {
    throw new Error('[WhatsApp] Twilio client not initialised — check env vars.');
  }

  const to = toWhatsAppNumber(phone);
  const from = toWhatsAppNumber(RAW_FROM);

  console.log(`🚨 ATTEMPTING TO SEND PASSWORD RESET WHATSAPP TO: ${to}  FROM: ${from}`);

  try {
    // 🟢 التعديل الجوهري: استخدام القوالب بدل النص الحر
    const message = await client.messages.create({ 
      from, 
      to, 
      contentSid: RESET_TEMPLATE_SID || OTP_TEMPLATE_SID || 'HX_YOUR_RESET_TEMPLATE_SID_HERE', 
      contentVariables: JSON.stringify({
        "1": otp,
        // "2": String(expiresMinutes) 
      })
    });
    
    console.log(`✅ WhatsApp password-reset OTP sent. SID: ${message.sid}  Status: ${message.status}`);
  } catch (error: any) {
    console.error('❌ TWILIO API ERROR (password reset):', error?.message ?? error);
    console.error('   Code:', error?.code);
    console.error('   Status:', error?.status);
    console.error('   More info:', error?.moreInfo);
    throw error;
  }
};