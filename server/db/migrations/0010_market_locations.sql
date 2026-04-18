CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('region', 'city', 'district', 'division', 'municipality', 'subcounty', 'market')),
  parent_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES locations(id);

CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_markets_location_id ON markets(location_id);

INSERT INTO locations (id, name, type, parent_id)
VALUES
  ('loc_region_central', 'Central', 'region', NULL),
  ('loc_region_eastern', 'Eastern', 'region', NULL),
  ('loc_region_western', 'Western', 'region', NULL),
  ('loc_region_northern', 'Northern', 'region', NULL),
  ('loc_area_kampala', 'Kampala', 'city', 'loc_region_central'),
  ('loc_area_wakiso', 'Wakiso', 'district', 'loc_region_central'),
  ('loc_area_mukono', 'Mukono', 'district', 'loc_region_central'),
  ('loc_area_jinja', 'Jinja', 'city', 'loc_region_eastern'),
  ('loc_area_mbale', 'Mbale', 'city', 'loc_region_eastern'),
  ('loc_area_gulu', 'Gulu', 'city', 'loc_region_northern'),
  ('loc_area_mbarara', 'Mbarara', 'city', 'loc_region_western'),
  ('loc_subarea_kampala_central', 'Central Division', 'division', 'loc_area_kampala'),
  ('loc_subarea_kampala_kawempe', 'Kawempe Division', 'division', 'loc_area_kampala'),
  ('loc_subarea_kampala_nakawa', 'Nakawa Division', 'division', 'loc_area_kampala'),
  ('loc_subarea_kampala_rubaga', 'Rubaga Division', 'division', 'loc_area_kampala'),
  ('loc_subarea_kampala_makindye', 'Makindye Division', 'division', 'loc_area_kampala'),
  ('loc_subarea_jinja_municipality', 'Jinja Municipality', 'municipality', 'loc_area_jinja'),
  ('loc_subarea_testbed', 'MMS Testbed', 'subcounty', 'loc_area_kampala'),
  ('loc_market_kampala_central', 'Kampala Central Market', 'market', 'loc_subarea_kampala_central'),
  ('loc_market_jinja_main', 'Jinja Main Market', 'market', 'loc_subarea_jinja_municipality'),
  ('loc_market_demo_test', 'MMS Demo Test Market', 'market', 'loc_subarea_testbed')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

UPDATE markets
SET location_id = 'loc_market_kampala_central'
WHERE id = 'market_kampala' AND location_id IS NULL;

UPDATE markets
SET location_id = 'loc_market_jinja_main'
WHERE id = 'market_jinja' AND location_id IS NULL;

UPDATE markets
SET location_id = 'loc_market_demo_test'
WHERE id = 'market_demo_test' AND location_id IS NULL;
