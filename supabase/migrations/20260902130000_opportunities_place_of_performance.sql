-- Place-of-performance state/zip, captured from SAM.gov's placeOfPerformance
-- object. Construction work is inherently local -- a subscriber cares
-- whether a solicitation is buildable within driving distance far more than
-- a national software vendor did -- so this powers a state-level filter on
-- /app/opportunities. Zip is stored for a future real radius search; the
-- MVP filter only needs state.
alter table public.opportunities
  add column if not exists place_of_performance_state text,
  add column if not exists place_of_performance_zip text;

create index if not exists opportunities_place_of_performance_state_idx
  on public.opportunities (place_of_performance_state);
