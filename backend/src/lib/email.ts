import nodemailer, { Transporter } from 'nodemailer';

/**
 * Generic SMTP email delivery (any provider that speaks SMTP).
 *
 * Env:
 *   SMTP_HOST    required
 *   SMTP_PORT    default 587
 *   SMTP_SECURE  "true" for implicit TLS; defaults to true only on port 465
 *   SMTP_USER / SMTP_PASS  optional (omit both for an unauthenticated relay)
 *   SMTP_FROM    required, e.g. "GoKanary <no-reply@example.com>"
 *
 * Configuration is read when an email is sent, so a missing SMTP setup never blocks server startup.
 */

const PLATFORM_NAME = 'GoKanary';

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('SMTP is not configured');
    this.name = 'EmailNotConfiguredError';
  }
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

const readSmtpConfig = (): SmtpConfig | null => {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureEnv ? secureEnv === 'true' : port === 465;
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS || undefined;
  return { host, port, secure, user, pass, from };
};

export const isEmailConfigured = (): boolean => readSmtpConfig() !== null;

let cached: { key: string; transporter: Transporter } | null = null;

const getTransport = (config: SmtpConfig): Transporter => {
  const key = `${config.host}|${config.port}|${config.secure}|${config.user ?? ''}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      transporter: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      }),
    };
  }
  return cached.transporter;
};

/** Technical error summary without recipient addresses, message content or credentials. */
export const describeEmailError = (error: unknown): string => {
  if (error instanceof EmailNotConfiguredError) return error.message;
  const err = error as { code?: string; responseCode?: number; name?: string } | null;
  const parts = [err?.name, err?.code, err?.responseCode].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unknown email error';
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const sendPasswordResetEmail = async ({
  to,
  resetUrl,
  expiresInMinutes,
}: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> => {
  const config = readSmtpConfig();
  if (!config) throw new EmailNotConfiguredError();

  const subject = `Reset your ${PLATFORM_NAME} password`;
  const text = [
    'Hello,',
    '',
    `We received a request to reset the password for your ${PLATFORM_NAME} account.`,
    `Open the link below to choose a new password. It expires in ${expiresInMinutes} minutes and can be used once.`,
    '',
    resetUrl,
    '',
    "If you didn't request this, you can ignore this email; your password will not change.",
    '',
    `— The ${PLATFORM_NAME} team`,
  ].join('\n');

  const safeUrl = escapeHtml(resetUrl);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;max-width:520px">
  <p>Hello,</p>
  <p>We received a request to reset the password for your ${PLATFORM_NAME} account.</p>
  <p><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Reset password</a></p>
  <p style="font-size:13px;color:#6b7280">This link expires in ${expiresInMinutes} minutes and can be used once. If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${safeUrl}</span></p>
  <p style="font-size:13px;color:#6b7280">If you didn't request this, you can ignore this email; your password will not change.</p>
  <p>— The ${PLATFORM_NAME} team</p>
</div>`;

  await getTransport(config).sendMail({ from: config.from, to, subject, text, html });
};
