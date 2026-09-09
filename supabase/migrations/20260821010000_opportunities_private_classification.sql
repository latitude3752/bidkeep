-- Opportunities becomes an internal working pipeline, not public content:
-- drop the public read policy (service role only from here on, same as leads).
drop policy if exists "Public can read opportunities" on public.opportunities;

-- Notice type (Solicitation, Sources Sought, Award Notice, ...) and PSC
-- classification code, so the dashboard can filter out non-actionable
-- notices and distinguish material/supply acquisitions from services
-- without re-parsing raw_data on every query.
alter table public.opportunities add column if not exists notice_type text;
alter table public.opportunities add column if not exists psc_code text;
alter table public.opportunities add column if not exists acquisition_type text
  check (acquisition_type in ('material', 'service', 'unknown'));

create index if not exists opportunities_acquisition_type_idx on public.opportunities (acquisition_type);
create index if not exists opportunities_notice_type_idx on public.opportunities (notice_type);
