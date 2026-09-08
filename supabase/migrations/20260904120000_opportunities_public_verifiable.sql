-- Public teaser needs notice ID, SAM link, set-aside, and posted timestamp
-- so a cold visitor can verify the sample against SAM.gov.
-- DROP + CREATE: CREATE OR REPLACE cannot reorder/rename existing view columns
-- (place_of_performance_state used to sit where notice_id now sits).
drop view if exists public.opportunities_public;
create view public.opportunities_public as
select
  title,
  agency,
  naics_code,
  response_deadline,
  status,
  notice_id,
  notice_url,
  set_aside_type,
  created_at,
  place_of_performance_state
from public.opportunities;

grant select on public.opportunities_public to anon, authenticated;
