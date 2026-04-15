import { Console } from 'console';
import twilio from 'twilio';

// ─── Twilio Client Init ───────────────────────────────────────────────────────

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();

// Strip any trailing comments (e.g. "whatsapp:+14155238886  # comment")
const RAW_FROM = (process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886')
  .split('#')[0]   // drop inline comments
  .trim();

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.warn('[WhatsApp] ⚠️  TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing — OTPs will NOT be sent.');
}

const client = ACCOUNT_SID && AUTH_TOKEN ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures a phone number is formatted as  whatsapp:+XXXXXXXXXX
 * Handles these input shapes:
 *   "+201012345678"          → "whatsapp:+201012345678"
 *   "whatsapp:+201012345678" → "whatsapp:+201012345678"  (idempotent)
 *   "whatsapp:201012345678"  → "whatsapp:+201012345678"  (adds missing +)
 */
const toWhatsAppNumber = (raw: string): string => {
  const stripped = raw.trim();

  if (stripped.startsWith('whatsapp:')) {
    // Already prefixed — make sure the digit part starts with +
    const digits = stripped.slice('whatsapp:'.length);
    const normalised = digits.startsWith('+') ? digits : `+${digits}`;
    return `whatsapp:${normalised}`;
  }

  // No prefix yet
  const normalised = stripped.startsWith('+') ? stripped : `+${stripped}`;
  return `whatsapp:${normalised}`;
};

// ─── Send WhatsApp OTP ────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP via WhatsApp (Twilio Sandbox or production sender).
 * @param phone - phone in any format: "+201012345678", "whatsapp:+20..."
 * @param otp   - 6-digit string
 */
export const sendWhatsAppOTP = async (phone: string, otp: string, expiresMinutes = 10): Promise<void> => {
  if (!client) {
    throw new Error('[WhatsApp] Twilio client not initialised — check env vars.');
  }

  const to = toWhatsAppNumber(phone);
  const from = toWhatsAppNumber(RAW_FROM);
  console.log("user info", phone);

  console.log(to);
  console.log(from);

  const body = [
    'GoKanary - Verification Code ',
    '',
    `Your OTP is: ${otp}`,
    '',
    `This code expires in ${expiresMinutes} minutes.`,
    'Do NOT share it with anyone.',
  ].join('\n');

  console.log(`🚨 ATTEMPTING TO SEND WHATSAPP TO: ${to}  FROM: ${from}`);
  console.log(`   OTP: ${otp}  |  Expires in: ${expiresMinutes} min`);

  try {
    const message = await client.messages.create({ from, to, body });
    console.log(message);
    console.log(`✅ WhatsApp OTP sent successfully. SID: ${message.sid}  Status: ${message.status}`);
  } catch (error: any) {
    console.error('❌ TWILIO API ERROR:', error?.message ?? error);
    console.error('   Code:', error?.code);
    console.error('   Status:', error?.status);
    console.error('   More info:', error?.moreInfo);
    // Re-throw so the caller can handle it
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

  const body = [
    'GoKanary - Password Reset Code',
    '',
    `Your reset code is: ${otp}`,
    '',
    `This code expires in ${expiresMinutes} minutes.`,
    'If you did not request this, please ignore this message.',
  ].join('\n');

  console.log(`🚨 ATTEMPTING TO SEND PASSWORD RESET WHATSAPP TO: ${to}  FROM: ${from}`);

  try {
    const message = await client.messages.create({ from, to, body });
    console.log(`✅ WhatsApp password-reset OTP sent. SID: ${message.sid}  Status: ${message.status}`);
  } catch (error: any) {
    console.error('❌ TWILIO API ERROR (password reset):', error?.message ?? error);
    console.error('   Code:', error?.code);
    console.error('   Status:', error?.status);
    console.error('   More info:', error?.moreInfo);
    throw error;
  }
};
