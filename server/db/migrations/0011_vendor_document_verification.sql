ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS national_id_number TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS lc_letter_name TEXT,
  ADD COLUMN IF NOT EXISTS lc_letter_path TEXT,
  ADD COLUMN IF NOT EXISTS lc_letter_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS lc_letter_size INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_profiles_national_id_number
  ON vendor_profiles(national_id_number)
  WHERE national_id_number IS NOT NULL;
