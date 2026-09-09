-- State/local procurement teaser feed sourced from Bonfire's public
-- preview search (vendor.bonfirehub.com). Deliberately separate from
-- `opportunities` (SAM.gov-shaped: notice_id, naics_code, psc_code, etc.)
-- since Bonfire's preview tier is a structurally different, much sparser
-- data source (no id, no agency, no NAICS-equivalent) -- keeping it apart
-- means a Bonfire change or outage can never affect the SAM.gov pipeline.
--
-- Public read, same as `opportunities`: this is non-sensitive published
-- procurement data, and the teaser is meant to be visible in the
-- subscriber app. Writes are service-role only (sync-bonfire cron).
create table if not exists public.bonfire_opportunities (
  id uuid primary key default gen_random_uuid(),
  dedup_key text not null unique,
  title text not null,
  state text,
  status_id integer not null,
  date_open timestamptz,
  date_close timestamptz,
  search_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bonfire_opportunities_date_close_idx
  on public.bonfire_opportunities (date_close);
create index if not exists bonfire_opportunities_state_idx
  on public.bonfire_opportunities (state)
  where state is not null;

alter table public.bonfire_opportunities enable row level security;

create policy "Public can read bonfire opportunities"
on public.bonfire_opportunities for select
to anon, authenticated
using (true);

comment on table public.bonfire_opportunities is
  'Teaser feed from Bonfire''s public preview search (title/state/dates only -- no agency or documents, which require Bonfire''s own paid account). See lib/bonfire.ts.';
