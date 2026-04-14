import { all, createId, get, logAuditEvent, queueNotification, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";

const mapRequest = (row: {
  id: string;
  market_id: string;
  market_name: string | null;
  manager_user_id: string;
  manager_name: string;
  category: "budget" | "structural";
  title: string;
  description: string;
  amount_requested: number;
  approved_amount: number | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
}) => ({
  id: row.id,
  managerUserId: row.manager_user_id,
  managerName: row.manager_name,
  marketId: row.market_id,
  marketName: row.market_name || "Unknown Market",
  category: row.category,
  title: row.title,
  description: row.description,
  amountRequested: row.amount_requested,
  approvedAmount: row.approved_amount,
  status: row.status,
  reviewNote: row.review_note,
  reviewedByUserId: row.reviewed_by_user_id,
  reviewedByName: row.reviewed_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const selectSql = `
  SELECT resource_requests.id,
         resource_requests.market_id,
         markets.name AS market_name,
         resource_requests.manager_user_id,
         resource_requests.manager_name,
         resource_requests.category,
         resource_requests.title,
         resource_requests.description,
         resource_requests.amount_requested,
         resource_requests.approved_amount,
         resource_requests.status,
         resource_requests.review_note,
         resource_requests.reviewed_by_user_id,
         resource_requests.reviewed_by_name,
         resource_requests.created_at,
         resource_requests.updated_at
  FROM resource_requests
  LEFT JOIN markets ON markets.id = resource_requests.market_id
`;

export const resourceRequestRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/resource-requests",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "resource:read", url.searchParams.get("marketId"));
      const clauses: string[] = [];
      const params: string[] = [];

      if (marketId) {
        clauses.push("resource_requests.market_id = ?");
        params.push(marketId);
      }
      if (session.user.role === "manager") {
        clauses.push("resource_requests.manager_user_id = ?");
        params.push(session.user.id);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await all<{
        id: string;
        market_id: string;
        market_name: string | null;
        manager_user_id: string;
        manager_name: string;
        category: "budget" | "structural";
        title: string;
        description: string;
        amount_requested: number;
        approved_amount: number | null;
        status: "pending" | "approved" | "rejected";
        review_note: string | null;
        reviewed_by_user_id: string | null;
        reviewed_by_name: string | null;
        created_at: string;
        updated_at: string;
      }>(`${selectSql} ${whereClause} ORDER BY resource_requests.created_at DESC`, params);

      sendJson(res, 200, { requests: rows.map(mapRequest) });
    },
  },
  {
    method: "POST",
    path: "/resource-requests",
    handler: async ({ req, res, auth }) => {
      const { session, marketId } = resolveScopedMarket(auth, "resource:create");
      if (session.user.role !== "manager") {
        throw new HttpError(403, "Only managers can submit resource requests.");
      }
      if (!marketId) {
        throw new HttpError(403, "Manager account is not assigned to a market.");
      }

      const body = await readJsonBody<{
        category?: "budget" | "structural";
        title?: string;
        description?: string;
        amountRequested?: number;
      }>(req);

      if (!body.category || !["budget", "structural"].includes(body.category)) {
        throw new HttpError(400, "A valid request category is required.");
      }
      if (!body.title?.trim() || !body.description?.trim()) {
        throw new HttpError(400, "Title and description are required.");
      }
      if (!body.amountRequested || body.amountRequested <= 0) {
        throw new HttpError(400, "Amount requested must be greater than zero.");
      }

      const requestId = createId("resource_request");
      const timestamp = nowIso();
      await run(
        `INSERT INTO resource_requests (id, market_id, manager_user_id, manager_name, category, title, description, amount_requested, approved_amount, status, review_note, reviewed_by_user_id, reviewed_by_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL, NULL, ?, ?)`,
        [
          requestId,
          marketId,
          session.user.id,
          session.user.name,
          body.category,
          body.title.trim(),
          body.description.trim(),
          body.amountRequested,
          timestamp,
          timestamp,
        ],
      );

      for (const official of await all<{ id: string }>(`SELECT id FROM users WHERE role = 'official'`)) {
        await queueNotification({
          userId: official.id,
          type: "system",
          message: `${session.user.name} submitted a ${body.category} request: ${body.title.trim()}.`,
          channels: ["system"],
        });
      }
      for (const admin of await all<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)) {
        await queueNotification({
          userId: admin.id,
          type: "system",
          message: `${session.user.name} submitted a ${body.category} request: ${body.title.trim()}.`,
          channels: ["system"],
        });
      }
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_RESOURCE_REQUEST",
        entityType: "resource_request",
        entityId: requestId,
        details: { category: body.category, amountRequested: body.amountRequested },
      });

      const created = await get<{
        id: string;
        market_id: string;
        market_name: string | null;
        manager_user_id: string;
        manager_name: string;
        category: "budget" | "structural";
        title: string;
        description: string;
        amount_requested: number;
        approved_amount: number | null;
        status: "pending" | "approved" | "rejected";
        review_note: string | null;
        reviewed_by_user_id: string | null;
        reviewed_by_name: string | null;
        created_at: string;
        updated_at: string;
      }>(`${selectSql} WHERE resource_requests.id = ?`, [requestId]);

      sendJson(res, 201, { request: created ? mapRequest(created) : null });
    },
  },
  {
    method: "PATCH",
    path: "/resource-requests/:id",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "resource:review");
      if (!["official", "admin"].includes(session.user.role)) {
        throw new HttpError(403, "Only officials and admins can review resource requests.");
      }

      const existing = await get<{
        id: string;
        market_id: string | null;
        manager_user_id: string;
      }>(`SELECT id, market_id, manager_user_id FROM resource_requests WHERE id = ?`, [params.id]);
      if (!existing) {
        throw new HttpError(404, "Resource request not found.");
      }

      const body = await readJsonBody<{
        status?: "approved" | "rejected";
        reviewNote?: string;
        approvedAmount?: number | null;
      }>(req);

      if (!body.status || !["approved", "rejected"].includes(body.status)) {
        throw new HttpError(400, "A valid review status is required.");
      }
      if (body.status === "approved" && (!body.approvedAmount || body.approvedAmount <= 0)) {
        throw new HttpError(400, "Approved amount must be greater than zero.");
      }

      const timestamp = nowIso();
      await run(
        `UPDATE resource_requests
         SET status = ?,
             approved_amount = ?,
             review_note = ?,
             reviewed_by_user_id = ?,
             reviewed_by_name = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          body.status,
          body.status === "approved" ? body.approvedAmount : null,
          body.reviewNote?.trim() || null,
          session.user.id,
          session.user.name,
          timestamp,
          params.id,
        ],
      );

      await queueNotification({
        userId: existing.manager_user_id,
        type: "system",
        message: `Your resource request was ${body.status}${body.status === "approved" && body.approvedAmount ? ` for UGX ${body.approvedAmount.toLocaleString()}` : ""}.`,
        channels: ["system"],
      });
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: existing.market_id,
        action: "REVIEW_RESOURCE_REQUEST",
        entityType: "resource_request",
        entityId: params.id,
        details: { status: body.status, approvedAmount: body.approvedAmount ?? null },
      });

      const updated = await get<{
        id: string;
        market_id: string;
        market_name: string | null;
        manager_user_id: string;
        manager_name: string;
        category: "budget" | "structural";
        title: string;
        description: string;
        amount_requested: number;
        approved_amount: number | null;
        status: "pending" | "approved" | "rejected";
        review_note: string | null;
        reviewed_by_user_id: string | null;
        reviewed_by_name: string | null;
        created_at: string;
        updated_at: string;
      }>(`${selectSql} WHERE resource_requests.id = ?`, [params.id]);

      if (updated) {
        assertMarketAccess(session, updated.market_id);
      }
      sendJson(res, 200, { request: updated ? mapRequest(updated) : null });
    },
  },
];
