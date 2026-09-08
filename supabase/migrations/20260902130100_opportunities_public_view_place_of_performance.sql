-- Surface place-of-performance state on the public teaser too: "is this
-- staffable near me" is the core pitch for a facilities-industry
-- audience, so it belongs on the public page, not just the gated app.
create or replace view public.opportunities_public as
select title, agency, naics_code, response_deadline, status, place_of_performance_state
from public.opportunities;
