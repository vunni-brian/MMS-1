-- Prevent duplicate IPN processing by deduplicating webhook events on
-- (provider, tx_ref, event_type). Only applies when both are non-null,
-- which is always the case for valid Pesapal IPNs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_dedup
  ON payment_webhook_events(provider, tx_ref, event_type)
  WHERE tx_ref IS NOT NULL AND event_type IS NOT NULL;
