-- Georgia Procurement Registry (GPR) -- the state's own, legally-mandated
-- public bid-advertising system covering every GA state agency, county,
-- city, and school board in one feed. Deliberately separate from
-- `bonfire_opportunities` and `opportunities` (SAM.gov-shaped): GPR is a
-- structurally different, much richer source (real agency name, buyer
-- detail link, notice id) and its own failure domain -- an outage or
-- format change on either of the other two should never mask this one,
-- or vice versa.
--
-- Public read, same as the other opportunity tables: this is
-- non-sensitive published procurement data, and it's meant to be visible
-- in the subscriber app as the primary state/local list. Writes are
-- service-role only (sync-gpr cron).
create table if not exists public.gpr_opportunities (
  id uuid primary key default gen_random_uuid(),
  notice_id text not null unique,
  title text not null,
  agency_name text,
  government_type text,
  status text,
  posting_date date,
  closing_date date,
  bid_process_type text,
  sole_source boolean not null default false,
  electronic_bid boolean not null default false,
  detail_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gpr_opportunities_closing_date_idx
  on public.gpr_opportunities (closing_date);
create index if not exists gpr_opportunities_government_type_idx
  on public.gpr_opportunities (government_type)
  where government_type is not null;

alter table public.gpr_opportunities enable row level security;

create policy "Public can read gpr opportunities"
on public.gpr_opportunities for select
to anon, authenticated
using (true);

comment on table public.gpr_opportunities is
  'Georgia Procurement Registry feed -- real agency name, dates, and a working per-notice detail link, unlike bonfire_opportunities''s teaser fields. See lib/gpr.ts.';
