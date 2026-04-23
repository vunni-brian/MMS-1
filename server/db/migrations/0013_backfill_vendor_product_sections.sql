UPDATE vendor_profiles
SET product_section = COALESCE(
  (
    SELECT CASE
      WHEN stalls.zone ILIKE '%fresh%' OR stalls.zone ILIKE '%produce%' THEN 'Fresh Produce'
      WHEN stalls.zone ILIKE '%textile%' OR stalls.zone ILIKE '%clothing%' THEN 'Textiles'
      WHEN stalls.zone ILIKE '%electronics%' THEN 'Electronics'
      WHEN stalls.zone ILIKE '%craft%' THEN 'Crafts'
      WHEN stalls.zone ILIKE '%food%' THEN 'Cooked Food'
      ELSE 'General Goods'
    END
    FROM stalls
    WHERE stalls.assigned_vendor_id = vendor_profiles.user_id
    ORDER BY stalls.created_at ASC
    LIMIT 1
  ),
  'General Goods'
)
WHERE product_section IS NULL OR BTRIM(product_section) = '';
