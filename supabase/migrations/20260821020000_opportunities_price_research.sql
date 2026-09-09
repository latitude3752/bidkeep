-- Cached price-research results (SAM.gov Contract Awards API comps), so
-- researching an opportunity doesn't re-hit the API on every dashboard view.
alter table public.opportunities add column if not exists price_research jsonb;
alter table public.opportunities add column if not exists price_research_at timestamptz;
