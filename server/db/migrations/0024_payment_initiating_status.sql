-- Add 'initiating' status to payments and payment_attempts for the outbox
-- pattern: row is inserted before the gateway call, then updated to 'pending'
-- after a successful gateway response.
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('initiating', 'pending', 'completed', 'failed', 'cancelled'));

ALTER TABLE payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_status_check
  CHECK (status IN ('initiating', 'pending', 'completed', 'failed', 'cancelled'));
