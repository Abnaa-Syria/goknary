/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  GoKnary — WhatsApp API Routes
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  POST /api/whatsapp/webhook   — Twilio inbound webhook (public, no auth)
 *  POST /api/whatsapp/send-otp  — Internal: send OTP to a phone number (admin/system)
 *  POST /api/whatsapp/send-order-menu — Internal: send order tracking menu (admin/system)
 */

import { Router, Request, Response } from 'express';
import { handleInboundMessage } from '../controllers/whatsapp';
import { sendOTP, sendOrderTrackingMenu } from '../services/whatsapp.service';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// ─── Public Webhook (Twilio calls this — NO authentication) ───────────────────
router.post('/webhook', handleInboundMessage);

// ─── Internal / Admin Routes (Protected) ──────────────────────────────────────

/**
 * POST /api/whatsapp/send-otp
 * Body: { phone: "+201012345678", otpCode: "482910" }
 *
 * Sends an OTP via the approved WhatsApp authentication template.
 * Restricted to ADMIN / STAFF roles for manual trigger.
 */
router.post(
  '/send-otp',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  async (req: Request, res: Response) => {
    try {
      const { phone, otpCode } = req.body;

      if (!phone || !otpCode) {
        return res.status(400).json({ error: 'Both "phone" and "otpCode" are required.' });
      }

      const result = await sendOTP(phone, otpCode);

      if (result.success) {
        return res.json({ message: 'OTP sent successfully.', messageSid: result.messageSid });
      }

      return res.status(500).json({
        error: 'Failed to send OTP.',
        details: result.error,
        twilioCode: result.twilioCode,
      });
    } catch (error: any) {
      console.error('[WhatsApp Route - send-otp] Unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * POST /api/whatsapp/send-order-menu
 * Body: { phone: "+201012345678" }
 *
 * Sends the interactive Order Tracking list picker to the user.
 * Restricted to ADMIN / STAFF roles.
 */
router.post(
  '/send-order-menu',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: '"phone" is required.' });
      }

      const result = await sendOrderTrackingMenu(phone);

      if (result.success) {
        return res.json({
          message: 'Order tracking menu sent successfully.',
          messageSid: result.messageSid,
        });
      }

      return res.status(500).json({
        error: 'Failed to send order tracking menu.',
        details: result.error,
        twilioCode: result.twilioCode,
      });
    } catch (error: any) {
      console.error('[WhatsApp Route - send-order-menu] Unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

export default router;
