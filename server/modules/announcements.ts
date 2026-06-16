import { all, createId, get, logAuditEvent, queueNotification, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { requirePermission } from "../lib/session.ts";
import { assertMaxLength, sanitizeText } from "../lib/text-utils.ts";
import { nowIso } from "../lib/security.ts";
import type { Role } from "../types.ts";

type AnnouncementPriority = "low" | "normal" | "high";
type AnnouncementAudience = "all" | "vendors" | "staff";
type AnnouncementCreatorRole = Extract<Role, "manager" | "official" | "admin">;

const priorities = new Set<AnnouncementPriority>(["low", "normal", "high"]);
const audiences = new Set<AnnouncementAudience>(["all", "vendors", "staff"]);

const mapAnnouncement = (row: {
  id: string;
  market_id: string | null;
  market_name: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  created_by: string | null;
  created_by_name: string;
  created_by_role: AnnouncementCreatorRole;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}) => ({
  id: row.id,
  marketId: row.market_id,
  marketName: row.market_name,
  title: row.title,
  body: row.body,
  priority: row.priority,
  audience: row.audience,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdByRole: row.created_by_role,
  expiresAt: row.expires_at,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  active:
    !row.archived_at &&
    (!row.expires_at || new Date(row.expires_at).getTime() > Date.now()),
});

const selectAnnouncementSql = `
  SELECT announcements.id,
         announcements.market_id,
         markets.name AS market_name,
         announcements.title,
         announcements.body,
         announcements.priority,
         announcements.audience,
         announcements.created_by,
         announcements.created_by_name,
         announcements.created_by_role,
         announcements.expires_at,
         announcements.archived_at,
         announcements.created_at,
         announcements.updated_at
  FROM announcements
  LEFT JOIN markets ON markets.id = announcements.market_id
`;

const ensureMarketExists = async (marketId: string) => {
  const market = await get<{ id: string }>(`SELECT id FROM markets WHERE id = ?`, [marketId]);
  if (!market) {
    throw new HttpError(400, "Selected market is invalid.");
  }
};

const getAnnouncementById = async (announcementId: string) =>
  get<{
    id: string;
    market_id: string | null;
    market_name: string | null;
    title: string;
    body: string;
    priority: AnnouncementPriority;
    audience: AnnouncementAudience;
    created_by: string | null;
    created_by_name: string;
    created_by_role: AnnouncementCreatorRole;
    expires_at: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
  }>(`${selectAnnouncementSql} WHERE announcements.id = ?`, [announcementId]);

const getRecipientRoles = (audience: AnnouncementAudience): Role[] => {
  if (audience === "vendors") return ["vendor"];
  if (audience === "staff") return ["manager", "official", "admin"];
  return ["vendor", "manager", "official", "admin"];
};

const notifyAnnouncementRecipients = async ({
  actorUserId,
  announcementId,
  title,
  priority,
  audience,
  marketId,
}: {
  actorUserId: string;
  announcementId: string;
  title: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  marketId: string | null;
}) => {
  const roles = getRecipientRoles(audience);
  const rolePlaceholders = roles.map(() => "?").join(", ");
  const params: unknown[] = [...roles, actorUserId];
  const conditions = [`users.role IN (${rolePlaceholders})`, "users.id <> ?"];

  if (marketId) {
    if (audience === "vendors") {
      conditions.push("users.market_id = ?");
      params.push(marketId);
    } else {
      conditions.push("(users.market_id = ? OR users.role IN ('official', 'admin'))");
      params.push(marketId);
    }
  }

  const recipients = await all<{ id: string }>(
    `SELECT users.id
     FROM users
     WHERE ${conditions.join(" AND ")}`,
    params,
  );

  const messagePrefix = priority === "high" ? "High priority announcement" : "Market announcement";
  for (const recipient of recipients) {
    await queueNotification({
      userId: recipient.id,
      type: "system",
      message: `${messagePrefix}: ${title}`,
      channels: ["system"],
    });
  }

  return {
    announcementId,
    recipientCount: recipients.length,
  };
};

export const announcementRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/announcements",
    handler: async ({ res, auth, url }) => {
      const session = requirePermission(auth, "announcement:read");
      const requestedMarketId = url.searchParams.get("marketId")?.trim() || null;
      const activeOnly = url.searchParams.get("active") === "true" || session.user.role === "vendor";
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (activeOnly) {
        conditions.push("announcements.archived_at IS NULL");
        conditions.push("(announcements.expires_at IS NULL OR announcements.expires_at > NOW())");
      }

      if (session.user.role === "vendor") {
        conditions.push("announcements.audience IN ('all', 'vendors')");
        if (session.user.marketId) {
          conditions.push("(announcements.market_id IS NULL OR announcements.market_id = ?)");
          params.push(session.user.marketId);
        } else {
          conditions.push("announcements.market_id IS NULL");
        }
      } else if (session.user.role === "manager") {
        if (!session.user.marketId) {
          throw new HttpError(403, "Your account is not assigned to a market.");
        }
        if (requestedMarketId && requestedMarketId !== session.user.marketId) {
          throw new HttpError(403, "You do not have access to that market.");
        }
        conditions.push("(announcements.market_id IS NULL OR announcements.market_id = ?)");
        params.push(session.user.marketId);
      } else if (requestedMarketId) {
        await ensureMarketExists(requestedMarketId);
        conditions.push("(announcements.market_id IS NULL OR announcements.market_id = ?)");
        params.push(requestedMarketId);
      }

      const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") || 50)), 100);
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const announcements = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        title: string;
        body: string;
        priority: AnnouncementPriority;
        audience: AnnouncementAudience;
        created_by: string | null;
        created_by_name: string;
        created_by_role: AnnouncementCreatorRole;
        expires_at: string | null;
        archived_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `${selectAnnouncementSql}
         ${whereClause}
         ORDER BY
           CASE announcements.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
           announcements.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      sendJson(res, 200, { announcements: announcements.map(mapAnnouncement) });
    },
  },
  {
    method: "POST",
    path: "/announcements",
    handler: async ({ req, res, auth }) => {
      const session = requirePermission(auth, "announcement:write");
      if (!["manager", "official", "admin"].includes(session.user.role)) {
        throw new HttpError(403, "Only managers, officials, and admins can publish announcements.");
      }

      const body = await readJsonBody<{
        title?: string;
        body?: string;
        priority?: AnnouncementPriority;
        audience?: AnnouncementAudience;
        marketId?: string | null;
        expiresAt?: string | null;
      }>(req);

      let title = body.title?.trim();
      let announcementBody = body.body?.trim();
      const priority = body.priority || "normal";
      const audience = body.audience || "vendors";

      if (!title || !announcementBody) {
        throw new HttpError(400, "Title and announcement body are required.");
      }
      assertMaxLength(title, 140, "Announcement title");
      assertMaxLength(announcementBody, 2000, "Announcement body");
      title = sanitizeText(title);
      announcementBody = sanitizeText(announcementBody);
      if (!priorities.has(priority)) {
        throw new HttpError(400, "Announcement priority is invalid.");
      }
      if (!audiences.has(audience)) {
        throw new HttpError(400, "Announcement audience is invalid.");
      }

      const marketId =
        session.user.role === "manager"
          ? session.user.marketId
          : body.marketId?.trim() || null;

      if (session.user.role === "manager" && !marketId) {
        throw new HttpError(403, "Your account is not assigned to a market.");
      }
      if (marketId) {
        await ensureMarketExists(marketId);
      }

      let expiresAt: string | null = null;
      if (body.expiresAt) {
        const parsedExpiry = new Date(body.expiresAt);
        if (Number.isNaN(parsedExpiry.getTime())) {
          throw new HttpError(400, "Expiry date is invalid.");
        }
        if (parsedExpiry.getTime() <= Date.now()) {
          throw new HttpError(400, "Expiry date must be in the future.");
        }
        expiresAt = parsedExpiry.toISOString();
      }

      const announcementId = createId("announcement");
      const timestamp = nowIso();
      await run(
        `INSERT INTO announcements (
           id,
           market_id,
           title,
           body,
           priority,
           audience,
           created_by,
           created_by_name,
           created_by_role,
           expires_at,
           archived_at,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          announcementId,
          marketId,
          title,
          announcementBody,
          priority,
          audience,
          session.user.id,
          session.user.name,
          session.user.role,
          expiresAt,
          timestamp,
          timestamp,
        ],
      );

      const delivery = await notifyAnnouncementRecipients({
        actorUserId: session.user.id,
        announcementId,
        title,
        priority,
        audience,
        marketId,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "PUBLISH_ANNOUNCEMENT",
        entityType: "announcement",
        entityId: announcementId,
        details: { title, priority, audience, recipientCount: delivery.recipientCount },
      });

      const created = await getAnnouncementById(announcementId);
      sendJson(res, 201, { announcement: created ? mapAnnouncement(created) : null, delivery });
    },
  },
  {
    method: "POST",
    path: "/announcements/:id/archive",
    handler: async ({ res, auth, params }) => {
      const session = requirePermission(auth, "announcement:write");
      const announcement = await getAnnouncementById(params.id);
      if (!announcement) {
        throw new HttpError(404, "Announcement not found.");
      }
      if (session.user.role === "manager" && announcement.market_id !== session.user.marketId) {
        throw new HttpError(404, "Announcement not found.");
      }

      const timestamp = nowIso();
      await run(
        `UPDATE announcements
         SET archived_at = COALESCE(archived_at, ?),
             updated_at = ?
         WHERE id = ?`,
        [timestamp, timestamp, params.id],
      );

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: announcement.market_id,
        action: "ARCHIVE_ANNOUNCEMENT",
        entityType: "announcement",
        entityId: announcement.id,
        details: { title: announcement.title },
      });

      const updated = await getAnnouncementById(params.id);
      sendJson(res, 200, { announcement: updated ? mapAnnouncement(updated) : null });
    },
  },
];
