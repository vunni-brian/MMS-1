CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('vendor', 'manager', 'official')),
  market_id TEXT REFERENCES markets(id),
  mfa_enabled SMALLINT NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0, 1)),
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_reason TEXT,
  id_document_name TEXT,
  id_document_path TEXT,
  id_document_mime_type TEXT,
  id_document_size INTEGER,
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_by TEXT REFERENCES users(id),
  rejected_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'manager_mfa')),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS stalls (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  size TEXT NOT NULL,
  price_per_month INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'reserved', 'paid', 'confirmed', 'maintenance')),
  is_published SMALLINT NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  assigned_vendor_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  stall_id TEXT NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'paid', 'confirmed')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  amount INTEGER NOT NULL,
  reserved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_per_stall
  ON bookings(stall_id)
  WHERE status IN ('reserved', 'paid', 'confirmed');

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  transaction_id TEXT,
  external_reference TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  receipt_id TEXT,
  receipt_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('otp', 'payment', 'booking', 'complaint', 'system')),
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('system', 'sms', 'email')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS coordination_messages (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('manager', 'official')),
  market_id TEXT REFERENCES markets(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_requests (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  manager_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('budget', 'structural')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_requested INTEGER NOT NULL,
  approved_amount INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by_user_id TEXT REFERENCES users(id),
  reviewed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('billing', 'maintenance', 'dispute', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_updates (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved')),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('vendor', 'manager', 'official')),
  market_id TEXT REFERENCES markets(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_deposits (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  reference TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  deposited_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS fallback_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('ussd', 'sms')),
  phone TEXT NOT NULL,
  request_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_market_id ON users(market_id);
CREATE INDEX IF NOT EXISTS idx_users_role_market_id ON users(role, market_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_id ON otp_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone ON otp_challenges(phone);
CREATE INDEX IF NOT EXISTS idx_stalls_market_id ON stalls(market_id);
CREATE INDEX IF NOT EXISTS idx_bookings_market_id ON bookings(market_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_id ON bookings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_market_id ON payments(market_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id ON payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_next_attempt_at ON notification_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_coordination_messages_market_id ON coordination_messages(market_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_market_id ON resource_requests(market_id);
CREATE INDEX IF NOT EXISTS idx_tickets_market_id ON tickets(market_id);
CREATE INDEX IF NOT EXISTS idx_tickets_vendor_id ON tickets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_market_id_created_at ON audit_events(market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_deposits_market_id ON bank_deposits(market_id);
CREATE INDEX IF NOT EXISTS idx_fallback_queries_phone ON fallback_queries(phone);
