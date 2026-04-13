ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

UPDATE stalls
SET status = CASE
  WHEN status = 'maintenance' THEN 'maintenance'
  WHEN status = 'available' THEN 'inactive'
  ELSE 'active'
END;

UPDATE stalls
SET assigned_vendor_id = NULL
WHERE status != 'active';

UPDATE bookings
SET status = CASE
  WHEN status = 'reserved' THEN 'pending'
  WHEN status = 'confirmed' THEN 'approved'
  ELSE status
END;

ALTER TABLE stalls
  DROP CONSTRAINT IF EXISTS stalls_status_check;

ALTER TABLE stalls
  ADD CONSTRAINT stalls_status_check
  CHECK (status IN ('active', 'inactive', 'maintenance'));

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paid'));

DROP INDEX IF EXISTS idx_unique_active_booking_per_stall;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_per_stall
  ON bookings(stall_id)
  WHERE status IN ('approved', 'paid');

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_stalls_status ON stalls(status);
