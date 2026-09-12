-- Split "sole-source follow-on to a named incumbent" out of the plain
-- 'recompete' kind (Sep 12 audit's USPTO example). A sole-source follow-on
-- is useful incumbent intelligence -- there's no open competition for
-- another small business to win -- but the previous 'recompete' label
-- presented it exactly like an ordinary competitive recompete. Same pattern
-- as 20260911100000_radar_early_signal_kind.sql, which split the earlier
-- overstated-confidence case out of 'recompete' the same way.

alter table public.opportunities
  drop constraint if exists opportunities_radar_kind_check;

alter table public.opportunities
  add constraint opportunities_radar_kind_check
    check (radar_kind in ('recompete', 'sole_source_followon', 'option', 'expiration', 'early_signal'));

-- Backfill: any already-persisted 'recompete' row whose evidence excerpt
-- itself mentions sole-source language gets reclassified. Evidence excerpts
-- are the actual notice text (see radar.ts excerptAround), so this is a
-- direct re-read of already-correct raw evidence, not a guess.
update public.opportunities
set radar_kind = 'sole_source_followon'
where radar_kind = 'recompete'
  and radar_evidence ~* 'sole[- ]source';
