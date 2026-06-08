/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  GoKnary — WhatsApp Inbound Webhook Controller
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Handles incoming POST requests from Twilio when a user:
 *   • Replies with a text message
 *   • Clicks an interactive button (from list picker / quick reply templates)
 *   • Sends media (images, voice notes, etc.)
 *
 *  Twilio delivers these as standard form-encoded POST payloads with fields:
 *   - From:        whatsapp:+201xxxxxxxxx
 *   - To:          whatsapp:+16414065020
 *   - Body:        Text content of the user's message
 *   - ButtonText:  Text of the button the user clicked (interactive templates)
 *   - ListId:      ID of the selected list item (list picker templates)
 *   - NumMedia:    Number of media attachments
 *   - MediaUrl0:   URL of the first attachment
 *   - ProfileName: User's WhatsApp display name
 *   - MessageSid:  Unique Twilio message identifier
 */

import { Request, Response } from 'express';
import { sendFreeFormMessage } from '../services/whatsapp.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwilioInboundPayload {
  From:         string;  // whatsapp:+201xxxxxxxxx
  To:           string;  // whatsapp:+16414065020
  Body:         string;  // Free text or empty for button clicks
  ButtonText?:  string;  // Populated when user clicks a quick reply button
  ListId?:      string;  // Populated when user selects from a list picker
  NumMedia?:    string;  // "0", "1", etc.
  MediaUrl0?:   string;  // First media URL (if any)
  ProfileName?: string;  // User's WhatsApp display name
  MessageSid:   string;  // Twilio Message SID
}

// ─── Webhook Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/webhook
 *
 * This endpoint receives all inbound messages and interactive responses
 * from WhatsApp users via Twilio's webhook system.
 *
 * Twilio expects a 200 OK response. If we don't respond with 200,
 * Twilio will retry the webhook and potentially duplicate processing.
 */
export const handleInboundMessage = async (req: Request, res: Response): Promise<void> => {
  const context = '[WhatsApp Webhook]';

  try {
    const payload: TwilioInboundPayload = req.body;

    // ── Safe extraction ──────────────────────────────────────────────────
    const from        = payload.From        || 'UNKNOWN';
    const body        = payload.Body        || '';
    const buttonText  = payload.ButtonText  || '';
    const listId      = payload.ListId      || '';
    const profileName = payload.ProfileName || 'Unknown User';
    const messageSid  = payload.MessageSid  || 'N/A';
    const numMedia    = parseInt(payload.NumMedia || '0', 10);

    console.log(`${context} ────────────────────────────────────────────`);
    console.log(`${context} 📩 Inbound message received`);
    console.log(`${context}    From:        ${from}`);
    console.log(`${context}    Profile:     ${profileName}`);
    console.log(`${context}    Body:        ${body || '(empty)'}`);
    console.log(`${context}    ButtonText:  ${buttonText || '(none)'}`);
    console.log(`${context}    ListId:      ${listId || '(none)'}`);
    console.log(`${context}    Media Count: ${numMedia}`);
    console.log(`${context}    MessageSid:  ${messageSid}`);
    console.log(`${context} ────────────────────────────────────────────`);

    // ── Route to the correct handler ─────────────────────────────────────

    // CASE A: Interactive button click from Order Tracking template
    if (buttonText) {
      await handleButtonClick(from, buttonText, profileName);
    }
    // CASE B: List picker selection
    else if (listId) {
      await handleListSelection(from, listId, body, profileName);
    }
    // CASE C: Plain text message from user
    else if (body.trim()) {
      await handleTextMessage(from, body, profileName);
    }
    // CASE D: Media-only message (photo, voice note, etc.)
    else if (numMedia > 0) {
      console.log(`${context} 📎 Media received from ${from} (${numMedia} file(s))`);
      if (payload.MediaUrl0) {
        console.log(`${context}    MediaUrl0: ${payload.MediaUrl0}`);
      }
      // For now, acknowledge — extend later for media processing
    }

    // ── Always respond 200 to Twilio (prevent retries) ───────────────────
    res.status(200).send('OK');
  } catch (error: any) {
    console.error(`${context} ❌ Webhook processing error:`, error.message || error);
    // STILL return 200 to prevent Twilio from retrying
    res.status(200).send('OK');
  }
};

