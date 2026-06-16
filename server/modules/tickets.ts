import {
  all,
  createId,
  get,
  getManagerForMarket,
  logAuditEvent,
  queueNotification,
  run,
  transaction,
} from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { assertMaxLength, MAX_DESCRIPTION_LENGTH, MAX_MESSAGE_LENGTH, MAX_NOTE_LENGTH, MAX_REASON_LENGTH, MAX_SUBJECT_LENGTH, sanitizeText } from "../lib/text-utils.ts";
import { nowIso } from "../lib/security.ts";
import { persistFilePayload, validateFilePayload } from "../lib/storage.ts";
import {
  generateTicketChildReference,
  generateTicketNumber,
  getEscalationReference,
  getResolutionReference,
} from "../lib/ticket-identifiers.ts";
import { getTicketCreationManagerChannels, getVendorTicketNotification } from "../lib/ticket-notifications.ts";
import type { FilePayload, Role, TicketCategory, TicketPriority, TicketStatus } from "../types.ts";

type TicketRow = {
  id: string;
  ticket_number: string;
  market_id: string | null;
  market_name: string | null;
  vendor_id: string;
  vendor_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  resolution_note: string | null;
  sla_due_at: string | null;
  first_response_at: string | null;
  breached_sla: boolean;
  resolved_at: string | null;
  closed_at: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  escalation_reference: string | null;
  resolution_reference: string | null;
  created_at: string;
  updated_at: string;
};

const ticketSelect = `
  SELECT tickets.id,
         tickets.ticket_number,
         tickets.market_id,
         markets.name AS market_name,
         tickets.vendor_id,
         vendors.name AS vendor_name,
         tickets.assigned_to,
         assignees.name AS assigned_to_name,
         tickets.category,
         tickets.subject,
         tickets.description,
         tickets.status,
         tickets.priority,
         tickets.resolution_note,
         tickets.sla_due_at,
         tickets.first_response_at,
         tickets.breached_sla,
         tickets.resolved_at,
         tickets.closed_at,
         tickets.escalated_at,
         tickets.escalation_reason,
         tickets.escalation_reference,
         tickets.resolution_reference,
         tickets.created_at,
         tickets.updated_at
  FROM tickets
  INNER JOIN users AS vendors ON vendors.id = tickets.vendor_id
  LEFT JOIN users AS assignees ON assignees.id = tickets.assigned_to
  LEFT JOIN markets ON markets.id = tickets.market_id
`;

const prioritySlaHours: Record<TicketPriority, number> = {
  low: 24 * 5,
  medium: 24 * 3,
  high: 24,
  urgent: 12,
};

const inferPriority = (category: TicketCategory, priority?: TicketPriority | null): TicketPriority => {
  if (priority && priority in prioritySlaHours) return priority;
  if (category === "harassment" || category === "dispute") return "high";
  if (category === "other") return "low";
  return "medium";
};

const addHours = (timestamp: string, hours: number) => {
  const value = new Date(timestamp);
  value.setUTCHours(value.getUTCHours() + hours);
  return value.toISOString();
};

const isSlaBreached = (ticket: {
  status: TicketStatus;
  sla_due_at?: string | null;
  slaDueAt?: string | null;
  breached_sla?: boolean;
  breachedSla?: boolean;
}) => {
  const dueAt = ticket.sla_due_at ?? ticket.slaDueAt ?? null;
  const alreadyBreached = ticket.breached_sla ?? ticket.breachedSla ?? false;
  return (
    alreadyBreached ||
    (dueAt ? !["resolved", "closed"].includes(ticket.status) && new Date(dueAt).getTime() < Date.now() : false)
  );
};

const getRequestIp = (req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") return forwardedFor.split(",")[0]?.trim() || null;
  if (Array.isArray(forwardedFor)) return forwardedFor[0]?.split(",")[0]?.trim() || null;
  return req.socket?.remoteAddress || null;
};

const loadAttachments = async (ticketId: string) =>
  (
    await all<{
      id: string;
      file_name: string;
      mime_type: string;
      file_size: number;
      storage_path: string;
      created_at: string;
    }>(
      `SELECT id, file_name, mime_type, file_size, storage_path, created_at
       FROM ticket_attachments
       WHERE ticket_id = ?
       ORDER BY created_at ASC`,
      [ticketId],
    )
  ).map((item) => ({
    id: item.id,
    name: item.file_name,
    mimeType: item.mime_type,
    size: item.file_size,
    storagePath: item.storage_path,
    createdAt: item.created_at,
  }));

