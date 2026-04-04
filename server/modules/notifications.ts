import { all, get, run } from "../lib/db.ts";
import { HttpError, sendJson, type RouteDefinition } from "../lib/http.ts";
import { requirePermission } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";
import { sendSmsDelivery } from "../lib/sms.ts";
import { config } from "../config.ts";

const mapNotification = (row: {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  message: row.message,
  read: Boolean(row.read_at),
  readAt: row.read_at,
  createdAt: row.created_at,
});

export const processNotificationDeliveries = async () => {
  const deliveries = await all<{
    id: string;
    destination: string;
    channel: string;
    status: string;
    attempts: number;
    next_attempt_at: string;
    message: string;
  }>(
    `SELECT notification_deliveries.id,
            notification_deliveries.destination,
            notification_deliveries.channel,
            notification_deliveries.status,
            notification_deliveries.attempts,
            notification_deliveries.next_attempt_at,
            notifications.message
     FROM notification_deliveries
     INNER JOIN notifications ON notifications.id = notification_deliveries.notification_id
     WHERE notification_deliveries.status = 'pending'`,
  );

  for (const delivery of deliveries) {
    if (new Date(delivery.next_attempt_at).getTime() > Date.now()) {
      continue;
    }

    const attempts = delivery.attempts + 1;
    const timestamp = nowIso();
    try {
      if (delivery.channel === "sms") {
        await sendSmsDelivery(delivery.destination, delivery.message, config);
      } else {
        console.log(`[delivery:${delivery.channel}:fallback]`, delivery.destination, delivery.message);
      }
      await run(
        `UPDATE notification_deliveries
         SET status = 'sent',
             attempts = ?,
             updated_at = ?,
             last_error = NULL
         WHERE id = ?`,
        [attempts, timestamp, delivery.id],
      );
    } catch (error) {
      const exhausted = attempts > config.notificationRetryCount;
      await run(
        `UPDATE notification_deliveries
         SET status = ?,
             attempts = ?,
             next_attempt_at = ?,
             updated_at = ?,
             last_error = ?
         WHERE id = ?`,
        [
          exhausted ? "failed" : "pending",
          attempts,
          new Date(Date.now() + attempts * 60_000).toISOString(),
          timestamp,
          error instanceof Error ? error.message : "Unknown delivery error",
          delivery.id,
        ],
      );
    }
  }
};

export const notificationRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/notifications",
    handler: async ({ res, auth, url }) => {
      const session = requirePermission(auth, "notification:read");
      const limit = Number(url.searchParams.get("limit") || 0);
      const notifications = await all<{
        id: string;
        user_id: string;
        type: string;
        message: string;
        read_at: string | null;
        created_at: string;
      }>(
        `SELECT id, user_id, type, message, read_at, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         ${limit > 0 ? `LIMIT ${limit}` : ""}`,
        [session.user.id],
      );
      sendJson(res, 200, { notifications: notifications.map(mapNotification) });
    },
  },
  {
    method: "PATCH",
    path: "/notifications/:id/read",
    handler: async ({ res, auth, params }) => {
      const session = requirePermission(auth, "notification:update");
      const notification = await get<{ id: string }>(
        `SELECT id FROM notifications WHERE id = ? AND user_id = ?`,
        [params.id, session.user.id],
      );
      if (!notification) {
        throw new HttpError(404, "Notification not found.");
      }
      await run(`UPDATE notifications SET read_at = ? WHERE id = ?`, [nowIso(), params.id]);
      sendJson(res, 200, { ok: true });
    },
  },
];
