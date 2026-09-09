-- Cached notice description text, pulled from SAM.gov and reused for both
-- program-scale classification (see 20260827090000) and the "full notice
-- text" detail-page panel.
alter table public.opportunities add column if not exists requirements_text text;
alter table public.opportunities add column if not exists requirements_fetched_at timestamptz;
