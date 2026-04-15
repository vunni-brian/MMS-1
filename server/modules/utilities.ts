import { assertChargeEnabled } from "../lib/billing.ts";
import { all, createId, get, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";
import {
  calculateUtilityChargeAmount,
  getUtilityChargeCancelledMessage,
  getUtilityChargeCreatedMessage,
  getUtilityChargeDisplayName,
  getUtilityChargeOverdueMessage,
  getUtilityChargeResetStatus,
  getUtilityNotificationChannels,
} from "../lib/utilities.ts";
import type { UtilityCalculationMethod, UtilityChargeStatus, UtilityType } from "../types.ts";

const utilityChargeSelect = `
  SELECT utility_charges.id,
         utility_charges.market_id,
         markets.name AS market_name,
         utility_charges.vendor_id,
         vendors.name AS vendor_name,
         vendors.phone AS vendor_phone,
         utility_charges.booking_id,
         utility_charges.utility_type,
         utility_charges.description,
         utility_charges.billing_period,
         utility_charges.usage_quantity,
         utility_charges.unit,
         utility_charges.rate_per_unit,
         utility_charges.calculation_method,
         utility_charges.amount,
         utility_charges.due_date::text AS due_date,
         utility_charges.status,
         utility_charges.created_by,
         creators.name AS created_by_name,
         utility_charges.created_at,
         utility_charges.updated_at,
         utility_charges.paid_at,
         stalls.name AS stall_name,
         (
           SELECT payments.id
           FROM payments
           WHERE payments.utility_charge_id = utility_charges.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_id,
         (
           SELECT payments.status
           FROM payments
           WHERE payments.utility_charge_id = utility_charges.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_status,
         (
           SELECT payments.receipt_id
           FROM payments
           WHERE payments.utility_charge_id = utility_charges.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_receipt_id,
         (
           SELECT COALESCE(payments.provider_reference, payments.external_reference)
           FROM payments
           WHERE payments.utility_charge_id = utility_charges.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_reference,
         (
           SELECT payments.completed_at
           FROM payments
           WHERE payments.utility_charge_id = utility_charges.id
           ORDER BY payments.created_at DESC
           LIMIT 1
         ) AS latest_payment_completed_at,
         (
           SELECT COUNT(*)::INT
           FROM payments
           WHERE payments.utility_charge_id = utility_charges.id
         ) AS payment_count
  FROM utility_charges
  INNER JOIN users AS vendors ON vendors.id = utility_charges.vendor_id
  LEFT JOIN bookings ON bookings.id = utility_charges.booking_id
  LEFT JOIN stalls ON stalls.id = bookings.stall_id
  LEFT JOIN users AS creators ON creators.id = utility_charges.created_by
  LEFT JOIN markets ON markets.id = utility_charges.market_id
`;

const mapUtilityCharge = (row: {
  id: string;
  market_id: string;
  market_name: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_phone: string;
  booking_id: string | null;
  utility_type: string;
  description: string;
  billing_period: string;
  usage_quantity: number | null;
  unit: string | null;
  rate_per_unit: number | null;
  calculation_method: string;
  amount: number;
  due_date: string;
  status: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  stall_name: string | null;
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
  bookingId: row.booking_id,
  stallName: row.stall_name,
  utilityType: row.utility_type,
  description: row.description,
  billingPeriod: row.billing_period,
  usageQuantity: row.usage_quantity,
  unit: row.unit,
  ratePerUnit: row.rate_per_unit,
  calculationMethod: row.calculation_method,
  amount: row.amount,
  dueDate: row.due_date,
  status: row.status,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
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

const getUtilityChargeById = async (utilityChargeId: string) => {
  const utilityCharge = await get<{
    id: string;
    market_id: string;
    market_name: string | null;
    vendor_id: string;
    vendor_name: string;
    vendor_phone: string;
    booking_id: string | null;
    utility_type: string;
    description: string;
    billing_period: string;
    usage_quantity: number | null;
    unit: string | null;
    rate_per_unit: number | null;
    calculation_method: string;
    amount: number;
    due_date: string;
    status: string;
    created_by: string | null;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    paid_at: string | null;
    stall_name: string | null;
    latest_payment_id: string | null;
    latest_payment_status: string | null;
    latest_payment_receipt_id: string | null;
    latest_payment_reference: string | null;
    latest_payment_completed_at: string | null;
    payment_count: number;
  }>(`${utilityChargeSelect} WHERE utility_charges.id = ?`, [utilityChargeId]);

  return utilityCharge ? mapUtilityCharge(utilityCharge) : null;
};

const syncOverdueUtilityCharges = async ({
  marketId,
  vendorId,
}: {
  marketId?: string | null;
  vendorId?: string | null;
}) => {
  const clauses = ["status = 'unpaid'", "due_date < ?::date"];
  const params: (string | null)[] = [new Date().toISOString().slice(0, 10)];

  if (marketId) {
    clauses.push("market_id = ?");
    params.push(marketId);
  }

  if (vendorId) {
    clauses.push("vendor_id = ?");
    params.push(vendorId);
  }

  const timestamp = nowIso();
  const updatedCharges = await all<{
    id: string;
    market_id: string;
    vendor_id: string;
    amount: number;
    due_date: string;
    description: string;
    utility_type: string;
    billing_period: string;
    vendor_phone: string | null;
  }>(
    `UPDATE utility_charges
     SET status = 'overdue',
         updated_at = ?
     WHERE ${clauses.join(" AND ")}
     RETURNING id,
               market_id,
               vendor_id,
               amount,
               due_date::text AS due_date,
               description,
               utility_type,
               billing_period,
               (SELECT users.phone FROM users WHERE users.id = utility_charges.vendor_id) AS vendor_phone`,
    [timestamp, ...params],
  );

  for (const charge of updatedCharges) {
    await queueNotification({
      userId: charge.vendor_id,
      type: "payment",
      message: getUtilityChargeOverdueMessage({
        utilityType: charge.utility_type,
        description: charge.description,
        billingPeriod: charge.billing_period,
        amount: charge.amount,
        dueDate: charge.due_date,
      }),
      channels: getUtilityNotificationChannels(),
      destinationPhone: charge.vendor_phone,
    });

    await logAuditEvent({
      actorUserId: null,
      actorName: "System",
      actorRole: "admin",
      marketId: charge.market_id,
      action: "UTILITY_CHARGE_OVERDUE",
      entityType: "utility_charge",
      entityId: charge.id,
      details: { dueDate: charge.due_date },
    });
  }
};

export const utilityChargeRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/utility-charges",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "utility:read", url.searchParams.get("marketId"));
      const statusFilter = url.searchParams.get("status")?.trim() || null;

      await syncOverdueUtilityCharges({
        marketId,
        vendorId: session.user.role === "vendor" ? session.user.id : null,
      });

      const clauses: string[] = [];
      const params: string[] = [];

      if (marketId) {
        clauses.push("utility_charges.market_id = ?");
        params.push(marketId);
      }

      if (session.user.role === "vendor") {
        clauses.push("utility_charges.vendor_id = ?");
        params.push(session.user.id);
      }

      if (statusFilter && statusFilter !== "all") {
        clauses.push("utility_charges.status = ?");
        params.push(statusFilter);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const utilityCharges = await all<{
        id: string;
        market_id: string;
        market_name: string | null;
        vendor_id: string;
        vendor_name: string;
        vendor_phone: string;
        booking_id: string | null;
        utility_type: string;
        description: string;
        billing_period: string;
        usage_quantity: number | null;
        unit: string | null;
        rate_per_unit: number | null;
        calculation_method: string;
        amount: number;
        due_date: string;
        status: string;
        created_by: string | null;
        created_by_name: string | null;
        created_at: string;
        updated_at: string;
        paid_at: string | null;
        stall_name: string | null;
        latest_payment_id: string | null;
        latest_payment_status: string | null;
        latest_payment_receipt_id: string | null;
        latest_payment_reference: string | null;
        latest_payment_completed_at: string | null;
        payment_count: number;
      }>(
        `${utilityChargeSelect}
         ${whereClause}
         ORDER BY
           CASE utility_charges.status
             WHEN 'overdue' THEN 0
             WHEN 'unpaid' THEN 1
             WHEN 'pending' THEN 2
             WHEN 'paid' THEN 3
             ELSE 4
           END,
           utility_charges.due_date ASC,
           utility_charges.created_at DESC`,
        params,
      );

      sendJson(res, 200, { utilityCharges: utilityCharges.map(mapUtilityCharge) });
    },
  },
  {
    method: "POST",
    path: "/utility-charges",
    handler: async ({ req, res, auth }) => {
      const body = await readJsonBody<{
        marketId?: string;
        vendorId?: string;
        bookingId?: string | null;
        utilityType?: UtilityType;
        description?: string;
        billingPeriod?: string;
        usageQuantity?: number | null;
        unit?: string | null;
        ratePerUnit?: number | null;
        calculationMethod?: UtilityCalculationMethod;
        amount?: number | null;
        dueDate?: string;
      }>(req);

      const { session, marketId } = resolveScopedMarket(auth, "utility:manage", body.marketId || null);
      if (!marketId) {
        throw new HttpError(400, "Market is required.");
      }

      if (!body.vendorId) {
        throw new HttpError(400, "Vendor is required.");
      }

      if (!body.utilityType || !body.description?.trim() || !body.billingPeriod?.trim() || !body.calculationMethod || !body.dueDate?.trim()) {
        throw new HttpError(400, "Vendor, utility type, description, billing period, calculation method, and due date are required.");
      }

      await assertChargeEnabled("utilities", marketId);

      const vendor = await get<{
        id: string;
        phone: string;
        market_id: string | null;
        role: string;
        approval_status: string | null;
      }>(
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
        throw new HttpError(409, "Utility charges can only be assigned to approved vendors.");
      }

      let bookingId: string | null = body.bookingId?.trim() || null;
      if (bookingId) {
        const booking = await get<{ id: string }>(
          `SELECT id
           FROM bookings
           WHERE id = ? AND vendor_id = ? AND market_id = ?`,
          [bookingId, vendor.id, marketId],
        );
        if (!booking) {
          throw new HttpError(400, "Booking reference is invalid for the selected vendor.");
        }
      }

      const calculationMethod = body.calculationMethod;
      const usageQuantity = body.usageQuantity == null ? null : Number(body.usageQuantity);
      const ratePerUnit = body.ratePerUnit == null ? null : Number(body.ratePerUnit);
      const amount =
        body.amount == null
          ? calculateUtilityChargeAmount({
              calculationMethod,
              usageQuantity,
              ratePerUnit,
            })
          : calculateUtilityChargeAmount({
              calculationMethod,
              usageQuantity,
              ratePerUnit,
              amount: Number(body.amount),
            });

      if (calculationMethod !== "fixed" && !body.unit?.trim()) {
        throw new HttpError(400, "A usage unit is required for metered or estimated charges.");
      }

      const utilityChargeId = createId("utility_charge");
      const timestamp = nowIso();
      await run(
        `INSERT INTO utility_charges (
           id,
           market_id,
           vendor_id,
           booking_id,
           utility_type,
           description,
           billing_period,
           usage_quantity,
           unit,
           rate_per_unit,
           calculation_method,
           amount,
           due_date,
           status,
           created_by,
           created_at,
           updated_at,
           paid_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::date, 'unpaid', ?, ?, ?, NULL)`,
        [
          utilityChargeId,
          marketId,
          vendor.id,
          bookingId,
          body.utilityType,
          body.description.trim(),
          body.billingPeriod.trim(),
          calculationMethod === "fixed" ? null : usageQuantity,
          body.unit?.trim() || null,
          calculationMethod === "fixed" ? null : ratePerUnit,
          calculationMethod,
          amount,
          body.dueDate.trim(),
          session.user.id,
          timestamp,
          timestamp,
        ],
      );

      await queueNotification({
        userId: vendor.id,
        type: "payment",
        message: getUtilityChargeCreatedMessage({
          utilityType: body.utilityType,
          description: body.description,
          billingPeriod: body.billingPeriod,
          amount,
          dueDate: body.dueDate.trim(),
        }),
        channels: getUtilityNotificationChannels(),
        destinationPhone: vendor.phone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_UTILITY_CHARGE",
        entityType: "utility_charge",
        entityId: utilityChargeId,
        details: {
          vendorId: vendor.id,
          utilityType: body.utilityType,
          calculationMethod,
          amount,
        },
      });

      sendJson(res, 201, { utilityCharge: await getUtilityChargeById(utilityChargeId) });
    },
  },
  {
    method: "POST",
    path: "/utility-charges/:id/cancel",
    handler: async ({ res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "utility:manage");
      const utilityCharge = await getUtilityChargeById(params.id);
      if (!utilityCharge) {
        throw new HttpError(404, "Utility charge not found.");
      }

      assertMarketAccess(session, utilityCharge.marketId);

      if (!["unpaid", "overdue"].includes(utilityCharge.status)) {
        throw new HttpError(409, "Only unpaid or overdue utility charges can be cancelled.");
      }

      await run(
        `UPDATE utility_charges
         SET status = 'cancelled',
             updated_at = ?
         WHERE id = ?`,
        [nowIso(), utilityCharge.id],
      );

      await queueNotification({
        userId: utilityCharge.vendorId,
        type: "payment",
        message: getUtilityChargeCancelledMessage({
          utilityType: utilityCharge.utilityType,
          description: utilityCharge.description,
          billingPeriod: utilityCharge.billingPeriod,
          amount: utilityCharge.amount,
        }),
        channels: getUtilityNotificationChannels(),
        destinationPhone: utilityCharge.vendorPhone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: utilityCharge.marketId,
        action: "CANCEL_UTILITY_CHARGE",
        entityType: "utility_charge",
        entityId: utilityCharge.id,
      });

      sendJson(res, 200, { utilityCharge: await getUtilityChargeById(utilityCharge.id) });
    },
  },
];
