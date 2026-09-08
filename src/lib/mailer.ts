import "server-only";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;

  if (!isEmailConfigured()) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

/** True once SMTP is fully configured. Lets a caller distinguish "mail is
 * simply not set up yet" (expected in local dev, not worth alerting on) from
 * a real send failure once it is -- see sendEmail's return value below. */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes untrusted text (form input, third-party API data) before it's
 * interpolated into an HTML email body. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Sends an email via the configured SMTP account. Never throws — logs and
 * returns false on missing config or send failure, so callers (form
 * submissions, background sync jobs) never fail because mail didn't go out. */
export async function sendEmail(opts: {
  to: string | string[];
  bcc?: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn(`SMTP not configured — skipping email "${opts.subject}" to ${opts.to}`);
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  try {
    await t.sendMail({
      from,
      to: Array.isArray(opts.to) ? opts.to.join(",") : opts.to,
      bcc: opts.bcc,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error(`Failed to send email "${opts.subject}":`, err);
    return false;
  }
}
