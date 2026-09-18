import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentSeat } from "@/lib/current-seat";
import { getAllNaicsCodes, listRelevanceVotes, distanceFromZipMiles } from "@netacracy/bid-core";
import OpportunityPipelineClient from "@/components/OpportunityPipelineClient";
import { type Row, parseFilters, parsePage, parseSort } from "@/lib/opportunity-pipeline";

type FetchedRow = Omit<Row, "distance_miles">;

/** Fetches the viewer's full row set once. Filtering by type/notice/noise/
 * set-aside/department/state/segment/horizon/search used to happen per-
 * request via `?searchParams` (a full server round-trip for every filter
 * click, sort click, or page turn) -- it now happens entirely client-side
 * in OpportunityPipelineClient against this one fetch, run once per page
 * load. Supabase caps a single select at 1000 rows, so this still pages
 * with `.range()` up to the same 20,000-row ceiling the old per-filter
 * query used.
 *
 * myZip is the one exception: distance_miles is computed here, once, using
 * the ~1.1MB ZIP-centroid dataset that must never reach the browser (see
 * opportunity-pipeline.ts). Changing ZIP/radius still submits a real GET
 * form and re-runs this fetch. */
async function getAllOpportunities(myZip: string): Promise<Row[]> {
  const admin = getSupabaseAdmin();
  const BATCH = 1000;
  const rows: FetchedRow[] = [];

  for (let from = 0; from < 20_000; from += BATCH) {
    const { data, error } = await admin
      .from("opportunities")
      .select(
        "id, title, agency, naics_code, set_aside_type, response_deadline, notice_url, notice_type, psc_code, acquisition_type, status, program_type, estimated_ceiling, place_of_performance_state, place_of_performance_zip"
      )
      .range(from, from + BATCH - 1);

    if (error) {
      console.error("Failed to load opportunities:", error.message);
      return [];
    }

    const batch = (data ?? []) as FetchedRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
  }

  return rows.map((r) => ({
    ...r,
    distance_miles: myZip ? distanceFromZipMiles(myZip, r.place_of_performance_zip) : null,
  }));
}

export default async function OpportunityPipeline({
  viewer,
  basePath,
  searchParams,
}: {
  viewer: "founder" | "subscriber";
  basePath: "/admin/opportunities" | "/app/opportunities";
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const initialFilters = parseFilters(sp);
  const initialPage = parsePage(sp);
  const { sortBy: initialSortBy, sortDir: initialSortDir } = parseSort(sp);

  const rows = await getAllOpportunities(initialFilters.myZip);

  const seat = await getCurrentSeat();
  const actorKey = seat?.id ?? (viewer === "founder" ? "founder" : "");
  let votes = new Map<string, boolean>();
  try {
    votes = await listRelevanceVotes(
      actorKey,
      rows.map((r) => r.id)
    );
  } catch (err) {
    console.error("relevance votes unavailable:", err);
  }

  let trackedNaicsCodes: string[] = [];
  try {
    trackedNaicsCodes = (await getAllNaicsCodes()).map((c) => c.code);
  } catch (err) {
    console.error("tracked NAICS codes unavailable:", err);
  }

  return (
    <OpportunityPipelineClient
      viewer={viewer}
      basePath={basePath}
      rows={rows}
      votes={[...votes.entries()]}
      trackedNaicsCodes={trackedNaicsCodes}
      initialFilters={initialFilters}
      initialSortBy={initialSortBy}
      initialSortDir={initialSortDir}
      initialPage={initialPage}
    />
  );
}
