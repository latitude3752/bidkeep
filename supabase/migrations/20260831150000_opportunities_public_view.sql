-- Public site iteration: the /opportunities teaser page needs a live sample
-- to prove the pipeline is real, but 20260821010000 intentionally dropped
-- opportunities' public-read policy (it became an internal pipeline, and
-- since then has grown notice_url/psc_code/raw_data columns that shouldn't
-- be scraped -- a visitor with the anon key could otherwise query the base
-- table directly via the REST API and skip straight to the SAM.gov listing,
-- bypassing the app's own column selection). A narrow view is the fix:
-- exposes only what the public page actually shows, nothing else.
create or replace view public.opportunities_public as
select title, agency, naics_code, response_deadline, status
from public.opportunities;

grant select on public.opportunities_public to anon, authenticated;
