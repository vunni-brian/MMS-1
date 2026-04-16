ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

ALTER TABLE payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

ALTER TABLE utility_charges
  DROP CONSTRAINT IF EXISTS utility_charges_status_check;

ALTER TABLE utility_charges
  ADD CONSTRAINT utility_charges_status_check
  CHECK (status IN ('unpaid', 'pending', 'pending_payment', 'paid', 'overdue', 'cancelled'));

ALTER TABLE penalties
  DROP CONSTRAINT IF EXISTS penalties_status_check;

ALTER TABLE penalties
  ADD CONSTRAINT penalties_status_check
  CHECK (status IN ('unpaid', 'pending', 'pending_payment', 'paid', 'cancelled'));
