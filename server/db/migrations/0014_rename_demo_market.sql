UPDATE locations
SET name = 'Kisenyi Trade Area',
    updated_at = NOW()
WHERE id = 'loc_subarea_testbed'
  AND name IN ('MMS Testbed', 'Local Testbed');

UPDATE locations
SET name = 'Kisenyi Central Market',
    updated_at = NOW()
WHERE id = 'loc_market_demo_test'
  AND name = 'MMS Demo Test Market';

UPDATE markets
SET name = 'Kisenyi Central Market',
    code = 'KIS-CENTRAL',
    location = 'Kampala'
WHERE id = 'market_demo_test'
  AND (name = 'MMS Demo Test Market' OR code = 'MMS-DEMO' OR location = 'Local Testbed');
