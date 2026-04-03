UPDATE users
SET mfa_enabled = 1,
    updated_at = NOW()
WHERE role = 'official'
  AND mfa_enabled = 0;
