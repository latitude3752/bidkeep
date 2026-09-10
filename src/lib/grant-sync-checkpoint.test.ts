import { describe, expect, it } from "vitest";
import {
  checkpointRowToCursor,
  GRANT_SYNC_CHECKPOINT_ID,
  isGrantSyncLockFresh,
  loadGrantSyncCheckpoint,
  saveGrantSyncCheckpoint,
} from "./grant-sync-checkpoint";

function checkpointClient(opts: {
  row?: Record<string, unknown> | null;
  error?: { message: string; code?: string } | null;
  onUpsert?: (row: Record<string, unknown>) => void;
}) {
  return {
    from: (table: string) => {
      expect(table).toBe("grant_sync_checkpoints");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.row ?? null, error: opts.error ?? null }),
          }),
        }),
        upsert: async (row: Record<string, unknown>) => {
          opts.onUpsert?.(row);
          return { error: opts.error ?? null };
        },
      };
    },
  };
}

describe("grant sync checkpoint", () => {
  it("treats a lock as fresh only inside the TTL window", () => {
    const now = Date.parse("2026-09-10T14:35:00.000Z");
    expect(isGrantSyncLockFresh("2026-09-10T14:34:00.000Z", now, 120_000)).toBe(true);
    expect(isGrantSyncLockFresh("2026-09-10T14:30:00.000Z", now, 120_000)).toBe(false);
    expect(isGrantSyncLockFresh(null, now)).toBe(false);
  });

  it("ignores a checkpoint from a previous UTC day", async () => {
    const supabase = checkpointClient({
      row: {
        id: GRANT_SYNC_CHECKPOINT_ID,
        day: "2020-01-01",
        pass: "awards",
        aln: "14.218",
        award_page: 2,
        locked_at: null,
        updated_at: "2020-01-01T00:00:00.000Z",
      },
    });
    await expect(loadGrantSyncCheckpoint(supabase as never)).resolves.toBeNull();
  });

  it("returns today's resume cursor and maps it back", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const row = {
      id: GRANT_SYNC_CHECKPOINT_ID,
      day: today,
      pass: "awards",
      aln: "81.041",
      award_page: 4,
      locked_at: "2026-09-10T14:40:00.000Z",
      updated_at: "2026-09-10T14:40:00.000Z",
    };
    const supabase = checkpointClient({ row });
    const loaded = await loadGrantSyncCheckpoint(supabase as never);
    expect(loaded?.aln).toBe("81.041");
    expect(checkpointRowToCursor(loaded!)).toEqual({
      pass: "awards",
      aln: "81.041",
      awardPage: 4,
    });
  });

  it("writes a done marker when the sweep finishes", async () => {
    let saved: Record<string, unknown> | undefined;
    const supabase = checkpointClient({
      onUpsert: (row) => {
        saved = row;
      },
    });
    await saveGrantSyncCheckpoint(supabase as never, null);
    expect(saved?.pass).toBe("done");
    expect(saved?.aln).toBe("");
    expect(saved?.locked_at).toBeNull();
  });

  it("does not throw when the checkpoints table has not been applied yet", async () => {
    const supabase = checkpointClient({
      error: { message: "Could not find the table 'public.grant_sync_checkpoints'", code: "PGRST205" },
    });
    await expect(loadGrantSyncCheckpoint(supabase as never)).resolves.toBeNull();
    await expect(saveGrantSyncCheckpoint(supabase as never, null)).resolves.toBeUndefined();
  });
});