const loadUpdates = async (ticketId: string, includeInternal: boolean) =>
  (
    await all<{
      id: string;
      comment_number: string;
      actor_user_id: string;
      actor_role: Role;
      status: TicketStatus;
      note: string;
      is_internal: boolean;
      created_at: string;
      actor_name: string;
    }>(
      `SELECT ticket_updates.id,
              ticket_updates.comment_number,
              ticket_updates.actor_user_id,
              ticket_updates.author_role AS actor_role,
              ticket_updates.status,
              ticket_updates.note,
              ticket_updates.is_internal,
              ticket_updates.created_at,
              users.name AS actor_name
       FROM ticket_updates
       INNER JOIN users ON users.id = ticket_updates.actor_user_id
       WHERE ticket_updates.ticket_id = ?
         ${includeInternal ? "" : "AND ticket_updates.is_internal = FALSE"}
       ORDER BY ticket_updates.created_at ASC`,
      [ticketId],
    )
  ).map((item) => ({
    id: item.id,
    commentNumber: item.comment_number,
    actorUserId: item.actor_user_id,
    actorName: item.actor_name,
    authorRole: item.actor_role,
    status: item.status,
    note: item.note,
    internal: item.is_internal,
    createdAt: item.created_at,
  }));

const loadAuditLog = async (ticketId: string) =>
  (
    await all<{
      id: string;
      log_number: string;
      action: string;
      previous_value: string | null;
      new_value: string | null;
      performed_by: string;
      performed_by_name: string;
      performed_at: string;
      details_json: string | null;
    }>(
      `SELECT ticket_audit_log.id,
              ticket_audit_log.log_number,
              ticket_audit_log.action,
              ticket_audit_log.previous_value,
              ticket_audit_log.new_value,
              ticket_audit_log.performed_by,
              users.name AS performed_by_name,
              ticket_audit_log.performed_at,
              ticket_audit_log.details_json
       FROM ticket_audit_log
       INNER JOIN users ON users.id = ticket_audit_log.performed_by
       WHERE ticket_audit_log.ticket_id = ?
       ORDER BY ticket_audit_log.performed_at ASC`,
      [ticketId],
    )
  ).map((item) => ({
    id: item.id,
    logNumber: item.log_number,
    action: item.action,
    previousValue: item.previous_value,
    newValue: item.new_value,
    performedBy: item.performed_by,
    performedByName: item.performed_by_name,
    performedAt: item.performed_at,
    details: item.details_json ? JSON.parse(item.details_json) : null,
  }));

const batchLoadAttachments = async (ticketIds: string[]) => {
  if (ticketIds.length === 0) return new Map<string, Array<{ id: string; name: string; mimeType: string; size: number; storagePath: string; createdAt: string }>>();
  const rows = await all<{ id: string; ticket_id: string; file_name: string; mime_type: string; file_size: number; storage_path: string; created_at: string }>(
    `SELECT id, ticket_id, file_name, mime_type, file_size, storage_path, created_at
     FROM ticket_attachments
     WHERE ticket_id = ANY(?)
     ORDER BY created_at ASC`,
    [ticketIds],
  );
  const map = new Map<string, Array<{ id: string; name: string; mimeType: string; size: number; storagePath: string; createdAt: string }>>();
  for (const row of rows) {
    const item = { id: row.id, name: row.file_name, mimeType: row.mime_type, size: row.file_size, storagePath: row.storage_path, createdAt: row.created_at };
    const existing = map.get(row.ticket_id);
    if (existing) existing.push(item);
    else map.set(row.ticket_id, [item]);
  }
  return map;
};

const batchLoadUpdates = async (ticketIds: string[], includeInternal: boolean) => {
  if (ticketIds.length === 0) return new Map<string, Array<{ id: string; commentNumber: string; actorUserId: string; actorName: string; authorRole: Role; status: TicketStatus; note: string; internal: boolean; createdAt: string }>>();
  const rows = await all<{ id: string; ticket_id: string; comment_number: string; actor_user_id: string; actor_role: Role; status: TicketStatus; note: string; is_internal: boolean; created_at: string; actor_name: string }>(
    `SELECT ticket_updates.id,
            ticket_updates.ticket_id,
            ticket_updates.comment_number,
            ticket_updates.actor_user_id,
            ticket_updates.author_role AS actor_role,
            ticket_updates.status,
            ticket_updates.note,
            ticket_updates.is_internal,
            ticket_updates.created_at,
            users.name AS actor_name
     FROM ticket_updates
     INNER JOIN users ON users.id = ticket_updates.actor_user_id
     WHERE ticket_updates.ticket_id = ANY(?)
       ${includeInternal ? "" : "AND ticket_updates.is_internal = FALSE"}
     ORDER BY ticket_updates.created_at ASC`,
    [ticketIds],
  );
  const map = new Map<string, Array<{ id: string; commentNumber: string; actorUserId: string; actorName: string; authorRole: Role; status: TicketStatus; note: string; internal: boolean; createdAt: string }>>();
  for (const row of rows) {
    const item = { id: row.id, commentNumber: row.comment_number, actorUserId: row.actor_user_id, actorName: row.actor_name, authorRole: row.actor_role, status: row.status, note: row.note, internal: row.is_internal, createdAt: row.created_at };
    const existing = map.get(row.ticket_id);
    if (existing) existing.push(item);
    else map.set(row.ticket_id, [item]);
  }
  return map;
};

