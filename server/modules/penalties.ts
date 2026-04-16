import { assertChargeEnabled } from "../lib/billing.ts";
import { all, createId, get, logAuditEvent, queueNotification, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { getPenaltyCancelledMessage, getPenaltyCreatedMessage, getPenaltyNotificationChannels } from "../lib/penalties.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";

const penaltySelect = `
  SELECT penalties.id,
         penalties.market_id,
         markets.name AS market_name,
         penalties.vendor_id,
         vendors.name AS vendor_name,
         vendors.phone AS vendor_phone,
         penalties.related_utility_charge_id,
         utility_charges.description AS related_utility_charge_description,
         penalties.amount,
         penalties.reason,
         penalties.status,
         penalties.issued_by,
         issuers.name AS issued_by_name,
         penalties.created_at,
         penalties.updated_at,
         penalties.paid_at,
         (
           SELECT payments.id
           FROM payments
           WHERE payments.penalty_id = penalties.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_id,
         (
           SELECT payments.status
           FROM payments
           WHERE payments.penalty_id = penalties.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_status,
         (
           SELECT payments.receipt_id
           FROM payments
           WHERE payments.penalty_id = penalties.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_receipt_id,
         (
           SELECT COALESCE(payments.provider_reference, payments.external_reference)
           FROM payments
           WHERE payments.penalty_id = penalties.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_reference,
         (
           SELECT payments.completed_at
           FROM payments
           WHERE payments.penalty_id = penalties.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_completed_at,
         (
           SELECT COUNT(*)::INT
           FROM payments
           WHERE payments.penalty_id = penalties.id
         ) AS payment_count
  FROM penalties
  INNER JOIN users AS vendors ON vendors.id = penalties.vendor_id
  LEFT JOIN users AS issuers ON issuers.id = penalties.issued_by
  LEFT JOIN utility_charges ON utility_charges.id = penalties.related_utility_charge_id
  LEFT JOIN markets ON markets.id = penalties.market_id
`;

const mapPenalty = (row: {
  id: string;
  market_id: string;
  market_name: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_phone: string;
  related_utility_charge_id: string | null;
  related_utility_charge_description: string | null;
  amount: number;
  reason: string;
  status: string;
  issued_by: string | null;
  issued_by_name: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  latest_payment_id: string | null;
  latest_payment_status: string | null;
  latest_payment_receipt_id: string | null;
  latest_payment_reference: string | null;
  latest_payment_completed_at: string | null;
  payment_count: number;
}) => ({
  id: row.id,
  marketId: row.market_id,
  marketName: row.market_name,
  vendorId: row.vendor_id,
  vendorName: row.vendor_name,
  vendorPhone: row.vendor_phone,
  relatedUtilityChargeId: row.related_utility_charge_id,
  relatedUtilityChargeDescription: row.related_utility_charge_description,
  amount: row.amount,
  reason: row.reason,
  status: row.status,
  issuedBy: row.issued_by,
  issuedByName: row.issued_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  paidAt: row.paid_at,
  latestPaymentId: row.latest_payment_id,
  latestPaymentStatus: row.latest_payment_status,
  latestPaymentReceiptId: row.latest_payment_receipt_id,
  latestPaymentReference: row.latest_payment_reference,
  latestPaymentCompletedAt: row.latest_payment_completed_at,
  paymentCount: row.payment_count,
});

const getPenaltyById = async (penaltyId: string) => {
  const penalty = await get<Parameters<typeof mapPenalty>[0]>(`${penaltySelect} WHERE penalties.id = ?`, [penaltyId]);

  return penalty ? mapPenalty(penalty) : null;
};

export const penaltyRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/penalties",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "penalty:read", url.searchParams.get("marketId"));
      const statusFilter = url.searchParams.get("status")?.trim() || null;
      const clauses: string[] = [];
      const params: string[] = [];

      if (marketId) {
        clauses.push("penalties.market_id = ?");
        params.push(marketId);
      }
      if (session.user.role === "vendor") {
        clauses.push("penalties.vendor_id = ?");
        params.push(session.user.id);
      }
      if (statusFilter && statusFilter !== "all") {
        clauses.push("penalties.status = ?");
        params.push(statusFilter);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const penalties = await all<Parameters<typeof mapPenalty>[0]>(
        `${penaltySelect}
         ${whereClause}
         ORDER BY
           CASE penalties.status
             WHEN 'unpaid' THEN 0
             WHEN 'pending' THEN 1
             WHEN 'paid' THEN 2
             ELSE 3
           END,
           penalties.created_at DESC`,
        params,
      );

      sendJson(res, 200, { penalties: penalties.map(mapPenalty) });
    },
  },
  {
    method: "POST",
    path: "/penalties",
    handler: async ({ req, res, auth }) => {
      const body = await readJsonBody<{
        marketId?: string;
        vendorId?: string;
        relatedUtilityChargeId?: string | null;
        amount?: number;
        reason?: string;
      }>(req);

      const { session, marketId } = resolveScopedMarket(auth, "penalty:manage", body.marketId || null);
      if (!marketId) {
        throw new HttpError(400, "Market is required.");
      }
      if (!body.vendorId || !body.reason?.trim()) {
        throw new HttpError(400, "Vendor and reason are required.");
      }
      const amount = Number(body.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(400, "Penalty amount must be greater than zero.");
      }

      await assertChargeEnabled("penalties", marketId);

      const vendor = await get<{ id: string; phone: string; market_id: string | null; role: string; approval_status: string | null }>(
        `SELECT users.id,
                users.phone,
                users.market_id,
                users.role,
                vendor_profiles.approval_status
         FROM users
         LEFT JOIN vendor_profiles ON vendor_profiles.user_id = users.id
         WHERE users.id = ?`,
        [body.vendorId],
      );
      if (!vendor || vendor.role !== "vendor" || vendor.market_id !== marketId) {
        throw new HttpError(404, "Selected vendor was not found in this market.");
      }
      if (vendor.approval_status !== "approved") {
        throw new HttpError(409, "Penalties can only be issued to approved vendors.");
      }

      const relatedUtilityChargeId = body.relatedUtilityChargeId?.trim() || null;
      if (relatedUtilityChargeId) {
        const utilityCharge = await get<{ id: string }>(
          `SELECT id
           FROM utility_charges
           WHERE id = ? AND vendor_id = ? AND market_id = ?`,
          [relatedUtilityChargeId, vendor.id, marketId],
        );
        if (!utilityCharge) {
          throw new HttpError(400, "Related utility charge is invalid for the selected vendor.");
        }
      }

      const penaltyId = createId("penalty");
      const timestamp = nowIso();
      await run(
        `INSERT INTO penalties (id, market_id, vendor_id, related_utility_charge_id, amount, reason, status, issued_by, created_at, updated_at, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, NULL)`,
        [penaltyId, marketId, vendor.id, relatedUtilityChargeId, Math.round(amount), body.reason.trim(), session.user.id, timestamp, timestamp],
      );

      await queueNotification({
        userId: vendor.id,
        type: "payment",
        message: getPenaltyCreatedMessage({ reason: body.reason.trim(), amount: Math.round(amount) }),
        channels: getPenaltyNotificationChannels(),
        destinationPhone: vendor.phone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "ISSUE_PENALTY",
        entityType: "penalty",
        entityId: penaltyId,
        details: { vendorId: vendor.id, relatedUtilityChargeId, amount: Math.round(amount) },
      });

      sendJson(res, 201, { penalty: await getPenaltyById(penaltyId) });
    },
  },
  {
    method: "POST",
    path: "/penalties/:id/cancel",
    handler: async ({ res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "penalty:manage");
      const penalty = await getPenaltyById(params.id);
      if (!penalty) {
        throw new HttpError(404, "Penalty not found.");
      }

      assertMarketAccess(session, penalty.marketId);
      if (!["unpaid", "pending"].includes(penalty.status)) {
        throw new HttpError(409, "Only unpaid or pending penalties can be cancelled.");
      }

      await run(
        `UPDATE penalties
         SET status = 'cancelled',
             updated_at = ?
         WHERE id = ?`,
        [nowIso(), penalty.id],
      );

      await queueNotification({
        userId: penalty.vendorId,
        type: "payment",
        message: getPenaltyCancelledMessage({ reason: penalty.reason, amount: penalty.amount }),
        channels: getPenaltyNotificationChannels(),
        destinationPhone: penalty.vendorPhone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: penalty.marketId,
        action: "CANCEL_PENALTY",
        entityType: "penalty",
        entityId: penalty.id,
      });

      sendJson(res, 200, { penalty: await getPenaltyById(penalty.id) });
    },
  },
];
