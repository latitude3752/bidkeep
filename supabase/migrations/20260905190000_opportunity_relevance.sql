-- Per-actor useful/junk votes so the digest and pipeline can hide noise
-- without changing the shared opportunities.status (that stays one row
-- for every company until a paying pilot needs per-org workflow).
create table if not exists public.opportunity_relevance (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  actor_key text not null,
  useful boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (opportunity_id, actor_key)
);

alter table public.opportunity_relevance enable row level security;

create index if not exists opportunity_relevance_actor_idx
  on public.opportunity_relevance (actor_key);
