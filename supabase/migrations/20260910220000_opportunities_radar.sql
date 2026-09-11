-- Recompete / option / expiration radar plus SCA wage context.
-- Parsed once at ingest from title / notice type / raw_data / requirements_text
-- so the radar page can query without re-scanning notice text every request.
-- Dates and WD numbers are stored only when the notice actually contains them.

alter table public.opportunities
  add column if not exists radar_kind text
    check (radar_kind in ('recompete', 'option', 'expiration')),
  add column if not exists radar_event_date date,
  add column if not exists radar_evidence text,
  add column if not exists radar_source text
    check (radar_source in ('title', 'notice_type', 'raw_data', 'requirements_text')),
  add column if not exists radar_option_years integer,
  add column if not exists sca_mentioned boolean not null default false,
  add column if not exists sca_wd_number text,
  add column if not exists sca_wd_url text,
  add column if not exists radar_classified_at timestamptz;

create index if not exists opportunities_radar_kind_idx
  on public.opportunities (radar_kind);

create index if not exists opportunities_radar_event_date_idx
  on public.opportunities (radar_event_date);

create index if not exists opportunities_sca_mentioned_idx
  on public.opportunities (sca_mentioned)
  where sca_mentioned;

-- Public teaser: radar + SCA fields only, still no raw_data / requirements_text.
drop view if exists public.opportunities_public;
create view public.opportunities_public as
select
  title,
  agency,
  naics_code,
  response_deadline,
  status,
  notice_id,
  notice_url,
  set_aside_type,
  created_at,
  place_of_performance_state,
  notice_type,
  radar_kind,
  radar_event_date,
  radar_evidence,
  radar_source,
  radar_option_years,
  sca_mentioned,
  sca_wd_number,
  sca_wd_url
from public.opportunities;

grant select on public.opportunities_public to anon, authenticated;
