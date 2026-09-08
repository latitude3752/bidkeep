-- Per-subscriber-company profile (name, UEI/CAGE, certifications, contact)
-- used to populate the quote worksheet/proposal tools with the subscriber's
-- own identity instead of a hardcoded single-tenant company. Keyed by the
-- same normalized company string subscriber_seats already groups seats by
-- (see normalizeCompany() in lib/subscriber-org.ts), since there's no
-- separate companies table -- one profile per distinct company name.
create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  company_key text not null unique,
  company_name text not null,
  address text,
  uei text,
  cage text,
  certifications text[] not null default '{}',
  contact_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_profiles enable row level security;
-- Service role only (written/read via server actions using the admin
-- client), same pattern as subscriber_seats -- no anon/authenticated policies.

-- One quote worksheet per (opportunity, company): the subscriber's own
-- itemized line items and overhead/profit rates for that specific
-- solicitation. line_items is jsonb rather than a child table since it's
-- always read/written as a whole form submission, never queried per-line.
create table if not exists public.quote_worksheets (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  company_key text not null,
  line_items jsonb not null default '[]',
  overhead_pct numeric not null default 8,
  profit_pct numeric not null default 15,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, company_key)
);

alter table public.quote_worksheets enable row level security;
-- Service role only, same as above.

create index if not exists quote_worksheets_opportunity_id_idx
  on public.quote_worksheets (opportunity_id);
