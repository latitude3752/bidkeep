-- Single source of truth for registered NAICS codes, replacing the
-- hardcoded arrays previously duplicated between the SAM.gov sync job and
-- the public /opportunities page (which risked drifting out of sync).
create table if not exists public.naics_codes (
  code text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.naics_codes enable row level security;

create policy "Public can read active naics codes"
on public.naics_codes for select
to anon, authenticated
using (active = true);

insert into public.naics_codes (code, label) values
  ('561210', 'Facilities Support Services'),
  ('561612', 'Security Guards and Patrol Services'),
  ('561720', 'Janitorial Services'),
  ('561730', 'Landscaping Services')
on conflict (code) do nothing;
