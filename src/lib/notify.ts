import "server-only";
import { selectActionDigest } from "@netacracy/bid-core";
import { escapeHtml, isEmailConfigured, sendEmail } from "@/lib/mailer";
import { listActiveSeats } from "@/lib/subscriber-seats";

/** Only allow http(s) links into an emailed href -- notice URLs are relayed
 * external data (SAM.gov via BidHawk's relay), and a javascript:/data: URI
 * embedded there would otherwise render as a clickable link in a trusted-
 * looking email. */
function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? url
      : null;
  } catch {
    return null;
  }
}

export type NotifiableOpportunity = {
  title: string;
  agency: string | null;
  noticeUrl: string | null;
  responseDeadline: string | null;
  naicsCode: string | null;
  /** e.g. "BPA · ceiling $25,000,000" -- null when nothing was disclosed or
   * it hasn't been checked yet (an ordinary RFQ, most of the time). */
  scaleLabel: string | null;
};

function envEmail(name: "FOUNDER_DIGEST_BCC" | "NOTIFY_EMAIL_TO"): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const email = value?.trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Active subscriber seats as To, founder as BCC. Null when nobody is
 * subscribed — skip the digest rather than mailing the founder alone.
 * Throws if the seat lookup itself fails; callers (notifyNewOpportunities /
 * notifyNewGrantAwards / notifyNewFundingOpportunities, via sendDigest)
 * catch that and turn it into a returned error string instead of letting it
 * propagate, so a broken digest never fails the sync job that produced the
 * data in the first place -- but it does need to reach the founder, which is
 * why this no longer swallows the failure silently the way it used to. */
export async function resolveDigestMailing(): Promise<{ to: string[]; bcc?: string } | null> {
  const to = (await listActiveSeats()).map((seat) => seat.email);
  if (to.length === 0) return null;
  const bcc = envEmail("FOUNDER_DIGEST_BCC") ?? envEmail("NOTIFY_EMAIL_TO");
  return bcc ? { to, bcc } : { to };
}

/** Founder-only addresses for sync failures. Never includes seat emails.
 * Stays defensive (unlike resolveDigestMailing) -- this IS the last-resort
 * alert path, so a failure here has nowhere further to escalate to besides
 * a server log. */
export async function resolveErrorMailing(): Promise<{ to: string[] } | null> {
  try {
    const to = uniqueNonEmpty([process.env.FOUNDER_DIGEST_BCC, process.env.NOTIFY_EMAIL_TO]);
    if (to.length === 0) return null;
    return { to };
  } catch (err) {
    console.error(
      "resolveErrorMailing failed -- sync errors will not reach the founder by email:",
      err
    );
    return null;
  }
}

/** Sends a digest email and turns any failure into a descriptive string
 * instead of throwing, so a sync route can push it straight into its
 * existing `errors` array (which already flows into notifySyncErrors) with
 * no new plumbing. Returns null both on success AND on an intentional skip
 * (no active seats) -- neither is an error worth alerting on. A `sendEmail`
 * failure only counts as an error once SMTP is actually configured; in an
 * environment where it deliberately isn't (e.g. local dev), that's expected,
 * not a fault. */
async function sendDigest(opts: { subject: string; html: string }): Promise<string | null> {
  let mailing: { to: string[]; bcc?: string } | null;
  try {
    mailing = await resolveDigestMailing();
  } catch (err) {
    return `digest recipient lookup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (!mailing) return null;

  const sent = await sendEmail({ to: mailing.to, bcc: mailing.bcc, subject: opts.subject, html: opts.html });
  if (!sent && isEmailConfigured()) {
    return `digest email "${opts.subject}" failed to send (see server logs)`;
  }
  return null;
}

/** Emails a summary of newly-synced, actionable facilities opportunities so a
 * subscriber can triage straight from the inbox without opening the
 * dashboard. Sent to every active seat; BCC the founder when configured.
 * Returns an error string on failure (see sendDigest) for the caller to
 * surface via notifySyncErrors; null on success or an intentional skip. */
export async function notifyNewOpportunities(
  opportunities: NotifiableOpportunity[]
): Promise<string | null> {
  if (opportunities.length === 0) return null;

  const { selected, omitted } = selectActionDigest(opportunities);
  const items = selected
    .map((op) => {
      const deadline = op.responseDeadline
        ? new Date(op.responseDeadline).toLocaleDateString()
        : "no deadline listed";
      const safeTitle = escapeHtml(op.title);
      const safeUrl = op.noticeUrl ? safeHttpUrl(op.noticeUrl) : null;
      const title = safeUrl
        ? `<a href="${escapeHtml(safeUrl)}">${safeTitle}</a>`
        : safeTitle;
      const agency = escapeHtml(op.agency ?? "Unknown agency");
      const scale = op.scaleLabel ? ` — <strong>${escapeHtml(op.scaleLabel)}</strong>` : "";
      return `<li>${title} — ${agency} (NAICS ${op.naicsCode ?? "—"}, due ${deadline})${scale}</li>`;
    })
    .join("");

  const omittedLine =
    omitted > 0
      ? `<p>${omitted} older-deadline notice${omitted === 1 ? "" : "s"} omitted — open the dashboard for the full list.</p>`
      : "";

  return sendDigest({
    subject: `Action digest: ${selected.length} facilities notice${selected.length === 1 ? "" : "s"} due soonest`,
    html: `<p>Soonest-deadline actionable facilities notices from today's SAM.gov sync. Open each SAM.gov link, then mark Useful or Junk in the dashboard.</p><ul>${items}</ul>${omittedLine}`,
  });
}

