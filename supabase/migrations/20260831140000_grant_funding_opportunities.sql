-- Grants.gov funding-opportunity tracking. Previously fetched every
-- sync-grants run and discarded (only counted in the cron's JSON response),
-- even though README.md advertises "upcoming funding-cycle openings" as a
-- delivered signal -- this table closes that gap so a newly-open
-- application window can actually be persisted, shown in the dashboard, and
-- emailed, the same way grant_awards already is.
create table if not exists public.grant_funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null unique,
  opportunity_number text,
  title text not null,
  agency text,
  program_number text,
  open_date date,
  close_date date,
  status text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grant_funding_opportunities enable row level security;

create policy "Public can read grant funding opportunities"
on public.grant_funding_opportunities for select
to anon, authenticated
using (true);

create index if not exists grant_funding_opportunities_close_date_idx
  on public.grant_funding_opportunities (close_date asc);
create index if not exists grant_funding_opportunities_program_number_idx
  on public.grant_funding_opportunities (program_number);
