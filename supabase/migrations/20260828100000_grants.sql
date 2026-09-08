-- Grant-award tracking: a second, complementary signal to SAM.gov contract
-- solicitations. A housing authority or municipality that just received
-- community-facilities or public-housing funding is about to procure
-- building-services work -- often before any RFP even posts -- so this is
-- a leading indicator, not just another bid list.
--
-- grant_programs mirrors naics_codes: admin-managed list of Assistance
-- Listing (formerly CFDA) numbers to track, rather than hardcoding.
create table if not exists public.grant_programs (
  aln text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.grant_programs enable row level security;

create policy "Public can read active grant programs"
on public.grant_programs for select
to anon, authenticated
using (active = true);

insert into public.grant_programs (aln, label) values
  ('10.766', 'Community Facilities Loans and Grants'),
  ('14.218', 'Community Development Block Grants/Entitlement Grants'),
  ('14.850', 'Public and Indian Housing'),
  ('14.872', 'Public Housing Capital Fund'),
  ('81.042', 'Weatherization Assistance for Low-Income Persons'),
  ('97.036', 'Disaster Grants — Public Assistance (Presidentially Declared Disasters)')
on conflict (aln) do nothing;

-- grant_awards: actual funded recipients, pulled from USAspending.gov.
-- award_id is USAspending's `generated_internal_id`, which is guaranteed
-- globally unique across programs (unlike the human-readable "Award ID"
-- like "EMW-2026-CU-05011", which is only unique within one program).
create table if not exists public.grant_awards (
  id uuid primary key default gen_random_uuid(),
  award_id text not null unique,
  award_number text,
  recipient_name text not null,
  awarding_agency text,
  amount numeric,
  start_date date,
  description text,
  program_number text,
  state text,
  county text,
  city text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grant_awards enable row level security;

create policy "Public can read grant awards"
on public.grant_awards for select
to anon, authenticated
using (true);

create index if not exists grant_awards_start_date_idx on public.grant_awards (start_date desc);
create index if not exists grant_awards_program_number_idx on public.grant_awards (program_number);
