ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('mtn', 'airtel', 'pesapal', 'receipt'));

ALTER TABLE payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider IN ('mtn', 'airtel', 'pesapal', 'receipt'));

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_file_name TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_path TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_size INTEGER,
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_receipt_id
  ON payments(receipt_id);
