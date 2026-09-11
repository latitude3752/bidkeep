-- Raw upstream count before upsert/dedup, so a collapsing `fetched` can be
-- spotted even when `upserted` still looks fine. Nullable: pre-existing
-- rows and the legacy direct/relay SAM.gov pipeline never tracked it.
alter table public.sync_runs add column if not exists fetched int;
