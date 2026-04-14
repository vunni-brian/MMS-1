ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('mtn', 'airtel', 'pesapal'));

ALTER TABLE payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider IN ('mtn', 'airtel', 'pesapal'));

ALTER TABLE payment_webhook_events
  DROP CONSTRAINT IF EXISTS payment_webhook_events_provider_check;

ALTER TABLE payment_webhook_events
  ADD CONSTRAINT payment_webhook_events_provider_check
  CHECK (provider IN ('flutterwave', 'pesapal'));
