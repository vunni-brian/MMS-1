-- Prevent duplicate payment initiations for the same target record.
-- Partial unique indexes ensure at most one 'initiating' or 'pending' payment
-- per booking, utility charge, or penalty at any given time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_booking
  ON payments(booking_id)
  WHERE booking_id IS NOT NULL AND status IN ('initiating', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_utility_charge
  ON payments(utility_charge_id)
  WHERE utility_charge_id IS NOT NULL AND status IN ('initiating', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_penalty
  ON payments(penalty_id)
  WHERE penalty_id IS NOT NULL AND status IN ('initiating', 'pending');
