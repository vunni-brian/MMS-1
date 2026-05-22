CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  market_id TEXT REFERENCES markets(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  audience TEXT NOT NULL DEFAULT 'vendors' CHECK (audience IN ('all', 'vendors', 'staff')),
  created_by TEXT REFERENCES users(id),
  created_by_name TEXT NOT NULL,
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('manager', 'official', 'admin')),
  expires_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_market_created
  ON announcements(market_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON announcements(expires_at, archived_at);

CREATE INDEX IF NOT EXISTS idx_announcements_audience
  ON announcements(audience);
