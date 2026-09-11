-- Georgia and Texas both fetch only currently-open listings (GPR's
-- eventStatus=OPEN, ESBD's status=Posted), so once a listing closes it
-- simply stops appearing in the feed -- the sync never learns it closed
-- and the row sits in the DB looking perpetually open. retired_at lets
-- the sync mark a row as no longer open (by its absence from a
-- successful fetch) and lets the local-bids list actually exclude it,
-- instead of accumulating stale rows in the oldest-first 200-row lists.

alter table public.gpr_opportunities
  add column if not exists retired_at timestamptz;

alter table public.tx_esbd_opportunities
  add column if not exists retired_at timestamptz;

create index if not exists gpr_opportunities_retired_at_idx
  on public.gpr_opportunities (retired_at);
create index if not exists tx_esbd_opportunities_retired_at_idx
  on public.tx_esbd_opportunities (retired_at);
