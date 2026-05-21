CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT,
  assigned_region TEXT,
  staff_identifier TEXT,
  access_level TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
  permission_scope_json TEXT,
  responsibilities_json TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_status
  ON staff_profiles(status);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_assigned_region
  ON staff_profiles(assigned_region);
