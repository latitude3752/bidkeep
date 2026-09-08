import "server-only";
import { escapeHtml, sendEmail } from "@/lib/mailer";
import { OPERATOR } from "@/lib/operator";

export async function sendPasswordResetEmail(input: {
  to: string;
  password: string;
  siteUrl: string;
}): Promise<boolean> {
  const base = input.siteUrl.replace(/\/$/, "") || OPERATOR.siteUrl;
  const loginUrl = `${base}/login`;
  const safeLogin = escapeHtml(loginUrl);
  const safeEmail = escapeHtml(input.to);
  const safePassword = escapeHtml(input.password);
  const product = escapeHtml(OPERATOR.productName);

  return sendEmail({
    to: input.to,
    subject: `Your ${OPERATOR.productName} password reset`,
    html: `<p>Your ${product} password was reset.</p>
<p>Sign in at <a href="${safeLogin}">${safeLogin}</a></p>
<p>Email: ${safeEmail}<br>New password: ${safePassword}</p>
<p>If you did not ask for this, email ${escapeHtml(OPERATOR.email)}.</p>`,
  });
}
