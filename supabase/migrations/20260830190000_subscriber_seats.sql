-- Paid-pilot subscriber seats. Written/read only via the service role
-- from founder provision and subscriber login; no anon/authenticated policies.
create table if not exists public.subscriber_seats (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  company text,
  role text not null default 'member' check (role in ('owner', 'member')),
  active_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriber_seats enable row level security;
-- service role only; no anon/authenticated policies
