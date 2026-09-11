-- Backfilled early_signal rows (see 20260911100000) kept their old
-- 'recompete' evidence wording, which still said "recompete / follow-on
-- window" even though the label above it now correctly reads "Possible
-- early opportunity." Update the stored text to match the honest label.

update public.opportunities
set radar_evidence = replace(
  radar_evidence,
  ' for facilities work — early recompete / follow-on window',
  ' for facilities work — no incumbent or follow-on language found in the notice itself'
)
where radar_kind = 'early_signal'
  and radar_evidence like '% for facilities work — early recompete / follow-on window';
