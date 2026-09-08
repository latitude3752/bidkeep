-- Tracks failed admin login attempts by IP so repeated password guesses can
-- be locked out. Written/read only via the service role from the login
-- server action, same pattern as leads: no anon/authenticated policies.
create table if not exists public.admin_login_attempts (
  ip text primary key,
  attempt_count int not null default 0,
  first_attempt_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.admin_login_attempts enable row level security;
