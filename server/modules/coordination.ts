import { all, createId, get, logAuditEvent, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";

const mapMessage = (row: {
  id: string;
  sender_user_id: string;
  sender_name: string;
  sender_role: "manager" | "official" | "admin";
  market_id: string | null;
  market_name: string | null;
  subject: string;
  body: string;
  created_at: string;
}) => ({
  id: row.id,
  senderUserId: row.sender_user_id,
  senderName: row.sender_name,
  senderRole: row.sender_role,
  marketId: row.market_id,
  marketName: row.market_name,
  subject: row.subject,
  body: row.body,
  createdAt: row.created_at,
});

export const coordinationRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/coordination/messages",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "coordination:read", url.searchParams.get("marketId"));
      if (!["manager", "official", "admin"].includes(session.user.role)) {
        throw new HttpError(403, "Only managers, officials, and admins can access coordination messages.");
      }

      const messages = await all<{
        id: string;
        sender_user_id: string;
        sender_name: string;
        sender_role: "manager" | "official" | "admin";
        market_id: string | null;
        market_name: string | null;
        subject: string;
        body: string;
        created_at: string;
      }>(
        `SELECT coordination_messages.id,
                coordination_messages.sender_user_id,
                coordination_messages.sender_name,
                coordination_messages.sender_role,
                coordination_messages.market_id,
                markets.name AS market_name,
                coordination_messages.subject,
                coordination_messages.body,
                coordination_messages.created_at
         FROM coordination_messages
         LEFT JOIN markets ON markets.id = coordination_messages.market_id
         WHERE (? IS NULL OR coordination_messages.market_id = ? OR coordination_messages.market_id IS NULL)
         ORDER BY coordination_messages.created_at DESC`,
        [marketId, marketId],
      );

      sendJson(res, 200, { messages: messages.map(mapMessage) });
    },
  },
  {
    method: "POST",
    path: "/coordination/messages",
    handler: async ({ req, res, auth }) => {
      const { session } = resolveScopedMarket(auth, "coordination:write");
      if (!["manager", "official", "admin"].includes(session.user.role)) {
        throw new HttpError(403, "Only managers, officials, and admins can send coordination messages.");
      }

      const body = await readJsonBody<{ subject?: string; body?: string; marketId?: string | null }>(req);
      const subject = body.subject?.trim();
      const messageBody = body.body?.trim();

      if (!subject || !messageBody) {
        throw new HttpError(400, "Subject and message body are required.");
      }

      const marketId =
        session.user.role === "official" || session.user.role === "admin"
          ? body.marketId?.trim() || null
          : session.user.marketId;

      if (marketId) {
        const market = await get<{ id: string }>(`SELECT id FROM markets WHERE id = ?`, [marketId]);
        if (!market) {
          throw new HttpError(400, "Selected market is invalid.");
        }
      }

      const messageId = createId("coordination");
      const timestamp = nowIso();
      await run(
        `INSERT INTO coordination_messages (id, sender_user_id, sender_name, sender_role, market_id, subject, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [messageId, session.user.id, session.user.name, session.user.role, marketId, subject, messageBody, timestamp],
      );

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "POST_COORDINATION_MESSAGE",
        entityType: "coordination_message",
        entityId: messageId,
        details: { subject },
      });

      const created = await get<{
        id: string;
        sender_user_id: string;
        sender_name: string;
        sender_role: "manager" | "official" | "admin";
        market_id: string | null;
        market_name: string | null;
        subject: string;
        body: string;
        created_at: string;
      }>(
        `SELECT coordination_messages.id,
                coordination_messages.sender_user_id,
                coordination_messages.sender_name,
                coordination_messages.sender_role,
                coordination_messages.market_id,
                markets.name AS market_name,
                coordination_messages.subject,
                coordination_messages.body,
                coordination_messages.created_at
         FROM coordination_messages
         LEFT JOIN markets ON markets.id = coordination_messages.market_id
         WHERE coordination_messages.id = ?`,
        [messageId],
      );

      sendJson(res, 201, { message: created ? mapMessage(created) : null });
    },
  },
];