const batchLoadAuditLog = async (ticketIds: string[]) => {
  if (ticketIds.length === 0) return new Map<string, Array<{ id: string; logNumber: string; action: string; previousValue: string | null; newValue: string | null; performedBy: string; performedByName: string; performedAt: string; details: Record<string, unknown> | null }>>();
  const rows = await all<{ id: string; ticket_id: string; log_number: string; action: string; previous_value: string | null; new_value: string | null; performed_by: string; performed_by_name: string; performed_at: string; details_json: string | null }>(
    `SELECT ticket_audit_log.id,
            ticket_audit_log.ticket_id,
            ticket_audit_log.log_number,
            ticket_audit_log.action,
            ticket_audit_log.previous_value,
            ticket_audit_log.new_value,
            ticket_audit_log.performed_by,
            users.name AS performed_by_name,
            ticket_audit_log.performed_at,
            ticket_audit_log.details_json
     FROM ticket_audit_log
     INNER JOIN users ON users.id = ticket_audit_log.performed_by
     WHERE ticket_audit_log.ticket_id = ANY(?)
     ORDER BY ticket_audit_log.performed_at ASC`,
    [ticketIds],
  );
  const map = new Map<string, Array<{ id: string; logNumber: string; action: string; previousValue: string | null; newValue: string | null; performedBy: string; performedByName: string; performedAt: string; details: Record<string, unknown> | null }>>();
  for (const row of rows) {
    const item = { id: row.id, logNumber: row.log_number, action: row.action, previousValue: row.previous_value, newValue: row.new_value, performedBy: row.performed_by, performedByName: row.performed_by_name, performedAt: row.performed_at, details: row.details_json ? JSON.parse(row.details_json) : null };
    const existing = map.get(row.ticket_id);
    if (existing) existing.push(item);
    else map.set(row.ticket_id, [item]);
  }
  return map;
};

const batchMapTickets = async (tickets: TicketRow[], includeInternal: boolean) => {
  if (tickets.length === 0) return [];
  const ticketIds = tickets.map((t) => t.id);
  const [attachmentsMap, updatesMap, auditLogMap] = await Promise.all([
    batchLoadAttachments(ticketIds),
    batchLoadUpdates(ticketIds, includeInternal),
    includeInternal ? batchLoadAuditLog(ticketIds) : Promise.resolve(new Map()),
  ]);
  return tickets.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    marketId: ticket.market_id,
    marketName: ticket.market_name,
    vendorId: ticket.vendor_id,
    vendorName: ticket.vendor_name,
    assignedTo: ticket.assigned_to,
    assignedToName: ticket.assigned_to_name,
    priority: ticket.priority,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    resolution: ticket.resolution_note,
    slaDueAt: ticket.sla_due_at,
    firstResponseAt: ticket.first_response_at,
    breachedSla: isSlaBreached(ticket),
    resolvedAt: ticket.resolved_at,
    closedAt: ticket.closed_at,
    escalatedAt: ticket.escalated_at,
    escalationReason: ticket.escalation_reason,
    escalationReference: ticket.escalation_reference,
    resolutionReference: ticket.resolution_reference,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    attachments: attachmentsMap.get(ticket.id) ?? [],
    updates: updatesMap.get(ticket.id) ?? [],
    auditLog: includeInternal ? (auditLogMap.get(ticket.id) ?? []) : [],
  }));
};

const mapTicket = async (ticket: TicketRow, includeInternal = false) => ({
  id: ticket.id,
  ticketNumber: ticket.ticket_number,
  marketId: ticket.market_id,
  marketName: ticket.market_name,
  vendorId: ticket.vendor_id,
  vendorName: ticket.vendor_name,
  assignedTo: ticket.assigned_to,
  assignedToName: ticket.assigned_to_name,
  priority: ticket.priority,
  category: ticket.category,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  resolution: ticket.resolution_note,
  slaDueAt: ticket.sla_due_at,
  firstResponseAt: ticket.first_response_at,
  breachedSla: isSlaBreached(ticket),
  resolvedAt: ticket.resolved_at,
  closedAt: ticket.closed_at,
  escalatedAt: ticket.escalated_at,
  escalationReason: ticket.escalation_reason,
  escalationReference: ticket.escalation_reference,
  resolutionReference: ticket.resolution_reference,
  createdAt: ticket.created_at,
  updatedAt: ticket.updated_at,
  attachments: await loadAttachments(ticket.id),
  updates: await loadUpdates(ticket.id, includeInternal),
  auditLog: includeInternal ? await loadAuditLog(ticket.id) : [],
});

