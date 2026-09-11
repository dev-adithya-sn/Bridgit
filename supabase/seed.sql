-- ============================================================
-- Demo seed: a realistic Jharkhand flood scenario.
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- ============================================================

-- Relief camps across flood-affected districts
insert into public.camps (id, name, district, lat, lng, population, contact) values
  ('11111111-1111-1111-1111-111111111101', 'Ranchi Govt. School Relief Camp', 'Ranchi',     23.3441, 85.3096, 1200, 'Camp Officer: 94310-00001'),
  ('11111111-1111-1111-1111-111111111102', 'Jamshedpur Community Hall Camp',  'East Singhbhum', 22.8046, 86.2029, 850,  'Camp Officer: 94310-00002'),
  ('11111111-1111-1111-1111-111111111103', 'Dhanbad Stadium Relief Camp',     'Dhanbad',    23.7957, 86.4304, 2100, 'Camp Officer: 94310-00003'),
  ('11111111-1111-1111-1111-111111111104', 'Sahibganj Riverside Camp',        'Sahibganj',  25.2425, 87.6470, 3400, 'Camp Officer: 94310-00004'),
  ('11111111-1111-1111-1111-111111111105', 'Hazaribagh Town Hall Camp',       'Hazaribagh', 23.9925, 85.3637, 600,  'Camp Officer: 94310-00005');

-- Open needs at those camps (demand)
insert into public.needs (camp_id, type, quantity_needed, unit, urgency, status) values
  ('11111111-1111-1111-1111-111111111104', 'water',    3000, 'bottles (1L)', 5, 'open'),  -- Sahibganj: worst hit
  ('11111111-1111-1111-1111-111111111103', 'water',    1500, 'bottles (1L)', 4, 'open'),
  ('11111111-1111-1111-1111-111111111101', 'water',     800, 'bottles (1L)', 2, 'open'),
  ('11111111-1111-1111-1111-111111111104', 'medicine',  200, 'first-aid kits', 5, 'open'),
  ('11111111-1111-1111-1111-111111111102', 'food',     1000, 'meal packets', 4, 'open'),
  ('11111111-1111-1111-1111-111111111105', 'food',      400, 'meal packets', 3, 'open'),
  ('11111111-1111-1111-1111-111111111103', 'shelter',   300, 'tarpaulin sheets', 3, 'open'),
  ('11111111-1111-1111-1111-111111111102', 'sanitation', 50, 'portable toilets', 4, 'open');

-- Crowdsourced problems (the PS #43 board)
insert into public.problems (title, description, category, district, ward, lat, lng, urgency, population_affected, status, poster_name) values
  ('Ward 4 needs a medical camp',
   'Around 600 people in the relief shelter have no access to doctors. Several cases of fever and diarrhoea reported after the flood. Need a temporary medical camp with basic medicines.',
   'Medical', 'Sahibganj', 'Ward 4', 25.2500, 87.6400, 5, 600, 'open', 'Ward Member, Sahibganj'),
  ('Flood water not draining near Ratu Road',
   'Water has been standing for 3 days near Ratu Road market. Drains are blocked with debris. Shops flooded, risk of disease spreading.',
   'Infrastructure', 'Ranchi', 'Ward 12', 23.3700, 85.2900, 4, 2500, 'open', 'Local Shopkeepers Assoc.'),
  ('Drinking water contaminated in Jugsalai',
   'Hand pumps are giving muddy water after the flood. Around 300 families affected. Need water purification or tanker supply.',
   'Food & Water', 'East Singhbhum', 'Jugsalai', 22.7800, 86.1900, 4, 1500, 'open', 'Resident volunteer'),
  ('Elderly residents stranded on rooftops in Barharwa',
   'At least 12 elderly people stuck on rooftops in low-lying Barharwa block, boats not reaching them. Urgent rescue coordination needed.',
   'Rescue', 'Sahibganj', 'Barharwa', 25.2100, 87.6600, 5, 12, 'claimed', 'NDRF Liaison'),
  ('Temporary school for camp children',
   'Children at Dhanbad Stadium camp have had no classes for 2 weeks. Need volunteers and a tent classroom setup.',
   'Other', 'Dhanbad', null, 23.7960, 86.4300, 2, 350, 'open', 'Camp Officer, Dhanbad'),
  ('Mobile charging point for relief camp',
   'Families at Hazaribagh camp cannot contact relatives; no charging facilities. A solar charging station would help.',
   'Infrastructure', 'Hazaribagh', null, 23.9930, 85.3640, 2, 600, 'resolved', 'Camp Volunteer');

-- A sample resource already in the system (supply)
insert into public.resources (type, quantity, quantity_remaining, unit, district, lat, lng, donor_name, status) values
  ('food', 500, 500, 'meal packets', 'Ranchi', 23.3600, 85.3300, 'Annapurna NGO Kitchen', 'available');
