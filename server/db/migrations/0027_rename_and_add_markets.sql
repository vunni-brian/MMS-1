-- Rename existing markets per user request and add Kampala CBD markets.

-- Fix Kampala city location name (was 'Wandegeya' — misleading)
UPDATE locations
SET name = 'Kampala',
    updated_at = NOW()
WHERE id = 'loc_area_kampala' AND name = 'Wandegeya';

-- Rename testbed sub-area to Kampala CBD
UPDATE locations
SET name = 'Kampala CBD',
    updated_at = NOW()
WHERE id = 'loc_subarea_testbed';

-- Rename market locations
UPDATE locations
SET name = 'Busega Market',
    updated_at = NOW()
WHERE id = 'loc_market_kampala_central' AND name IN ('Wandegeya Market', 'Busega Market');

UPDATE locations
SET name = 'Owino market',
    updated_at = NOW()
WHERE id = 'loc_market_jinja_main' AND name IN ('Jinja Main Market', 'Owino market');

UPDATE locations
SET name = 'Wandegeya market',
    updated_at = NOW()
WHERE id = 'loc_market_demo_test' AND name IN ('Kisenyi Central Market', 'Wandegeya market');

-- Insert new location for Nakasero Market (Kampala CBD)
INSERT INTO locations (id, name, type, parent_id)
VALUES ('loc_market_nakasero', 'Nakasero Market', 'market', 'loc_subarea_kampala_central')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

-- Insert new location for Park Yard Market (Kampala CBD)
INSERT INTO locations (id, name, type, parent_id)
VALUES ('loc_market_park_yard', 'Park Yard Market', 'market', 'loc_subarea_kampala_central')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

-- Rename markets table entries
UPDATE markets
SET name = 'Busega Market',
    code = 'BUSEGA',
    location = 'Busega'
WHERE id = 'market_kampala';

UPDATE markets
SET name = 'Owino market',
    code = 'OWINO',
    location = 'Owino'
WHERE id = 'market_jinja';

UPDATE markets
SET name = 'Wandegeya market',
    code = 'WANDEGEYA',
    location = 'Wandegeya'
WHERE id = 'market_demo_test';

-- Insert new markets (Kampala CBD)
INSERT INTO markets (id, name, code, location, location_id, created_at)
VALUES ('market_nakasero', 'Nakasero Market', 'NAKASERO', 'Kampala', 'loc_market_nakasero', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO markets (id, name, code, location, location_id, created_at)
VALUES ('market_park_yard', 'Park Yard Market', 'PARK-YARD', 'Kampala', 'loc_market_park_yard', NOW())
ON CONFLICT (id) DO NOTHING;