/** Emails a summary when a sync job hits errors. The route itself always
 * returns HTTP 200 (Vercel's cron runner doesn't treat a non-200 as
 * actionable on its own), so this is the only thing that surfaces a sync
 * that's silently doing nothing -- e.g. a missing or expired API key.
 * `source` names which sync ran (SAM.gov contracts vs. grants) since both
 * jobs share this same alert path. Founder-only — never seats. */
export async function notifySyncErrors(errors: string[], source = "SAM.gov"): Promise<void> {
  if (errors.length === 0) return;

  const mailing = await resolveErrorMailing();
  if (!mailing) return;

  const items = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("");
  const subject = `${source} sync hit ${errors.length} error${errors.length === 1 ? "" : "s"}`;

  const sent = await sendEmail({
    to: mailing.to,
    subject,
    html: `<p>Today's ${escapeHtml(source)} sync ran into errors:</p><ul>${items}</ul>`,
  });
  if (!sent && isEmailConfigured()) {
    // Last resort: this IS the alert path, so a failure here just goes to
    // the server log -- there's nowhere further to escalate to by email.
    console.error(`notifySyncErrors: failed to send "${subject}" itself`);
  }
}

export type NotifiableGrantAward = {
  recipientName: string;
  awardingAgency: string | null;
  amount: number | null;
  state: string | null;
  programNumber: string | null;
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Emails a summary of newly-discovered grant awards -- a state DOT or
 * municipality that just received federal infrastructure grant funding is a
 * lead worth reaching before their project RFP even posts, so this alert is
 * at least as time-sensitive as a new contract solicitation. Returns an error string
 * on failure (see sendDigest); null on success or an intentional skip. */
export async function notifyNewGrantAwards(
  awards: NotifiableGrantAward[]
): Promise<string | null> {
  if (awards.length === 0) return null;

  const items = awards
    .map((a) => {
      const agency = escapeHtml(a.awardingAgency ?? "Unknown awarding agency");
      const state = a.state ? ` (${escapeHtml(a.state)})` : "";
      const amount = a.amount !== null ? ` — <strong>${formatMoney(a.amount)}</strong>` : "";
      const program = a.programNumber ? ` [ALN ${escapeHtml(a.programNumber)}]` : "";
      return `<li>${escapeHtml(a.recipientName)}${state} — funded by ${agency}${amount}${program}</li>`;
    })
    .join("");

  return sendDigest({
    subject: `${awards.length} new grant award${awards.length === 1 ? "" : "s"} — leads before the RFP`,
    html: `<p>Newly-funded agencies from USAspending.gov — reach out before they post a project RFP:</p><ul>${items}</ul>`,
  });
}

export type NotifiableFundingOpportunity = {
  title: string;
  agency: string | null;
  opportunityUrl: string | null;
  /** ISO (YYYY-MM-DD) or null. */
  closeDate: string | null;
  programNumber: string | null;
};

/** Emails a summary of newly-open facilities-adjacent grant funding windows
 * from Grants.gov -- at least as actionable as a new award (see
 * notifyNewGrantAwards), arguably more: there's still time to shape or
 * submit an application before it closes. Returns an error string on
 * failure (see sendDigest); null on success or an intentional skip. */
export async function notifyNewFundingOpportunities(
  opportunities: NotifiableFundingOpportunity[]
): Promise<string | null> {
  if (opportunities.length === 0) return null;

  const items = opportunities
    .map((o) => {
      const safeTitle = escapeHtml(o.title);
      const safeUrl = o.opportunityUrl ? safeHttpUrl(o.opportunityUrl) : null;
      const title = safeUrl
        ? `<a href="${escapeHtml(safeUrl)}">${safeTitle}</a>`
        : safeTitle;
      const agency = escapeHtml(o.agency ?? "Unknown agency");
      const close = o.closeDate ? new Date(o.closeDate).toLocaleDateString() : "no close date listed";
      const program = o.programNumber ? ` [ALN ${escapeHtml(o.programNumber)}]` : "";
      return `<li>${title} — ${agency} (apply by ${close})${program}</li>`;
    })
    .join("");

  return sendDigest({
    subject: `${opportunities.length} new grant funding opportunit${
      opportunities.length === 1 ? "y" : "ies"
    } open`,
    html: `<p>New facilities-adjacent grant funding opportunities from Grants.gov — apply before these close:</p><ul>${items}</ul>`,
  });
}
