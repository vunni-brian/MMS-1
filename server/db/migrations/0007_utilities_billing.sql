CREATE TABLE IF NOT EXISTS utility_charges (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  utility_type TEXT NOT NULL
    CHECK (utility_type IN ('electricity', 'water', 'sanitation', 'garbage', 'other')),
  description TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  usage_quantity DOUBLE PRECISION,
  unit TEXT,
  rate_per_unit DOUBLE PRECISION,
  calculation_method TEXT NOT NULL
    CHECK (calculation_method IN ('metered', 'estimated', 'fixed')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('unpaid', 'pending', 'paid', 'overdue', 'cancelled')),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_utility_charges_vendor_id
  ON utility_charges(vendor_id);

CREATE INDEX IF NOT EXISTS idx_utility_charges_market_status
  ON utility_charges(market_id, status);

CREATE INDEX IF NOT EXISTS idx_utility_charges_due_date
  ON utility_charges(due_date);

ALTER TABLE payments
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS utility_charge_id TEXT REFERENCES utility_charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_utility_charge_id
  ON payments(utility_charge_id);

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_target_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_target_check CHECK (
    (booking_id IS NOT NULL AND utility_charge_id IS NULL) OR
    (booking_id IS NULL AND utility_charge_id IS NOT NULL)
  );
