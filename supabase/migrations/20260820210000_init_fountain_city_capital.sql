-- Fountain City Capital: opportunities, leads, capability_docs
-- opportunities and capability_docs are public read-only content;
-- leads is written only via the service role (contact form API route), never by anon/authenticated.

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  notice_id text not null unique,
  title text not null,
  agency text,
  naics_code text,
  set_aside_type text,
  response_deadline timestamptz,
  value_estimate numeric,
  status text not null default 'new' check (status in ('new', 'reviewing', 'bid', 'won', 'lost')),
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;

create policy "Public can read opportunities"
on public.opportunities for select
to anon, authenticated
using (true);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  organization text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
-- Intentionally no anon/authenticated policies: leads are only ever
-- written/read via the service role key from a server-side API route.

create table if not exists public.capability_docs (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('certification', 'capability_statement', 'past_performance')),
  title text not null,
  body text not null,
  naics_code text,
  created_at timestamptz not null default now()
);

alter table public.capability_docs enable row level security;

create policy "Public can read capability docs"
on public.capability_docs for select
to anon, authenticated
using (true);