// ─── Sub-Handlers ─────────────────────────────────────────────────────────────

/**
 * Handles interactive button clicks (Quick Reply buttons).
 * Triggered when the user taps a button from the Order Tracking template.
 */
const handleButtonClick = async (
  from: string,
  buttonText: string,
  profileName: string
): Promise<void> => {
  const context = '[WhatsApp Webhook - ButtonClick]';
  console.log(`${context} User "${profileName}" clicked: "${buttonText}"`);

  const normalizedButton = buttonText.trim().toLowerCase();

  switch (normalizedButton) {
    case 'view order details':
      console.log(`${context} → Routing to Order Details flow for ${from}`);
      await sendFreeFormMessage(
        from,
        `مرحباً ${profileName}! 👋\n\nلعرض تفاصيل طلبك، يرجى زيارة صفحة طلباتك على المتجر:\nhttps://goknary.com/account/orders\n\nأو أرسل رقم الطلب وسنرسل لك التفاصيل فوراً.`
      );
      break;

    case 'track shipment':
      console.log(`${context} → Routing to Shipment Tracking flow for ${from}`);
      await sendFreeFormMessage(
        from,
        `مرحباً ${profileName}! 📦\n\nلتتبع شحنتك، أرسل لنا رقم الطلب وسنرسل لك آخر تحديث على حالة الشحن.\n\nمثال: #ORD12345`
      );
      break;

    default:
      console.log(`${context} ⚠️ Unrecognized button text: "${buttonText}"`);
      await sendFreeFormMessage(
        from,
        `شكراً لتواصلك! 🙏\nأحد ممثلي خدمة العملاء سيتواصل معك قريباً.`
      );
      break;
  }
};

/**
 * Handles list picker selections.
 * Triggered when the user selects an item from a static list picker template.
 */
const handleListSelection = async (
  from: string,
  listId: string,
  body: string,
  profileName: string
): Promise<void> => {
  const context = '[WhatsApp Webhook - ListSelection]';
  console.log(`${context} User "${profileName}" selected list item: id="${listId}" body="${body}"`);

  // Extend this switch as you add more list picker options
  switch (listId) {
    default:
      console.log(`${context} ℹ️ List selection received — listId: ${listId}`);
      await sendFreeFormMessage(
        from,
        `شكراً لاختيارك! نعمل على طلبك الآن. 🚀`
      );
      break;
  }
};

/**
 * Handles plain text messages from users.
 * This is the fallback for any free-form text that isn't a button/list response.
 */
const handleTextMessage = async (
  from: string,
  body: string,
  profileName: string
): Promise<void> => {
  const context = '[WhatsApp Webhook - TextMessage]';
  console.log(`${context} Text from "${profileName}": "${body}"`);

  const lowerBody = body.trim().toLowerCase();

  // ── Keyword-based routing ──────────────────────────────────────────────
  if (lowerBody === 'hi' || lowerBody === 'hello' || lowerBody === 'مرحبا' || lowerBody === 'السلام عليكم') {
    await sendFreeFormMessage(
      from,
      `أهلاً وسهلاً ${profileName}! 👋\n\nمرحباً بك في جو كناري 🐤\nكيف يمكننا مساعدتك اليوم؟\n\nيمكنك:\n• إرسال رقم طلبك لتتبع الشحنة\n• كتابة "مساعدة" للتحدث مع خدمة العملاء`
    );
  } else if (lowerBody === 'مساعدة' || lowerBody === 'help') {
    await sendFreeFormMessage(
      from,
      `فريق خدمة عملاء جو كناري سيتواصل معك في أقرب وقت ممكن. ⏳\n\nساعات العمل: ٩ صباحاً — ١١ مساءً\n\nشكراً لصبرك! 🙏`
    );
  } else {
    // Generic acknowledgement — a human agent can follow up
    console.log(`${context} ℹ️ Unrecognized text — logging for agent review.`);
    await sendFreeFormMessage(
      from,
      `شكراً لرسالتك! 🙏\nتم استلامها وسيتم الرد عليك قريباً.`
    );
  }
};