type TicketDto = Awaited<ReturnType<typeof mapTicket>>;

const getTicketByIdentifier = async (identifier: string, includeInternal = false) => {
  const ticket = await get<TicketRow>(
    `${ticketSelect}
     WHERE tickets.id = ? OR tickets.ticket_number = ?`,
    [identifier, identifier],
  );
  return ticket ? await mapTicket(ticket, includeInternal) : null;
};

const assertTicketAccess = (session: NonNullable<ReturnType<typeof resolveScopedMarket>["session"]>, ticket: TicketDto) => {
  if (session.user.role === "vendor" && ticket.vendorId !== session.user.id) {
    throw new HttpError(403, "You can only access your own tickets.");
  }
  assertMarketAccess(session, ticket.marketId);
};

const insertTicketAudit = async ({
  ticket,
  action,
  performedBy,
  previousValue,
  newValue,
  details,
  ipAddress,
}: {
  ticket: Pick<TicketDto, "id" | "ticketNumber">;
  action: string;
  performedBy: string;
  previousValue?: string | null;
  newValue?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) => {
  const logNumber = await generateTicketChildReference(ticket.ticketNumber, "A");
  await run(
    `INSERT INTO ticket_audit_log (
       id, ticket_id, ticket_number, log_number, action, previous_value, new_value, performed_by, performed_at, ip_address, details_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::inet, ?)`,
    [
      createId("ticket_audit"),
      ticket.id,
      ticket.ticketNumber,
      logNumber,
      action,
      previousValue || null,
      newValue || null,
      performedBy,
      nowIso(),
      ipAddress || null,
      details ? JSON.stringify(details) : null,
    ],
  );
  return logNumber;
};

const insertTicketUpdate = async ({
  ticket,
  actorUserId,
  actorRole,
  status,
  note,
  internal = false,
}: {
  ticket: Pick<TicketDto, "id" | "ticketNumber">;
  actorUserId: string;
  actorRole: Role;
  status: TicketStatus;
  note: string;
  internal?: boolean;
}) => {
  const commentNumber = await generateTicketChildReference(ticket.ticketNumber, "C");
  await run(
    `INSERT INTO ticket_updates (id, ticket_id, actor_user_id, author_role, status, note, comment_number, is_internal, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId("ticket_update"), ticket.id, actorUserId, actorRole, status, note, commentNumber, internal, nowIso()],
  );
  return commentNumber;
};

const allowedTicketTransitions: Record<TicketStatus, TicketStatus[]> = {
  open: ["open", "in_progress", "closed"],
  in_progress: ["in_progress", "resolved", "closed"],
  resolved: ["resolved", "closed"],
  closed: ["closed"],
};

const ticketStatusLabel = (status: TicketStatus) => status.replace("_", " ");

const updateTicketLifecycle = async ({
  ticket,
  session,
  status,
  note,
  resolutionNote,
  internalNote,
  assignedTo,
  assignmentReason,
  ipAddress,
}: {
  ticket: TicketDto;
  session: NonNullable<ReturnType<typeof resolveScopedMarket>["session"]>;
  status: TicketStatus;
  note?: string;
  resolutionNote?: string;
  internalNote?: boolean;
  assignedTo?: string | null;
  assignmentReason?: string | null;
  ipAddress?: string | null;
}) => {
  if (!allowedTicketTransitions[ticket.status].includes(status)) {
    throw new HttpError(409, `Complaints must move sequentially from ${ticketStatusLabel(ticket.status)} before reaching ${ticketStatusLabel(status)}.`);
  }

  const finalResolutionNote = resolutionNote?.trim() || ticket.resolution || null;
  if ((status === "resolved" || status === "closed") && !finalResolutionNote) {
    throw new HttpError(400, "A resolution note is required before resolving or closing a complaint.");
  }

  const timestamp = nowIso();
  const nextAssignee = assignedTo ?? (status === "in_progress" && !ticket.assignedTo ? session.user.id : ticket.assignedTo);
  const firstResponseAt = ticket.firstResponseAt || (session.user.role !== "vendor" ? timestamp : null);
  const resolutionReference = status === "resolved" || status === "closed" ? ticket.resolutionReference || getResolutionReference(ticket.ticketNumber) : ticket.resolutionReference;
  const resolvedAt = status === "resolved" || status === "closed" ? ticket.resolvedAt || timestamp : ticket.resolvedAt;
  const closedAt = status === "closed" ? ticket.closedAt || timestamp : ticket.closedAt;
  const breachedSla = status === "resolved" || status === "closed" ? ticket.breachedSla : isSlaBreached(ticket);
  const updateNote =
    note?.trim() ||
    resolutionNote?.trim() ||
    (status !== ticket.status ? `Status changed to ${ticketStatusLabel(status)}.` : "Ticket updated.");

  await run(
    `UPDATE tickets
     SET status = ?,
         assigned_to = ?,
         resolution_note = ?,
         first_response_at = ?,
         breached_sla = ?,
         resolved_at = ?,
         closed_at = ?,
         resolved_by = CASE WHEN ? IN ('resolved', 'closed') THEN ? ELSE resolved_by END,
         resolution_reference = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      status,
      nextAssignee,
      finalResolutionNote,
      firstResponseAt,
      breachedSla,
      resolvedAt,
      closedAt,
      status,
      session.user.id,
      resolutionReference,
      timestamp,
      ticket.id,
    ],
  );

  await insertTicketUpdate({
    ticket,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    status,
    note: updateNote,
    internal: Boolean(internalNote),
  });

  await insertTicketAudit({
    ticket,
    action: status !== ticket.status ? "status_changed" : "updated",
    performedBy: session.user.id,
    previousValue: ticket.status,
    newValue: status,
    details: { note: updateNote, assignedTo: nextAssignee, resolutionReference },
    ipAddress,
  });

  if (nextAssignee && nextAssignee !== ticket.assignedTo) {
    await run(
      `INSERT INTO ticket_assignments (
         id, ticket_id, ticket_number, previous_assignee_id, new_assignee_id, assigned_by, reason, assigned_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("ticket_assignment"),
        ticket.id,
        ticket.ticketNumber,
        ticket.assignedTo,
        nextAssignee,
        session.user.id,
        assignmentReason?.trim() || "Assigned through ticket status workflow.",
        timestamp,
      ],
    );

    await insertTicketAudit({
      ticket,
      action: "assigned",
      performedBy: session.user.id,
      previousValue: ticket.assignedTo,
      newValue: nextAssignee,
      details: { reason: assignmentReason || null },
      ipAddress,
    });
  }

  return await getTicketByIdentifier(ticket.ticketNumber, true);
};

const notifyVendorForTicketUpdate = async (ticket: TicketDto, previousStatus: TicketStatus, nextStatus: TicketStatus) => {
  const vendorNotification = getVendorTicketNotification({
    previousStatus,
    nextStatus,
    subject: ticket.subject,
    ticketNumber: ticket.ticketNumber,
  });

  await queueNotification({
    userId: ticket.vendorId,
    type: "complaint",
    message: vendorNotification.message,
    channels: vendorNotification.channels,
    destinationPhone: vendorNotification.channels.includes("sms")
      ? (await get<{ phone: string }>(`SELECT phone FROM users WHERE id = ?`, [ticket.vendorId]))?.phone
      : undefined,
  });
};

export const ticketRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/tickets/search",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "ticket:read", url.searchParams.get("marketId"));
      const query = url.searchParams.get("q")?.trim().toLowerCase() || "";
      const status = url.searchParams.get("status");
      const category = url.searchParams.get("category");
      const priority = url.searchParams.get("priority");
      const escalated = url.searchParams.get("escalated");
      const sla = url.searchParams.get("sla");
      const clauses: string[] = [];
      const params: Array<string | boolean> = [];

      if (marketId) {
        clauses.push("tickets.market_id = ?");
        params.push(marketId);
      }
      if (session.user.role === "vendor") {
        clauses.push("tickets.vendor_id = ?");
        params.push(session.user.id);
      }
      if (query) {
        clauses.push(
          `(LOWER(tickets.ticket_number) LIKE ? OR LOWER(tickets.subject) LIKE ? OR LOWER(tickets.description) LIKE ? OR LOWER(vendors.name) LIKE ?)`,
        );
        params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      }
      if (status && status !== "all") {
        clauses.push("tickets.status = ?");
        params.push(status);
      }
      if (category && category !== "all") {
        clauses.push("tickets.category = ?");
        params.push(category);
      }
      if (priority && priority !== "all") {
        clauses.push("tickets.priority = ?");
        params.push(priority);
      }
      if (escalated === "true") {
        clauses.push("tickets.escalated_at IS NOT NULL");
      }
      if (sla === "breached") {
        clauses.push("(tickets.breached_sla = TRUE OR (tickets.sla_due_at < NOW() AND tickets.status NOT IN ('resolved', 'closed')))");
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const tickets = await all<TicketRow>(
        `${ticketSelect}
         ${whereClause}
         ORDER BY
           CASE tickets.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             ELSE 4
           END,
           tickets.updated_at DESC`,
        params,
      );
      sendJson(res, 200, { tickets: await batchMapTickets(tickets, session.user.role !== "vendor") });
    },
  },
  {
    method: "GET",
    path: "/tickets",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "ticket:read", url.searchParams.get("marketId"));
      const clauses: string[] = [];
      const params: string[] = [];

      if (marketId) {
        clauses.push("tickets.market_id = ?");
        params.push(marketId);
      }
      if (session.user.role === "vendor") {
        clauses.push("tickets.vendor_id = ?");
        params.push(session.user.id);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const tickets = await all<TicketRow>(
        `${ticketSelect}
         ${whereClause}
         ORDER BY
           CASE
             WHEN tickets.breached_sla = TRUE THEN 0
             WHEN tickets.escalated_at IS NOT NULL THEN 1
             ELSE 2
           END,
           CASE tickets.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             ELSE 4
           END,
           tickets.updated_at DESC`,
        params,
      );
      sendJson(res, 200, { tickets: await batchMapTickets(tickets, session.user.role !== "vendor") });
    },
  },
  {
    method: "POST",
    path: "/tickets",
    handler: async ({ req, res, auth }) => {
      const { session, marketId } = resolveScopedMarket(auth, "ticket:create");
      if (session.user.role !== "vendor") {
        throw new HttpError(403, "Only vendors can create tickets.");
      }
      if (!marketId) {
        throw new HttpError(403, "Your account is not assigned to a market.");
      }

      const body = await readJsonBody<{
        category: TicketCategory;
        subject: string;
        description: string;
        priority?: TicketPriority;
        attachment?: FilePayload | null;
      }>(req);
      if (!body.category || !body.subject?.trim() || !body.description?.trim()) {
        throw new HttpError(400, "Category, subject, and description are required.");
      }
      assertMaxLength(body.subject, MAX_SUBJECT_LENGTH, "Subject");
      assertMaxLength(body.description, MAX_DESCRIPTION_LENGTH, "Description");
      body.subject = sanitizeText(body.subject?.trim());
      body.description = sanitizeText(body.description?.trim());

      validateFilePayload(body.attachment, ["application/pdf", "image/jpeg", "image/png"], false);

      const ticket = await transaction(async () => {
        const ticketId = createId("ticket");
        const ticketNumber = await generateTicketNumber();
        const timestamp = nowIso();
        const priority = inferPriority(body.category, body.priority);
        const slaDueAt = addHours(timestamp, prioritySlaHours[priority]);
        const ipAddress = getRequestIp(req);
        const userAgent = req.headers["user-agent"] || null;

        await run(
          `INSERT INTO tickets (
             id, ticket_number, market_id, vendor_id, category, subject, description, status, priority,
             resolution_note, sla_due_at, breached_sla, ip_address, user_agent, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, FALSE, ?::inet, ?, ?, ?)`,
          [
            ticketId,
            ticketNumber,
            marketId,
            session.user.id,
            body.category,
            body.subject.trim(),
            body.description.trim(),
            priority,
            slaDueAt,
            ipAddress,
            typeof userAgent === "string" ? userAgent : null,
            timestamp,
            timestamp,
          ],
        );

        const createdTicket = (await getTicketByIdentifier(ticketNumber, true))!;
        await insertTicketUpdate({
          ticket: createdTicket,
          actorUserId: session.user.id,
          actorRole: session.user.role,
          status: "open",
          note: `Ticket ${ticketNumber} created by vendor.`,
        });
        await insertTicketAudit({
          ticket: createdTicket,
          action: "created",
          performedBy: session.user.id,
          newValue: "open",
          details: { category: body.category, subject: body.subject.trim(), priority, slaDueAt },
          ipAddress,
        });

        if (body.attachment) {
          const file = await persistFilePayload("ticket-attachments", ticketId, body.attachment);
          await run(
            `INSERT INTO ticket_attachments (id, ticket_id, file_name, mime_type, file_size, storage_path, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [createId("ticket_file"), ticketId, file.name, file.mimeType, file.size, file.storagePath, timestamp],
          );
        }

        return (await getTicketByIdentifier(ticketNumber, true))!;
      });

      const marketManager = await getManagerForMarket(marketId);
      if (marketManager) {
        await queueNotification({
          userId: marketManager.id,
          type: "complaint",
          message: `${ticket.ticketNumber}: ${session.user.name} created a new ${body.category} complaint.`,
          channels: getTicketCreationManagerChannels(),
        });
      }
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_TICKET",
        entityType: "ticket",
        entityId: ticket.ticketNumber,
        details: { ticketNumber: ticket.ticketNumber, category: body.category, subject: body.subject },
      });

      sendJson(res, 201, {
        ticket,
        message: `Ticket ${ticket.ticketNumber} has been created. You will receive updates as it progresses.`,
      });
    },
  },
  {
    method: "GET",
    path: "/tickets/:ticketNumber",
    handler: async ({ res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:read");
      const ticket = await getTicketByIdentifier(params.ticketNumber, session.user.role !== "vendor");
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertTicketAccess(session, ticket);
      sendJson(res, 200, { ticket });
    },
  },
  {
    method: "POST",
    path: "/tickets/:ticketNumber/comments",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:update");
      const ticket = await getTicketByIdentifier(params.ticketNumber, true);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertTicketAccess(session, ticket);

      const body = await readJsonBody<{ message?: string; internal?: boolean }>(req);
      const message = sanitizeText(body.message?.trim());
      if (!message) {
        throw new HttpError(400, "A comment message is required.");
      }
      assertMaxLength(message, MAX_MESSAGE_LENGTH, "Comment message");
      const internal = session.user.role !== "vendor" && Boolean(body.internal);

      await transaction(async () => {
        if (session.user.role !== "vendor" && !ticket.firstResponseAt) {
          await run(`UPDATE tickets SET first_response_at = ?, updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), ticket.id]);
        } else {
          await run(`UPDATE tickets SET updated_at = ? WHERE id = ?`, [nowIso(), ticket.id]);
        }
        await insertTicketUpdate({
          ticket,
          actorUserId: session.user.id,
          actorRole: session.user.role,
          status: ticket.status,
          note: message,
          internal,
        });
        await insertTicketAudit({
          ticket,
          action: internal ? "internal_note_added" : "commented",
          performedBy: session.user.id,
          details: { internal },
          ipAddress: getRequestIp(req),
        });
      });

      if (session.user.role !== "vendor" && !internal) {
        await notifyVendorForTicketUpdate(ticket, ticket.status, ticket.status);
      }

      sendJson(res, 201, { ticket: await getTicketByIdentifier(ticket.ticketNumber, session.user.role !== "vendor") });
    },
  },
  {
    method: "PUT",
    path: "/tickets/:ticketNumber/status",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:update");
      const ticket = await getTicketByIdentifier(params.ticketNumber, true);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertTicketAccess(session, ticket);

      const body = await readJsonBody<{
        status?: TicketStatus;
        resolutionNote?: string;
        note?: string;
        internal?: boolean;
        assignedTo?: string | null;
        assignmentReason?: string | null;
      }>(req);
      if (!body.status) {
        throw new HttpError(400, "A ticket status is required.");
      }
      body.note = sanitizeText(body.note?.trim()) || undefined;
      body.resolutionNote = sanitizeText(body.resolutionNote?.trim()) || undefined;
      body.assignmentReason = sanitizeText(body.assignmentReason?.trim()) || undefined;
      assertMaxLength(body.resolutionNote, MAX_NOTE_LENGTH, "Resolution note");
      assertMaxLength(body.note, MAX_MESSAGE_LENGTH, "Status update note");
      assertMaxLength(body.assignmentReason, MAX_REASON_LENGTH, "Assignment reason");

      const updatedTicket = await transaction(async () =>
        updateTicketLifecycle({
          ticket,
          session,
          status: body.status!,
          note: body.note,
          resolutionNote: body.resolutionNote,
          internalNote: body.internal,
          assignedTo: body.assignedTo,
          assignmentReason: body.assignmentReason,
          ipAddress: getRequestIp(req),
        }),
      );

      if (body.status !== ticket.status || !body.internal) {
        await notifyVendorForTicketUpdate(ticket, ticket.status, body.status);
      }
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: ticket.marketId,
        action: "UPDATE_TICKET",
        entityType: "ticket",
        entityId: ticket.ticketNumber,
        details: { previousStatus: ticket.status, status: body.status, ticketNumber: ticket.ticketNumber },
      });

      sendJson(res, 200, { ticket: updatedTicket });
    },
  },
  {
    method: "PUT",
    path: "/tickets/:ticketNumber/resolve",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:update");
      const ticket = await getTicketByIdentifier(params.ticketNumber, true);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertTicketAccess(session, ticket);

      const body = await readJsonBody<{ resolutionNote?: string; note?: string }>(req);
      body.note = sanitizeText(body.note?.trim()) || undefined;
      body.resolutionNote = sanitizeText(body.resolutionNote?.trim()) || undefined;
      assertMaxLength(body.resolutionNote, MAX_NOTE_LENGTH, "Resolution note");
      assertMaxLength(body.note, MAX_MESSAGE_LENGTH, "Resolution note");
      const updatedTicket = await transaction(async () =>
        updateTicketLifecycle({
          ticket,
          session,
          status: "resolved",
          resolutionNote: body.resolutionNote,
          note: body.note,
          ipAddress: getRequestIp(req),
        }),
      );

      await notifyVendorForTicketUpdate(ticket, ticket.status, "resolved");
      sendJson(res, 200, { ticket: updatedTicket });
    },
  },
  {
    method: "POST",
    path: "/tickets/:ticketNumber/escalate",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:update");
      const ticket = await getTicketByIdentifier(params.ticketNumber, true);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertTicketAccess(session, ticket);

      const body = await readJsonBody<{ reason?: string; escalatedTo?: string | null }>(req);
      const reason = sanitizeText(body.reason?.trim()) || "Complaint requires senior operational review.";
      assertMaxLength(reason, MAX_REASON_LENGTH, "Escalation reason");
      const escalationReference = getEscalationReference(ticket.ticketNumber);
      const official =
        body.escalatedTo ||
        (
          await get<{ id: string }>(
            `SELECT id
             FROM users
             WHERE role = 'official'
               AND (market_id = ? OR market_id IS NULL)
             ORDER BY market_id NULLS LAST, created_at DESC
             LIMIT 1`,
            [ticket.marketId],
          )
        )?.id ||
        null;

      const updatedTicket = await transaction(async () => {
        await run(
          `UPDATE tickets
           SET escalated_at = COALESCE(escalated_at, ?),
               escalation_reason = ?,
               escalation_reference = ?,
               priority = 'urgent',
               breached_sla = TRUE,
               updated_at = ?
           WHERE id = ?`,
          [nowIso(), reason, escalationReference, nowIso(), ticket.id],
        );
        await run(
          `INSERT INTO ticket_escalations (
             id, ticket_id, ticket_number, escalation_reference, escalated_from, escalated_to, escalated_by, reason, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (escalation_reference) DO NOTHING`,
          [
            createId("ticket_escalation"),
            ticket.id,
            ticket.ticketNumber,
            escalationReference,
            ticket.assignedTo,
            official,
            session.user.id,
            reason,
            nowIso(),
          ],
        );
        await insertTicketUpdate({
          ticket,
          actorUserId: session.user.id,
          actorRole: session.user.role,
          status: ticket.status,
          note: `${escalationReference}: ${reason}`,
          internal: true,
        });
        await insertTicketAudit({
          ticket,
          action: "escalated",
          performedBy: session.user.id,
          previousValue: ticket.priority,
          newValue: "urgent",
          details: { escalationReference, reason, escalatedTo: official },
          ipAddress: getRequestIp(req),
        });
        return await getTicketByIdentifier(ticket.ticketNumber, true);
      });

      if (official) {
        await queueNotification({
          userId: official,
          type: "complaint",
          message: `URGENT: ${ticket.ticketNumber} has been escalated for official review.`,
          channels: ["system", "sms"],
          destinationPhone: (await get<{ phone: string }>(`SELECT phone FROM users WHERE id = ?`, [official]))?.phone,
        });
      }
      await queueNotification({
        userId: ticket.vendorId,
        type: "complaint",
        message: `${ticket.ticketNumber}: Your complaint has been escalated for senior review.`,
        channels: ["system", "sms"],
        destinationPhone: (await get<{ phone: string }>(`SELECT phone FROM users WHERE id = ?`, [ticket.vendorId]))?.phone,
      });

      sendJson(res, 200, { ticket: updatedTicket });
    },
  },
  {
    method: "PATCH",
    path: "/tickets/:id",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:update");
      const ticket = await getTicketByIdentifier(params.id, true);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertTicketAccess(session, ticket);

      const body = await readJsonBody<{ status?: TicketStatus; resolutionNote?: string; note?: string }>(req);
      body.note = sanitizeText(body.note?.trim()) || undefined;
      body.resolutionNote = sanitizeText(body.resolutionNote?.trim()) || undefined;
      assertMaxLength(body.resolutionNote, MAX_NOTE_LENGTH, "Resolution note");
      assertMaxLength(body.note, MAX_MESSAGE_LENGTH, "Update note");
      const status = body.status || ticket.status;
      const updatedTicket = await transaction(async () =>
        updateTicketLifecycle({
          ticket,
          session,
          status,
          note: body.note,
          resolutionNote: body.resolutionNote,
          ipAddress: getRequestIp(req),
        }),
      );

      await notifyVendorForTicketUpdate(ticket, ticket.status, status);
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: ticket.marketId,
        action: "UPDATE_TICKET",
        entityType: "ticket",
        entityId: ticket.ticketNumber,
        details: { previousStatus: ticket.status, status, note: body.note, ticketNumber: ticket.ticketNumber },
      });

      sendJson(res, 200, { ticket: updatedTicket });
    },
  },
];
