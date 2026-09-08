import "server-only";
import { escapeHtml, sendEmail } from "@/lib/mailer";

export async function sendWelcomeEmail(input: {
  to: string;
  password: string;
  siteUrl: string;
}): Promise<boolean> {
  const loginUrl = `${input.siteUrl}/login`;
  const appUrl = `${input.siteUrl}/app/opportunities`;
  const termsUrl = `${input.siteUrl}/terms`;

  const safeLogin = escapeHtml(loginUrl);
  const safeApp = escapeHtml(appUrl);
  const safeTerms = escapeHtml(termsUrl);
  const safeEmail = escapeHtml(input.to);
  const safePassword = escapeHtml(input.password);

  return sendEmail({
    to: input.to,
    subject: "Your BidKeep login",
    html: `<p>Your BidKeep login is ready.</p>
<p>Sign in at <a href="${safeLogin}">${safeLogin}</a></p>
<p>Email: ${safeEmail}<br>Password: ${safePassword}</p>
<p>Pipeline: <a href="${safeApp}">${safeApp}</a></p>
<p>Terms: <a href="${safeTerms}">${safeTerms}</a></p>
<p>Reply to this email to book the 30-minute kickoff.</p>`,
  });
}
