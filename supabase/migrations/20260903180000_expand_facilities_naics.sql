-- Expand BidKeep NAICS coverage beyond the four core facilities codes.
-- Adds adjacent building-services codes that commonly appear on SAM.gov
-- (pest, waste, temp labor, security systems, remediation).
insert into public.naics_codes (code, label) values
  ('561611', 'Investigation Services'),
  ('561613', 'Armored Car Services'),
  ('561621', 'Security Systems Services (except Locksmiths)'),
  ('561710', 'Exterminating and Pest Control Services'),
  ('561740', 'Carpet and Upholstery Cleaning Services'),
  ('561790', 'Other Services to Buildings and Dwellings'),
  ('561320', 'Temporary Help Services'),
  ('561990', 'All Other Support Services'),
  ('562111', 'Solid Waste Collection'),
  ('562119', 'Other Waste Collection'),
  ('562910', 'Remediation Services'),
  ('811310', 'Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance')
on conflict (code) do update set label = excluded.label, active = true;
