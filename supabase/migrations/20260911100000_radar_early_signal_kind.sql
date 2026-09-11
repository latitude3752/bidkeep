-- Split the false-confidence "recompete" label used for a Sources Sought /
-- Presolicitation / Special Notice that merely mentions facilities work,
-- with no actual recompete, follow-on, or incumbent language in the notice.
-- That heuristic previously reused the 'recompete' kind, which overstated
-- confidence next to a real RECOMPETE_RE text match. It now persists as its
-- own 'early_signal' kind ("Possible early opportunity").

alter table public.opportunities
  drop constraint if exists opportunities_radar_kind_check;

alter table public.opportunities
  add constraint opportunities_radar_kind_check
    check (radar_kind in ('recompete', 'option', 'expiration', 'early_signal'));

update public.opportunities
set radar_kind = 'early_signal'
where radar_kind = 'recompete'
  and radar_evidence like '% for facilities work — early recompete / follow-on window';
