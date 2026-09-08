"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentSeat } from "@/lib/current-seat";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { setRelevanceVote } from "@netacracy/bid-core";

// RelevanceButtons is shared between the subscriber pipeline (/app/opportunities)
// and the admin detail view (/admin/opportunities/[id]), which has no subscriber
// seat cookie at all -- so a missing seat isn't itself proof of an anonymous
// caller. Attribute to the seat when there is one, to "founder" only when a
// verified admin session cookie is present, and reject everyone else instead
// of silently letting unauthenticated requests vote as "founder".
export async function markOpportunityRelevance(
  opportunityId: string,
  useful: boolean
): Promise<void> {
  if (!opportunityId) throw new Error("Missing opportunity");

  const seat = await getCurrentSeat();
  if (seat) {
    await setRelevanceVote(seat.id, opportunityId, useful);
  } else {
    const adminToken = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!verifySessionToken(adminToken)) throw new Error("Not authorized");
    await setRelevanceVote("founder", opportunityId, useful);
  }

  revalidatePath("/app/opportunities");
  revalidatePath("/admin/opportunities");
}
