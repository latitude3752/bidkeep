import "server-only";
import { cookies } from "next/headers";
import { parseSubscriberSessionToken, SUBSCRIBER_COOKIE } from "@/lib/subscriber-session";
import { getSeatById, type SubscriberSeat } from "@/lib/subscriber-seats";

/** The logged-in subscriber for the current request, or null if there
 * isn't one -- e.g. an admin viewing /admin/opportunities/[id], which
 * shares the same OpportunityDetail component but has no subscriber
 * session cookie at all. */
export async function getCurrentSeat(): Promise<SubscriberSeat | null> {
  const store = await cookies();
  const token = store.get(SUBSCRIBER_COOKIE)?.value;
  const session = parseSubscriberSessionToken(token);
  if (!session) return null;
  return getSeatById(session.seatId);
}
