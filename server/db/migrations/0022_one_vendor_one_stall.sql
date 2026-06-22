-- One vendor, one stall: enforce that a vendor can have at most one active stall.
-- First, clean up any existing duplicates by deactivating extra active stalls.
UPDATE stalls
SET status = 'inactive',
    assigned_vendor_id = NULL,
    updated_at = NOW()
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY assigned_vendor_id ORDER BY created_at ASC) AS rn
    FROM stalls
    WHERE assigned_vendor_id IS NOT NULL AND status = 'active'
  ) dup
  WHERE dup.rn > 1
);

-- Partial unique index: only active stalls with an assigned vendor count toward the limit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_vendor_one_stall
  ON stalls(assigned_vendor_id)
  WHERE status = 'active' AND assigned_vendor_id IS NOT NULL;
