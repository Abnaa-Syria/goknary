import nodemailer, { Transporter } from 'nodemailer';

// ─── Transporter Singleton ────────────────────────────────────────────────────

let _transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
};

// ─── HTML Templates ───────────────────────────────────────────────────────────

const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>GoKnary</title>
  <style>
    body { margin:0; padding:0; background:#f4f4f5; font-family:'Segoe UI',Arial,sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#1a237e 0%,#3949ab 100%); padding:32px 40px; text-align:center; }
    .header h1 { margin:0; color:#FFD700; font-size:28px; letter-spacing:1px; }
    .header p  { margin:6px 0 0; color:#c5cae9; font-size:14px; }
    .body { padding:40px; }
    .body h2 { margin:0 0 12px; color:#1a237e; font-size:20px; }
    .body p  { margin:0 0 20px; color:#555; font-size:15px; line-height:1.6; }
    .otp-box { background:#f0f4ff; border:2px dashed #3949ab; border-radius:10px;
               text-align:center; padding:24px 16px; margin:24px 0; }
    .otp-code { font-size:42px; font-weight:700; letter-spacing:10px;
                color:#1a237e; font-family:'Courier New',monospace; }
    .otp-note { margin:12px 0 0; font-size:13px; color:#888; }
    .btn { display:inline-block; background:#FFD700; color:#1a237e;
           text-decoration:none; border-radius:8px; padding:12px 32px;
           font-weight:700; font-size:15px; margin:8px 0; }
    .footer { background:#f8f8fa; padding:20px 40px; text-align:center;
              font-size:12px; color:#aaa; border-top:1px solid #eee; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🛒 GoKnary</h1>
      <p>Your trusted multi-vendor marketplace</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © ${new Date().getFullYear()} GoKnary. All rights reserved.<br/>
      This is an automated email — please do not reply.
    </div>
  </div>
</body>
</html>`;

// ─── Exported Email Functions ─────────────────────────────────────────────────

/**
 * Send an OTP verification email.
 */
export const sendOTPEmail = async (
  to: string,
  otp: string,
  name: string,
  expiresMinutes: number = 10
): Promise<void> => {
  const transporter = getTransporter();
  const content = `
    <h2>👋 Welcome to GoKnary, ${name}!</h2>
    <p>Thank you for creating your account. To complete your registration, please enter the verification code below:</p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
      <p class="otp-note">This code expires in <strong>${expiresMinutes} minutes</strong></p>
    </div>
    <p>If you did not create a GoKnary account, you can safely ignore this email.</p>
    <p style="color:#999;font-size:13px;">For security: never share this code with anyone.</p>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"GoKnary" <noreply@goknary.com>',
    to,
    subject: `${otp} is your GoKnary verification code`,
    html: baseTemplate(content),
    text: `Your GoKnary verification code is: ${otp}\nIt expires in ${expiresMinutes} minutes.`,
  });
};

/**
 * Send a welcome email after successful email verification.
 */
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetUrl: string,
  expiresMinutes: number
): Promise<void> => {
  const transporter = getTransporter();
  const content = `
    <h2>Reset your GoKnary password</h2>
    <p>Hi <strong>${name}</strong>, we received a request to reset the password for your account.</p>
    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${resetUrl}">Set a new password →</a>
    </p>
    <p>This link expires in <strong>${expiresMinutes} minutes</strong>. If you did not request a reset, you can ignore this email.</p>
    <p style="color:#999;font-size:13px;">For security, never share this link with anyone.</p>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"GoKnary" <noreply@goknary.com>',
    to,
    subject: 'Reset your GoKnary password',
    html: baseTemplate(content),
    text: `Reset your GoKnary password: ${resetUrl}\nLink expires in ${expiresMinutes} minutes.`,
  });
};

export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  const transporter = getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const content = `
    <h2>🎉 Your account is verified!</h2>
    <p>Hi <strong>${name}</strong>, your email has been successfully verified.</p>
    <p>You can now start shopping on GoKnary and enjoy exclusive deals from hundreds of vendors.</p>
    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${frontendUrl}">Start Shopping Now →</a>
    </p>
    <p style="color:#999;font-size:13px;">
      Discover top deals, browse categories, and find what you love.
    </p>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"GoKnary" <noreply@goknary.com>',
    to,
    subject: `Welcome to GoKnary, ${name}! 🎉`,
    html: baseTemplate(content),
    text: `Hi ${name}, your email has been verified. Welcome to GoKnary! Visit: ${frontendUrl}`,
  });
};

/**
 * Verify the transporter connection on server startup.
 */
export const verifyEmailConnection = async (): Promise<void> => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✉️  Email service connected successfully');
  } catch (error) {
    console.error('⚠️  Email service connection failed (emails will not be sent):', error);
    // Don't throw — app should still start even if email is misconfigured
  }
};
