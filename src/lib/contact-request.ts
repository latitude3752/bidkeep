import "server-only";
import { escapeHtml, sendEmail } from "@/lib/mailer";

export type ContactRequestInput = {
  name: string;
  email: string;
  company: string;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-level validation errors, keyed by field name -- pure so it's
 * testable without touching email/env at all. */
export function validateContactRequest(
  input: ContactRequestInput
): Partial<Record<keyof ContactRequestInput, string>> {
  const errors: Partial<Record<keyof ContactRequestInput, string>> = {};
  if (!input.name.trim()) errors.name = "Name is required.";
  if (!input.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_RE.test(input.email.trim())) {
    errors.email = "Enter a valid email.";
  }
  if (!input.message.trim()) errors.message = "Tell us a bit about your team.";
  return errors;
}

/** Same resolution order as notify.ts's founder-alert path (FOUNDER_DIGEST_BCC,
 * falling back to NOTIFY_EMAIL_TO) -- reused here rather than a third env var,
 * so one address covers both "sync errors" and "someone wants to talk to me". */
function resolveFounderEmail(): string | undefined {
  const bcc = process.env.FOUNDER_DIGEST_BCC?.trim();
  if (bcc) return bcc;
  const fallback = process.env.NOTIFY_EMAIL_TO?.trim();
  return fallback || undefined;
}

/** Emails a /start access inquiry to the founder. Returns false if there's
 * no founder address configured or the send itself fails -- never throws,
 * same contract as sendEmail. */
export async function sendContactRequest(input: ContactRequestInput): Promise<boolean> {
  const to = resolveFounderEmail();
  if (!to) {
    console.warn("sendContactRequest: no FOUNDER_DIGEST_BCC/NOTIFY_EMAIL_TO configured");
    return false;
  }

  const name = escapeHtml(input.name.trim());
  const email = escapeHtml(input.email.trim());
  const company = escapeHtml(input.company.trim() || "(not given)");
  const message = escapeHtml(input.message.trim()).replace(/\n/g, "<br />");

  return sendEmail({
    to,
    subject: `Access inquiry from ${input.name.trim()}`,
    html: `<p><strong>Name:</strong> ${name}<br />
<strong>Email:</strong> ${email}<br />
<strong>Company:</strong> ${company}</p>
<p><strong>Message:</strong><br />${message}</p>`,
  });
}
