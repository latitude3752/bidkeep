/** Display helpers for public teasers. SAM agency strings are a dotted
 * hierarchy ("DEPT OF DEFENSE.DEPT OF THE ARMY.US ARMY ACC..."); we show
 * department + last office so the table is readable, with the full string
 * available as a title tooltip. */

export function normalizeAgency(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const parts = raw.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "—";
  if (parts.length === 2) return `${parts[0]} · ${parts[1]}`;
  return `${parts[0]} · ${parts[parts.length - 1]}`;
}

export function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return "no deadline listed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no deadline listed";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPostedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMoney0(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function samNoticeHref(
  noticeUrl: string | null | undefined,
  noticeId: string | null | undefined
): string | null {
  const url = noticeUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  const id = noticeId?.trim();
  if (id) return `https://sam.gov/opp/${encodeURIComponent(id)}/view`;
  return null;
}

export function usaSpendingAwardHref(awardId: string | null | undefined): string | null {
  const id = awardId?.trim();
  if (!id) return null;
  return `https://www.usaspending.gov/award/${encodeURIComponent(id)}`;
}

export function setAsideLabel(raw: string | null | undefined): string {
  const text = raw?.trim();
  if (!text) return "Full and open";
  if (/no set.?aside|full and open/i.test(text)) return "Full and open";
  return text;
}

/** Whether this set-aside is one facilities contractors typically chase. */
export function isPrioritySetAside(raw: string | null | undefined): boolean {
  const text = setAsideLabel(raw);
  return /sdvosb|service.?disabled|8\s*\(a\)|hubzone|wosb|women|small business|sdb|vosb/i.test(
    text
  ) && text !== "Full and open";
}
