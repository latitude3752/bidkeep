-- Adds 'expired' as a status so opportunities whose response deadline has
-- passed without being worked (still 'new'/'reviewing') can be auto-moved
-- out of the active pipeline instead of sitting there as stale noise.
alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.opportunities add constraint opportunities_status_check
  check (status in ('new', 'reviewing', 'bid', 'won', 'lost', 'expired'));
