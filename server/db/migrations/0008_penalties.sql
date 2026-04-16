CREATE TABLE IF NOT EXISTS penalties (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  related_utility_charge_id TEXT REFERENCES utility_charges(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'pending', 'paid', 'cancelled')),
  issued_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_penalties_vendor_id
  ON penalties(vendor_id);

CREATE INDEX IF NOT EXISTS idx_penalties_market_status
  ON penalties(market_id, status);

CREATE INDEX IF NOT EXISTS idx_penalties_related_utility_charge_id
  ON penalties(related_utility_charge_id);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS penalty_id TEXT REFERENCES penalties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_penalty_id
  ON payments(penalty_id);

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_target_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_target_check
  CHECK (
    (CASE WHEN booking_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN utility_charge_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN penalty_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );
