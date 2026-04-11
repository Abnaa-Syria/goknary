/**
 * email.ts — DEPRECATED
 *
 * Email delivery has been replaced by WhatsApp OTP via Twilio.
 * This file is kept as a no-op stub so any accidental legacy imports
 * do not crash the server.
 *
 * See: src/lib/whatsapp.ts for the active OTP transport.
 */

export const sendOTPEmail = async (..._args: any[]): Promise<void> => {
  console.warn('[email.ts] sendOTPEmail is deprecated. OTP is sent via WhatsApp (Twilio).');
};

export const sendWelcomeEmail = async (..._args: any[]): Promise<void> => {
  console.warn('[email.ts] sendWelcomeEmail is deprecated.');
};

export const sendPasswordResetEmail = async (..._args: any[]): Promise<void> => {
  console.warn('[email.ts] sendPasswordResetEmail is deprecated. Password reset is via WhatsApp OTP.');
};

export const verifyEmailConnection = async (): Promise<void> => {
  // no-op — email service removed
};
