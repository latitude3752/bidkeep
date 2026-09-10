-- Resume state for /api/sync-grants. The daily cron used to run every
-- active ALN's USAspending pull and only then Grants.gov inside one
-- 120s function; Vercel killed it mid-sweep (HTTP 504) and funding
-- opportunities went stale. The route now stops on a time budget and
-- writes the next unit here so a continuation request -- or the 14:50
-- follow-up cron -- can finish the day without redoing completed work.
--
-- service role only; no anon/authenticated policies (same pattern as
-- stripe_events / sync_runs).
create table if not exists public.grant_sync_checkpoints (
  id text primary key,
  day date not null,
  pass text not null check (pass in ('funding', 'awards', 'done')),
  aln text not null default '',
  award_page int not null default 1,
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.grant_sync_checkpoints enable row level security;
