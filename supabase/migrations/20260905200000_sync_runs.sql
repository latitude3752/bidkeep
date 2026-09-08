-- One row per sync/ingest invocation, so /admin/sync-status (and the daily
-- freshness check) can answer "did today's sync actually happen" without
-- digging through Vercel logs by hand.
create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  source text not null, -- 'direct' (own SAM.gov pull) | 'relay' (received from BidHawk)
  upserted int not null default 0,
  error_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  ran_at timestamptz not null default now()
);

create index if not exists sync_runs_ran_at_idx on public.sync_runs (ran_at desc);
