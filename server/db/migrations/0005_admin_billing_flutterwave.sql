ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('vendor', 'manager', 'official', 'admin'));

ALTER TABLE audit_events
  DROP CONSTRAINT IF EXISTS audit_events_actor_role_check;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_actor_role_check
  CHECK (actor_role IN ('vendor', 'manager', 'official', 'admin'));

ALTER TABLE coordination_messages
  DROP CONSTRAINT IF EXISTS coordination_messages_sender_role_check;

ALTER TABLE coordination_messages
  ADD CONSTRAINT coordination_messages_sender_role_check
  CHECK (sender_role IN ('manager', 'official', 'admin'));

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS charge_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS gateway_response_json TEXT;

UPDATE payments
SET charge_type = 'booking_fee'
WHERE charge_type IS NULL;

ALTER TABLE payments
  ALTER COLUMN charge_type SET DEFAULT 'booking_fee',
  ALTER COLUMN charge_type SET NOT NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_charge_type_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_charge_type_check
  CHECK (charge_type IN ('market_dues', 'utilities', 'penalties', 'booking_fee', 'payment_gateway'));

CREATE TABLE IF NOT EXISTS charge_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (name IN ('market_dues', 'utilities', 'penalties', 'booking_fee', 'payment_gateway')),
  display_name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'market')),
  market_id TEXT REFERENCES markets(id),
  is_enabled SMALLINT NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT charge_types_scope_market_check CHECK (
    (scope = 'global' AND market_id IS NULL) OR
    (scope = 'market' AND market_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_charge_types_unique_global
  ON charge_types(name)
  WHERE scope = 'global' AND market_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_charge_types_unique_market
  ON charge_types(name, market_id)
  WHERE scope = 'market' AND market_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('flutterwave')),
  tx_ref TEXT,
  transaction_id TEXT,
  event_type TEXT,
  payload_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tx_ref
  ON payment_webhook_events(tx_ref);

INSERT INTO charge_types (id, name, display_name, scope, market_id, is_enabled, updated_by, updated_at, created_at)
VALUES
  ('charge_market_dues_global', 'market_dues', 'Market Dues', 'global', NULL, 1, NULL, NOW(), NOW()),
  ('charge_utilities_global', 'utilities', 'Utilities', 'global', NULL, 1, NULL, NOW(), NOW()),
  ('charge_penalties_global', 'penalties', 'Penalties', 'global', NULL, 1, NULL, NOW(), NOW()),
  ('charge_booking_fee_global', 'booking_fee', 'Booking Fees', 'global', NULL, 1, NULL, NOW(), NOW()),
  ('charge_payment_gateway_global', 'payment_gateway', 'Payment Gateway', 'global', NULL, 1, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;
