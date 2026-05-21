ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_category_check;

ALTER TABLE ticket_updates
  DROP CONSTRAINT IF EXISTS ticket_updates_status_check;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS stall_id TEXT REFERENCES stalls(id),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS breached_sla BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalation_reference TEXT,
  ADD COLUMN IF NOT EXISTS resolution_reference TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE ticket_updates
  ADD COLUMN IF NOT EXISTS comment_number TEXT,
  ADD COLUMN IF NOT EXISTS author_role TEXT,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

ALTER TABLE tickets
  ADD CONSTRAINT tickets_category_check
  CHECK (category IN ('billing', 'maintenance', 'dispute', 'payment', 'stall', 'sanitation', 'harassment', 'other'));

ALTER TABLE tickets
  ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE ticket_updates
  ADD CONSTRAINT ticket_updates_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

ALTER TABLE ticket_updates
  ADD CONSTRAINT ticket_updates_author_role_check
  CHECK (author_role IS NULL OR author_role IN ('vendor', 'manager', 'official', 'admin'));

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  sequence_name TEXT := FORMAT('ticket_sequence_%s', current_year);
  sequence_value BIGINT;
BEGIN
  EXECUTE FORMAT('CREATE SEQUENCE IF NOT EXISTS %I START 1', sequence_name);
  EXECUTE FORMAT('SELECT nextval(%L)', sequence_name) INTO sequence_value;
  RETURN FORMAT('TKT-%s-%s', current_year, LPAD(sequence_value::TEXT, 5, '0'));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ticket_child_reference(parent_ticket_number TEXT, child_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized_prefix TEXT := UPPER(child_prefix);
  sequence_name TEXT;
  sequence_value BIGINT;
BEGIN
  IF normalized_prefix NOT IN ('C', 'A') THEN
    RAISE EXCEPTION 'Unsupported ticket child reference prefix: %', child_prefix;
  END IF;

  sequence_name := LOWER(REGEXP_REPLACE(parent_ticket_number, '[^a-zA-Z0-9]+', '_', 'g')) || '_' || LOWER(normalized_prefix) || '_seq';
  EXECUTE FORMAT('CREATE SEQUENCE IF NOT EXISTS %I START 1', sequence_name);
  EXECUTE FORMAT('SELECT nextval(%L)', sequence_name) INTO sequence_value;
  RETURN parent_ticket_number || '-' || normalized_prefix || sequence_value::TEXT;
END;
$$ LANGUAGE plpgsql;

WITH numbered_tickets AS (
  SELECT
    id,
    'TKT-' ||
      EXTRACT(YEAR FROM created_at)::INTEGER ||
      '-' ||
      LPAD(
        ROW_NUMBER() OVER (
          PARTITION BY EXTRACT(YEAR FROM created_at)::INTEGER
          ORDER BY created_at ASC, id ASC
        )::TEXT,
        5,
        '0'
      ) AS generated_ticket_number
  FROM tickets
  WHERE ticket_number IS NULL
)
UPDATE tickets
SET ticket_number = numbered_tickets.generated_ticket_number
FROM numbered_tickets
WHERE tickets.id = numbered_tickets.id;

WITH numbered_updates AS (
  SELECT
    ticket_updates.id,
    tickets.ticket_number || '-C' ||
      ROW_NUMBER() OVER (
        PARTITION BY ticket_updates.ticket_id
        ORDER BY ticket_updates.created_at ASC, ticket_updates.id ASC
      )::TEXT AS generated_comment_number
  FROM ticket_updates
  INNER JOIN tickets ON tickets.id = ticket_updates.ticket_id
  WHERE ticket_updates.comment_number IS NULL
)
UPDATE ticket_updates
SET comment_number = numbered_updates.generated_comment_number
FROM numbered_updates
WHERE ticket_updates.id = numbered_updates.id;

UPDATE ticket_updates
SET author_role = users.role
FROM users
WHERE users.id = ticket_updates.actor_user_id
  AND ticket_updates.author_role IS NULL;

UPDATE tickets
SET
  priority = CASE
    WHEN category IN ('harassment', 'dispute') THEN 'high'
    WHEN category IN ('billing', 'maintenance', 'payment', 'stall', 'sanitation') THEN 'medium'
    ELSE 'low'
  END,
  sla_due_at = COALESCE(
    sla_due_at,
    created_at + CASE
      WHEN category IN ('harassment', 'dispute') THEN INTERVAL '24 hours'
      WHEN category IN ('billing', 'maintenance', 'payment', 'stall', 'sanitation') THEN INTERVAL '3 days'
      ELSE INTERVAL '5 days'
    END
  ),
  first_response_at = COALESCE(
    first_response_at,
    (
      SELECT MIN(ticket_updates.created_at)
      FROM ticket_updates
      INNER JOIN users ON users.id = ticket_updates.actor_user_id
      WHERE ticket_updates.ticket_id = tickets.id
        AND users.role IN ('manager', 'official', 'admin')
    )
  ),
  resolved_at = COALESCE(resolved_at, CASE WHEN status = 'resolved' THEN updated_at END),
  resolved_by = COALESCE(
    resolved_by,
    CASE
      WHEN status = 'resolved' THEN (
        SELECT ticket_updates.actor_user_id
        FROM ticket_updates
        INNER JOIN users ON users.id = ticket_updates.actor_user_id
        WHERE ticket_updates.ticket_id = tickets.id
          AND ticket_updates.status = 'resolved'
          AND users.role IN ('manager', 'official', 'admin')
        ORDER BY ticket_updates.created_at DESC
        LIMIT 1
      )
    END
  ),
  resolution_reference = COALESCE(resolution_reference, CASE WHEN status = 'resolved' THEN ticket_number || '-RES' END);

UPDATE tickets
SET breached_sla = TRUE
WHERE status NOT IN ('resolved', 'closed')
  AND sla_due_at IS NOT NULL
  AND sla_due_at < NOW();

ALTER TABLE tickets
  ALTER COLUMN ticket_number SET NOT NULL;

ALTER TABLE tickets
  ALTER COLUMN ticket_number SET DEFAULT generate_ticket_number();

ALTER TABLE ticket_updates
  ALTER COLUMN comment_number SET NOT NULL,
  ALTER COLUMN author_role SET NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_audit_log (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  log_number TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  performed_by TEXT NOT NULL REFERENCES users(id),
  performed_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  details_json TEXT
);

CREATE TABLE IF NOT EXISTS ticket_assignments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  previous_assignee_id TEXT REFERENCES users(id),
  new_assignee_id TEXT REFERENCES users(id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_escalations (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  escalation_reference TEXT UNIQUE NOT NULL,
  escalated_from TEXT REFERENCES users(id),
  escalated_to TEXT REFERENCES users(id),
  escalated_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

WITH numbered_audit AS (
  SELECT
    'ticket_audit_' || ticket_updates.id AS id,
    ticket_updates.ticket_id,
    tickets.ticket_number,
    tickets.ticket_number || '-A' ||
      ROW_NUMBER() OVER (
        PARTITION BY ticket_updates.ticket_id
        ORDER BY ticket_updates.created_at ASC, ticket_updates.id ASC
      )::TEXT AS log_number,
    CASE
      WHEN ticket_updates.note = 'Ticket created by vendor.' THEN 'created'
      ELSE 'status_changed'
    END AS action,
    NULL::TEXT AS previous_value,
    ticket_updates.status::TEXT AS new_value,
    ticket_updates.actor_user_id AS performed_by,
    ticket_updates.created_at AS performed_at,
    JSON_BUILD_OBJECT('note', ticket_updates.note, 'commentNumber', ticket_updates.comment_number)::TEXT AS details_json
  FROM ticket_updates
  INNER JOIN tickets ON tickets.id = ticket_updates.ticket_id
)
INSERT INTO ticket_audit_log (
  id,
  ticket_id,
  ticket_number,
  log_number,
  action,
  previous_value,
  new_value,
  performed_by,
  performed_at,
  details_json
)
SELECT
  id,
  ticket_id,
  ticket_number,
  log_number,
  action,
  previous_value,
  new_value,
  performed_by,
  performed_at,
  details_json
FROM numbered_audit
ON CONFLICT (id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_number
  ON tickets(ticket_number);

CREATE INDEX IF NOT EXISTS idx_tickets_number_pattern
  ON tickets(ticket_number varchar_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_created_at
  ON tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON tickets(status);

CREATE INDEX IF NOT EXISTS idx_tickets_vendor
  ON tickets(vendor_id);

CREATE INDEX IF NOT EXISTS idx_tickets_priority
  ON tickets(priority);

CREATE INDEX IF NOT EXISTS idx_tickets_sla_due
  ON tickets(sla_due_at)
  WHERE status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_comments_ticket
  ON ticket_updates(ticket_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_updates_comment_number
  ON ticket_updates(comment_number);

CREATE INDEX IF NOT EXISTS idx_audit_ticket
  ON ticket_audit_log(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_assignments_ticket
  ON ticket_assignments(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_escalations_ticket
  ON ticket_escalations(ticket_id);

DO $$
DECLARE
  ticket_year RECORD;
  ticket_ref RECORD;
  sequence_name TEXT;
BEGIN
  FOR ticket_year IN
    SELECT
      EXTRACT(YEAR FROM created_at)::INTEGER AS created_year,
      MAX((SUBSTRING(ticket_number FROM '-([0-9]{5})$'))::INTEGER) AS max_sequence
    FROM tickets
    GROUP BY EXTRACT(YEAR FROM created_at)::INTEGER
  LOOP
    sequence_name := FORMAT('ticket_sequence_%s', ticket_year.created_year);
    EXECUTE FORMAT('CREATE SEQUENCE IF NOT EXISTS %I START 1', sequence_name);
    IF ticket_year.max_sequence IS NOT NULL THEN
      EXECUTE FORMAT('SELECT setval(%L, %s, true)', sequence_name, ticket_year.max_sequence);
    END IF;
  END LOOP;

  FOR ticket_ref IN
    SELECT
      tickets.ticket_number,
      COUNT(ticket_updates.id) AS update_count
    FROM tickets
    LEFT JOIN ticket_updates ON ticket_updates.ticket_id = tickets.id
    GROUP BY tickets.ticket_number
  LOOP
    sequence_name := LOWER(REGEXP_REPLACE(ticket_ref.ticket_number, '[^a-zA-Z0-9]+', '_', 'g')) || '_c_seq';
    EXECUTE FORMAT('CREATE SEQUENCE IF NOT EXISTS %I START 1', sequence_name);
    IF ticket_ref.update_count > 0 THEN
      EXECUTE FORMAT('SELECT setval(%L, %s, true)', sequence_name, ticket_ref.update_count);
    END IF;
  END LOOP;

  FOR ticket_ref IN
    SELECT
      tickets.ticket_number,
      COUNT(ticket_audit_log.id) AS audit_count
    FROM tickets
    LEFT JOIN ticket_audit_log ON ticket_audit_log.ticket_id = tickets.id
    GROUP BY tickets.ticket_number
  LOOP
    sequence_name := LOWER(REGEXP_REPLACE(ticket_ref.ticket_number, '[^a-zA-Z0-9]+', '_', 'g')) || '_a_seq';
    EXECUTE FORMAT('CREATE SEQUENCE IF NOT EXISTS %I START 1', sequence_name);
    IF ticket_ref.audit_count > 0 THEN
      EXECUTE FORMAT('SELECT setval(%L, %s, true)', sequence_name, ticket_ref.audit_count);
    END IF;
  END LOOP;
END $$;
