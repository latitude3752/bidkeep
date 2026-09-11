-- The admin pipeline and public opportunities page filter/sort on these
-- columns, but only acquisition_type and notice_type were ever indexed
-- (20260821010000). Fine at today's row counts; a full-table-scan query
-- becomes a real slowdown as NAICS coverage keeps growing and rows
-- accumulate across months. Also indexes gpr_opportunities.status, filtered
-- on by the local-bids page alongside its existing closing_date/retired_at
-- indexes.
create index if not exists opportunities_status_idx on public.opportunities (status);
create index if not exists opportunities_naics_code_idx on public.opportunities (naics_code);
create index if not exists opportunities_response_deadline_idx on public.opportunities (response_deadline);
create index if not exists gpr_opportunities_status_idx on public.gpr_opportunities (status);
