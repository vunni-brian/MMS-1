INSERT INTO staff_profiles (
  user_id,
  department,
  assigned_region,
  staff_identifier,
  access_level,
  status,
  permission_scope_json,
  responsibilities_json,
  created_by,
  created_at,
  updated_at
)
SELECT users.id,
       CASE
         WHEN users.role = 'manager' THEN 'Market Operations'
         ELSE 'Compliance'
       END AS department,
       COALESCE(markets.location, 'Regional oversight') AS assigned_region,
       CASE
         WHEN users.role = 'official' THEN users.id
         ELSE NULL
       END AS staff_identifier,
       CASE
         WHEN users.role = 'manager' THEN 'market_supervision'
         ELSE 'regional_compliance'
       END AS access_level,
       'active' AS status,
       CASE
         WHEN users.role = 'manager' THEN '["billing:read","utility:read","utility:manage","penalty:read","vendor:read","vendor:review","coordination:read","coordination:write","resource:read","resource:create","stall:read","stall:write","booking:read","booking:update","payment:read","notification:read","ticket:read","ticket:update","report:read","audit:read"]'
         ELSE '["billing:read","utility:read","penalty:read","penalty:manage","coordination:read","coordination:write","resource:read","resource:review","stall:read","booking:read","payment:read","ticket:read","report:read","audit:read","vendor:read"]'
       END AS permission_scope_json,
       CASE
         WHEN users.role = 'manager' THEN '["Workflow Supervision","Vendor Approvals","Operational Monitoring"]'
         ELSE '["Vendor Compliance","Utility Monitoring","Complaints Oversight"]'
       END AS responsibilities_json,
       NULL AS created_by,
       users.created_at,
       users.updated_at
FROM users
LEFT JOIN markets ON markets.id = users.market_id
WHERE users.role IN ('manager', 'official')
ON CONFLICT (user_id) DO NOTHING;
