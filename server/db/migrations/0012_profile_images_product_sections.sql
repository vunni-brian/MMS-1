ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_image_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_size INTEGER;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS product_section TEXT;
