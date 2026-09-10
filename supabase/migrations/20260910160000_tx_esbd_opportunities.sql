-- Texas Electronic State Business Daily (ESBD) -- the state's own public
-- bid-advertising system (txsmartbuy.gov/esbd), covering state agencies,
-- higher ed, and local governments (cities, counties, ISDs, councils of
-- governments) in one feed. Deliberately separate from `opportunities`
-- (SAM.gov-shaped), `bonfire_opportunities`, and `gpr_opportunities`:
-- each state/local source has its own failure domain, so an outage or
-- format change on any one of them can never mask (or be masked by)
-- the others.
--
-- Public read, same as the other opportunity tables: this is
-- non-sensitive published procurement data, and it's meant to be visible
-- in the subscriber app. Writes are service-role only (sync-tx-esbd cron).
create table if not exists public.tx_esbd_opportunities (
  id uuid primary key default gen_random_uuid(),
  notice_id text not null unique,
  title text not null,
  agency_name text,
  status_name text,
  posting_date text,
  response_due text,
  response_time text,
  nigp_codes text,
  detail_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tx_esbd_opportunities_response_due_idx
  on public.tx_esbd_opportunities (response_due);

alter table public.tx_esbd_opportunities enable row level security;

create policy "Public can read tx esbd opportunities"
on public.tx_esbd_opportunities for select
to anon, authenticated
using (true);

comment on table public.tx_esbd_opportunities is
  'Texas Electronic State Business Daily feed -- real agency name, NIGP codes, and a working per-notice detail link. See lib/tx-esbd.ts.';
