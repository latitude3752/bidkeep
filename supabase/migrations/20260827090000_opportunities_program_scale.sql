-- Program-level scale signals, parsed from notice text alongside NSN
-- extraction: a stated BPA/IDIQ ceiling (e.g. "$25,000,000") vs. an ordinary
-- one-off RFQ, which never discloses a price. scale_checked_at distinguishes
-- "checked, nothing disclosed" (columns null, timestamp set) from "not yet
-- checked" (both null) so the pipeline list can tell the two apart.
alter table public.opportunities
  add column if not exists program_type text check (program_type in ('bpa', 'idiq')),
  add column if not exists estimated_ceiling numeric,
  add column if not exists scale_checked_at timestamptz;
