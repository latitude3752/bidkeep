import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrantSyncCursor, GrantSyncPass } from "@/lib/grant-sync";

export const GRANT_SYNC_CHECKPOINT_ID = "daily";

/** Slightly longer than maxDuration so a still-running chunk is not stolen
 * by the follow-up cron. */
export const GRANT_SYNC_LOCK_TTL_MS = 320_000;

export type GrantSyncCheckpointRow = {
  id: string;
  day: string;
  pass: GrantSyncPass | "done";
  aln: string;
  award_page: number;
  locked_at: string | null;
  updated_at: string;
};

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isGrantSyncLockFresh(
  lockedAt: string | null | undefined,
  nowMs = Date.now(),
  ttlMs = GRANT_SYNC_LOCK_TTL_MS
): boolean {
  if (!lockedAt) return false;
  const ts = new Date(lockedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts < ttlMs;
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /grant_sync_checkpoints/i.test(message) ||
    /could not find the table/i.test(message) ||
    /does not exist/i.test(message)
  );
}

/** Today's resume cursor, or a terminal `done` marker. Null when the table
 * is missing (migration not applied yet), the row is from a prior day, or
 * the read fails -- the route then relies on `?cursor=` + after(). */
export async function loadGrantSyncCheckpoint(
  supabase: SupabaseClient
): Promise<GrantSyncCheckpointRow | null> {
  const { data, error } = await supabase
    .from("grant_sync_checkpoints")
    .select("id, day, pass, aln, award_page, locked_at, updated_at")
    .eq("id", GRANT_SYNC_CHECKPOINT_ID)
    .maybeSingle();

  if (error) {
    if (!isMissingRelation(error)) {
      console.warn("grant_sync_checkpoints read skipped:", error.message);
    }
    return null;
  }
  if (!data) return null;
  if (data.day !== utcToday()) return null;
  if (data.pass !== "funding" && data.pass !== "awards" && data.pass !== "done") {
    return null;
  }
  return data as GrantSyncCheckpointRow;
}

export function checkpointRowToCursor(row: GrantSyncCheckpointRow): GrantSyncCursor | null {
  if (row.pass === "done") return null;
  if (!row.aln) return null;
  return { pass: row.pass, aln: row.aln, awardPage: row.award_page || 1 };
}

export async function saveGrantSyncCheckpoint(
  supabase: SupabaseClient,
  next: GrantSyncCursor | null
): Promise<void> {
  const row = {
    id: GRANT_SYNC_CHECKPOINT_ID,
    day: utcToday(),
    pass: next ? next.pass : "done",
    aln: next?.aln ?? "",
    award_page: next?.awardPage ?? 1,
    locked_at: next ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("grant_sync_checkpoints").upsert(row, {
    onConflict: "id",
  });
  if (error && !isMissingRelation(error)) {
    throw new Error(error.message);
  }
}

export async function markGrantSyncInProgress(supabase: SupabaseClient): Promise<void> {
  const existing = await loadGrantSyncCheckpoint(supabase);
  const resuming = existing && existing.pass !== "done";
  const { error } = await supabase.from("grant_sync_checkpoints").upsert(
    {
      id: GRANT_SYNC_CHECKPOINT_ID,
      day: utcToday(),
      pass: resuming ? existing.pass : "funding",
      aln: resuming ? existing.aln : "",
      award_page: resuming ? existing.award_page : 1,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error && !isMissingRelation(error)) {
    console.warn("grant_sync_checkpoints lock skipped:", error.message);
  }
}
