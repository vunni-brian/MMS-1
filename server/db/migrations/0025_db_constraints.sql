-- Add DB-level integrity constraints for payment data.
-- Prevents zero-amount payments and ensures gateway transaction IDs are unique.

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_amount_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_check
  CHECK (amount > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id
  ON payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

ALTER TABLE utility_charges
  DROP CONSTRAINT IF EXISTS utility_charges_amount_check;

ALTER TABLE utility_charges
  ADD CONSTRAINT utility_charges_amount_check
  CHECK (amount > 0);

ALTER TABLE penalties
  DROP CONSTRAINT IF EXISTS penalties_amount_check;

ALTER TABLE penalties
  ADD CONSTRAINT penalties_amount_check
  CHECK (amount > 0);
