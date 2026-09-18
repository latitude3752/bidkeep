import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * All of one actor's relevance votes, keyed by opportunity id.
 *
 * bid-core's listRelevanceVotes(actorKey, opportunityIds) filters with
 * `.in("opportunity_id", opportunityIds)`, which Supabase's REST layer
 * puts straight into the request URL. That was fine when the pipeline
 * fetched a filtered, ~page-sized row set server-side; now that
 * OpportunityPipeline fetches the viewer's *entire* row set once (see its
 * module doc), passing every id through `.in()` built a URL long enough
 * that Cloudflare returned "414 Request-URI Too Large" -- caught by
 * actually loading the page, not by any test.
 *
 * `opportunity_relevance` is indexed on actor_key (see its migration), and
 * one actor's own vote history is naturally small -- nowhere near the size
 * of the whole opportunities table -- so querying by actor alone, with no
 * id list, is both correct and cheap, and sidesteps the URL-length limit
 * entirely rather than working around it with batching.
 */
export async function listActorRelevanceVotes(actorKey: string): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (!actorKey) return map;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("opportunity_relevance")
    .select("opportunity_id, useful")
    .eq("actor_key", actorKey);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.opportunity_id as string, Boolean(row.useful));
  }
  return map;
}
