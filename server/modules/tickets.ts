import { all, createId, get, getManagerForMarket, logAuditEvent, queueNotification, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";
import { persistFilePayload, validateFilePayload } from "../lib/storage.ts";
import type { FilePayload } from "../types.ts";

const loadAttachments = (ticketId: string) =>
  all<{
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
  ).map((item) => ({
    id: item.id,
    name: item.file_name,
    mimeType: item.mime_type,
    size: item.file_size,
    storagePath: item.storage_path,
    createdAt: item.created_at,
  }));

const loadUpdates = (ticketId: string) =>
  all<{
    id: string;
    actor_user_id: string;
    status: string;
    note: string;
    created_at: string;
    actor_name: string;
  }>(
    `SELECT ticket_updates.id, ticket_updates.actor_user_id, ticket_updates.status, ticket_updates.note, ticket_updates.created_at, users.name AS actor_name
     FROM ticket_updates
     INNER JOIN users ON users.id = ticket_updates.actor_user_id
     WHERE ticket_updates.ticket_id = ?
     ORDER BY ticket_updates.created_at ASC`,
    [ticketId],
  ).map((item) => ({
    id: item.id,
    actorUserId: item.actor_user_id,
    actorName: item.actor_name,
    status: item.status,
    note: item.note,
    createdAt: item.created_at,
  }));

const mapTicket = (ticket: {
  id: string;
  market_id: string | null;
  market_name: string | null;
  vendor_id: string;
  vendor_name: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}) => ({
  id: ticket.id,
  marketId: ticket.market_id,
  marketName: ticket.market_name,
  vendorId: ticket.vendor_id,
  vendorName: ticket.vendor_name,
  category: ticket.category,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  resolution: ticket.resolution_note,
  createdAt: ticket.created_at,
  updatedAt: ticket.updated_at,
  attachments: loadAttachments(ticket.id),
  updates: loadUpdates(ticket.id),
});

const getTicketById = (ticketId: string) => {
  const ticket = get<{
    id: string;
    market_id: string | null;
    market_name: string | null;
    vendor_id: string;
    vendor_name: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    resolution_note: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT tickets.id,
            tickets.market_id,
            markets.name AS market_name,
            tickets.vendor_id,
            users.name AS vendor_name,
            tickets.category,
            tickets.subject,
            tickets.description,
            tickets.status,
            tickets.resolution_note,
            tickets.created_at,
            tickets.updated_at
     FROM tickets
     INNER JOIN users ON users.id = tickets.vendor_id
     LEFT JOIN markets ON markets.id = tickets.market_id
     WHERE tickets.id = ?`,
    [ticketId],
  );
  return ticket ? mapTicket(ticket) : null;
};

export const ticketRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/tickets",
    handler: ({ res, auth, url }) => {
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
      const tickets = all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        vendor_id: string;
        vendor_name: string;
        category: string;
        subject: string;
        description: string;
        status: string;
        resolution_note: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT tickets.id,
                tickets.market_id,
                markets.name AS market_name,
                tickets.vendor_id,
                users.name AS vendor_name,
                tickets.category,
                tickets.subject,
                tickets.description,
                tickets.status,
                tickets.resolution_note,
                tickets.created_at,
                tickets.updated_at
         FROM tickets
         INNER JOIN users ON users.id = tickets.vendor_id
         LEFT JOIN markets ON markets.id = tickets.market_id
         ${whereClause}
         ORDER BY tickets.updated_at DESC`,
        params,
      );
      sendJson(res, 200, { tickets: tickets.map(mapTicket) });
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
        category: string;
        subject: string;
        description: string;
        attachment?: FilePayload | null;
      }>(req);
      if (!body.category || !body.subject || !body.description) {
        throw new HttpError(400, "Category, subject, and description are required.");
      }

      validateFilePayload(body.attachment, ["application/pdf", "image/jpeg", "image/png"], false);

      const ticketId = createId("ticket");
      const timestamp = nowIso();
      run(
        `INSERT INTO tickets (id, market_id, vendor_id, category, subject, description, status, resolution_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?)`,
        [ticketId, marketId, session.user.id, body.category, body.subject.trim(), body.description.trim(), timestamp, timestamp],
      );
      run(
        `INSERT INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
         VALUES (?, ?, ?, 'open', ?, ?)`,
        [createId("ticket_update"), ticketId, session.user.id, "Ticket created by vendor.", timestamp],
      );

      if (body.attachment) {
        const file = persistFilePayload("ticket-attachments", ticketId, body.attachment);
        run(
          `INSERT INTO ticket_attachments (id, ticket_id, file_name, mime_type, file_size, storage_path, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [createId("ticket_file"), ticketId, file.name, file.mimeType, file.size, file.storagePath, timestamp],
        );
      }

      const marketManager = getManagerForMarket(marketId);
      if (marketManager) {
        queueNotification({
          userId: marketManager.id,
          type: "complaint",
          message: `${session.user.name} created a new ${body.category} ticket.`,
          channels: ["system", "sms"],
          destinationPhone: marketManager.phone,
        });
      }
      logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_TICKET",
        entityType: "ticket",
        entityId: ticketId,
        details: { category: body.category, subject: body.subject },
      });

      sendJson(res, 201, { ticket: getTicketById(ticketId) });
    },
  },
  {
    method: "PATCH",
    path: "/tickets/:id",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "ticket:update");
      const ticket = getTicketById(params.id);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found.");
      }
      assertMarketAccess(session, ticket.marketId);

      const body = await readJsonBody<{ status?: string; resolutionNote?: string; note?: string }>(req);
      const status = body.status || ticket.status;
      const note = body.note?.trim() || body.resolutionNote?.trim() || "Ticket updated by manager.";
      const timestamp = nowIso();

      run(
        `UPDATE tickets
         SET status = ?, resolution_note = ?, updated_at = ?
         WHERE id = ?`,
        [status, body.resolutionNote?.trim() || ticket.resolution, timestamp, params.id],
      );
      run(
        `INSERT INTO ticket_updates (id, ticket_id, actor_user_id, status, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [createId("ticket_update"), params.id, session.user.id, status, note, timestamp],
      );

      queueNotification({
        userId: ticket.vendorId,
        type: "complaint",
        message: `Your ticket "${ticket.subject}" is now ${status.replace("_", " ")}.`,
        channels: ["system", "sms"],
        destinationPhone: get<{ phone: string }>(`SELECT phone FROM users WHERE id = ?`, [ticket.vendorId])?.phone,
      });
      logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: ticket.marketId,
        action: "UPDATE_TICKET",
        entityType: "ticket",
        entityId: params.id,
        details: { status, note },
      });

      sendJson(res, 200, { ticket: getTicketById(params.id) });
    },
  },
];
