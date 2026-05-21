import fs from "node:fs";
import type { ServerResponse } from "node:http";

import { assertChargeEnabled } from "../lib/billing.ts";
import { all, createId, get, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, readRawBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { getPaymentItemLabel, getPaymentReference, getPaymentSuccessMessage, getVendorPaymentNotification } from "../lib/payment-notifications.ts";
import { getPenaltyDisplayName } from "../lib/penalties.ts";
import { getPesapalPaymentOutcome, getPesapalTransactionStatus, submitPesapalOrder } from "../lib/pesapal.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";
import { persistFilePayload, validateFilePayload } from "../lib/storage.ts";
import { downloadSupabaseStorageObject } from "../lib/supabase.ts";
import { getUtilityChargeDisplayName, getUtilityChargeResetStatus } from "../lib/utilities.ts";
import { config } from "../config.ts";
import type { FilePayload } from "../types.ts";

const paymentSelect = `
  SELECT payments.id,
         payments.market_id,
         markets.name AS market_name,
         payments.booking_id,
         payments.utility_charge_id,
         payments.penalty_id,
         payments.vendor_id,
         payments.provider,
         payments.charge_type,
         CASE
           WHEN COALESCE(payment_market_charge.is_enabled, payment_global_charge.is_enabled, 1) = 1
           THEN payments.amount
           ELSE 0
         END AS amount,
         payments.status,
         payments.transaction_id,
         payments.provider_reference,
         payments.external_reference,
         payments.phone,
         payments.receipt_id,
         payments.receipt_message,
         payments.receipt_file_name,
         payments.receipt_file_path,
         payments.receipt_file_mime_type,
         payments.receipt_file_size,
         payments.verification_note,
         payments.created_at,
         payments.updated_at,
         payments.completed_at,
         users.name AS vendor_name,
         COALESCE(booking_stalls.name, utility_booking_stalls.name) AS stall_name,
         utility_charges.description AS utility_charge_description,
         utility_charges.utility_type AS utility_charge_type,
         utility_charges.billing_period AS utility_charge_billing_period,
         penalties.reason AS penalty_reason
  FROM payments
  INNER JOIN users ON users.id = payments.vendor_id
  LEFT JOIN bookings ON bookings.id = payments.booking_id
  LEFT JOIN stalls AS booking_stalls ON booking_stalls.id = bookings.stall_id
  LEFT JOIN utility_charges ON utility_charges.id = payments.utility_charge_id
  LEFT JOIN penalties ON penalties.id = payments.penalty_id
  LEFT JOIN bookings AS utility_bookings ON utility_bookings.id = utility_charges.booking_id
  LEFT JOIN stalls AS utility_booking_stalls ON utility_booking_stalls.id = utility_bookings.stall_id
  LEFT JOIN markets ON markets.id = payments.market_id
  LEFT JOIN charge_types AS payment_market_charge
    ON payment_market_charge.name = payments.charge_type
   AND payment_market_charge.scope = 'market'
   AND payment_market_charge.market_id = payments.market_id
  LEFT JOIN charge_types AS payment_global_charge
    ON payment_global_charge.name = payments.charge_type
   AND payment_global_charge.scope = 'global'
`;

const mapPayment = (row: {
  id: string;
  market_id: string | null;
  market_name: string | null;
  booking_id: string | null;
  utility_charge_id: string | null;
  penalty_id: string | null;
  vendor_id: string;
  provider: string;
  charge_type: string;
  amount: number;
  status: string;
  transaction_id: string | null;
  provider_reference: string | null;
  external_reference: string;
  phone: string;
  receipt_id: string | null;
  receipt_message: string | null;
  receipt_file_name: string | null;
  receipt_file_path: string | null;
  receipt_file_mime_type: string | null;
  receipt_file_size: number | null;
  verification_note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  vendor_name: string;
  stall_name: string | null;
  utility_charge_description: string | null;
  utility_charge_type: string | null;
  utility_charge_billing_period: string | null;
  penalty_reason: string | null;
}) => ({
  id: row.id,
  marketId: row.market_id,
  marketName: row.market_name,
  bookingId: row.booking_id,
  utilityChargeId: row.utility_charge_id,
  penaltyId: row.penalty_id,
  vendorId: row.vendor_id,
  vendorName: row.vendor_name,
  stallName: row.stall_name,
  description:
    row.utility_charge_description || row.utility_charge_type
      ? getUtilityChargeDisplayName({
          utilityType: row.utility_charge_type || "other",
          description: row.utility_charge_description,
          billingPeriod: row.utility_charge_billing_period,
        })
      : row.penalty_reason
        ? getPenaltyDisplayName(row.penalty_reason)
      : null,
  method: row.provider,
  chargeType: row.charge_type,
  amount: row.amount,
  status: row.status,
  transactionId: row.transaction_id,
  providerReference: row.provider_reference,
  externalReference: row.external_reference,
  phone: row.phone,
  receiptId: row.receipt_id,
  receiptMessage: row.receipt_message,
  receiptFileName: row.receipt_file_name,
  receiptFilePath: row.receipt_file_path,
  receiptFileMimeType: row.receipt_file_mime_type,
  receiptFileSize: row.receipt_file_size,
  verificationNote: row.verification_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
});

const getPaymentById = async (paymentId: string) => {
  const payment = await get<{
    id: string;
    market_id: string | null;
    market_name: string | null;
    booking_id: string | null;
    utility_charge_id: string | null;
    penalty_id: string | null;
    vendor_id: string;
    provider: string;
    charge_type: string;
    amount: number;
    status: string;
    transaction_id: string | null;
    provider_reference: string | null;
    external_reference: string;
    phone: string;
    receipt_id: string | null;
    receipt_message: string | null;
    receipt_file_name: string | null;
    receipt_file_path: string | null;
    receipt_file_mime_type: string | null;
    receipt_file_size: number | null;
    verification_note: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    vendor_name: string;
    stall_name: string | null;
    utility_charge_description: string | null;
    utility_charge_type: string | null;
    utility_charge_billing_period: string | null;
    penalty_reason: string | null;
  }>(`${paymentSelect} WHERE payments.id = ?`, [paymentId]);

  return payment ? mapPayment(payment) : null;
};

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

const recordPaymentWebhookEvent = async ({
  provider,
  txRef,
  transactionId,
  eventType,
  payload,
}: {
  provider: "pesapal";
  txRef: string | null;
  transactionId: string | null;
  eventType: string | null;
  payload: unknown;
}) => {
  await run(
    `INSERT INTO payment_webhook_events (id, provider, tx_ref, transaction_id, event_type, payload_json, created_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      createId("payment_webhook"),
      provider,
      txRef,
      transactionId,
      eventType,
      JSON.stringify(payload),
      nowIso(),
      nowIso(),
    ],
  );
};

const failPaymentInitiation = async ({
  paymentId,
  utilityChargeId,
  utilityChargeDueDate,
  penaltyId,
  gatewayResponse,
  message,
}: {
  paymentId: string;
  utilityChargeId?: string | null;
  utilityChargeDueDate?: string | null;
  penaltyId?: string | null;
  gatewayResponse?: unknown;
  message: string;
}) => {
  const timestamp = nowIso();
  await transaction(async () => {
    await run(
      `UPDATE payments
       SET status = 'failed',
           receipt_message = ?,
           gateway_response_json = ?,
           updated_at = ?
       WHERE id = ?`,
      [message, gatewayResponse ? JSON.stringify(gatewayResponse) : null, timestamp, paymentId],
    );
    await run(`UPDATE payment_attempts SET status = 'failed', updated_at = ? WHERE payment_id = ?`, [timestamp, paymentId]);

    if (utilityChargeId) {
      await run(
        `UPDATE utility_charges
         SET status = ?,
             updated_at = ?,
             paid_at = NULL
         WHERE id = ?`,
        [getUtilityChargeResetStatus(utilityChargeDueDate || timestamp.slice(0, 10)), timestamp, utilityChargeId],
      );
    }

    if (penaltyId) {
      await run(
        `UPDATE penalties
         SET status = 'unpaid',
             updated_at = ?,
             paid_at = NULL
         WHERE id = ?`,
        [timestamp, penaltyId],
      );
    }
  });
};

const completePayment = async ({
  paymentId,
  transactionId,
  providerReference,
  status,
  gatewayResponse,
  receiptMessage: receiptMessageOverride,
}: {
  paymentId: string;
  transactionId: string;
  providerReference?: string | null;
  status: "completed" | "failed";
  gatewayResponse?: unknown;
  receiptMessage?: string | null;
}) => {
  const payment = await get<{
    id: string;
    status: string;
    market_id: string | null;
    booking_id: string | null;
    utility_charge_id: string | null;
    penalty_id: string | null;
    vendor_id: string;
    charge_type: string;
    amount: number;
    phone: string;
    external_reference: string;
    receipt_id: string | null;
    receipt_message: string | null;
    vendor_name: string;
    stall_name: string | null;
    utility_charge_description: string | null;
    utility_charge_type: string | null;
    utility_charge_billing_period: string | null;
    utility_charge_due_date: string | null;
    penalty_reason: string | null;
  }>(
    `SELECT payments.id,
            payments.status,
            payments.market_id,
            payments.booking_id,
            payments.utility_charge_id,
            payments.penalty_id,
            payments.vendor_id,
            payments.charge_type,
            payments.amount,
            payments.phone,
            payments.external_reference,
            payments.receipt_id,
            payments.receipt_message,
            users.name AS vendor_name,
            COALESCE(booking_stalls.name, utility_booking_stalls.name) AS stall_name,
            utility_charges.description AS utility_charge_description,
            utility_charges.utility_type AS utility_charge_type,
            utility_charges.billing_period AS utility_charge_billing_period,
            utility_charges.due_date::text AS utility_charge_due_date,
            penalties.reason AS penalty_reason
     FROM payments
     INNER JOIN users ON users.id = payments.vendor_id
     LEFT JOIN bookings ON bookings.id = payments.booking_id
     LEFT JOIN stalls AS booking_stalls ON booking_stalls.id = bookings.stall_id
     LEFT JOIN utility_charges ON utility_charges.id = payments.utility_charge_id
     LEFT JOIN penalties ON penalties.id = payments.penalty_id
     LEFT JOIN bookings AS utility_bookings ON utility_bookings.id = utility_charges.booking_id
     LEFT JOIN stalls AS utility_booking_stalls ON utility_booking_stalls.id = utility_bookings.stall_id
     WHERE payments.id = ?`,
    [paymentId],
  );

  if (!payment || payment.status !== "pending") {
    return;
  }

  const timestamp = nowIso();
  const reference = getPaymentReference({
    providerReference,
    transactionId,
    externalReference: payment.external_reference,
  });
  const itemLabel = payment.utility_charge_id
    ? getUtilityChargeDisplayName({
        utilityType: payment.utility_charge_type || "other",
        description: payment.utility_charge_description,
        billingPeriod: payment.utility_charge_billing_period,
      })
    : payment.penalty_id
      ? getPenaltyDisplayName(payment.penalty_reason)
    : null;
  const receiptId = status === "completed" ? payment.receipt_id || `RCPT-${paymentId.slice(-6).toUpperCase()}` : payment.receipt_id;
  const receiptMessage =
    status === "completed"
      ? receiptMessageOverride ||
        payment.receipt_message ||
        getPaymentSuccessMessage({
          amount: payment.amount,
          chargeType: payment.charge_type,
          itemLabel,
          reference,
          completedAt: timestamp,
        })
      : receiptMessageOverride || `Receipt for ${getPaymentItemLabel({ chargeType: payment.charge_type, itemLabel })} was rejected. Reference: ${reference}.`;

  let statusUpdated = false;
  await transaction(async () => {
    const paymentUpdate = await run(
      `UPDATE payments
       SET status = ?,
           transaction_id = ?,
           provider_reference = ?,
           receipt_id = ?,
           receipt_message = ?,
           gateway_response_json = ?,
           updated_at = ?,
           completed_at = ?
       WHERE id = ?
         AND status = 'pending'`,
      [
        status,
        transactionId,
        providerReference || null,
        receiptId,
        receiptMessage,
        gatewayResponse ? JSON.stringify(gatewayResponse) : null,
        timestamp,
        status === "completed" ? timestamp : null,
        paymentId,
      ],
    );
    if (paymentUpdate.rowCount === 0) {
      return;
    }

    statusUpdated = true;
    await run(`UPDATE payment_attempts SET status = ?, updated_at = ? WHERE payment_id = ?`, [status, timestamp, paymentId]);

    if (status === "completed") {
      if (payment.booking_id) {
        await run(`UPDATE bookings SET status = 'paid', updated_at = ? WHERE id = ?`, [timestamp, payment.booking_id]);
      }
      if (payment.utility_charge_id) {
        await run(
          `UPDATE utility_charges
           SET status = 'paid',
               updated_at = ?,
               paid_at = ?
           WHERE id = ?`,
          [timestamp, timestamp, payment.utility_charge_id],
        );
      }
      if (payment.penalty_id) {
        await run(
          `UPDATE penalties
           SET status = 'paid',
               updated_at = ?,
               paid_at = ?
           WHERE id = ?`,
          [timestamp, timestamp, payment.penalty_id],
        );
      }
    } else if (payment.utility_charge_id) {
      await run(
        `UPDATE utility_charges
         SET status = ?,
             updated_at = ?,
             paid_at = NULL
         WHERE id = ?`,
        [getUtilityChargeResetStatus(payment.utility_charge_due_date || timestamp.slice(0, 10)), timestamp, payment.utility_charge_id],
        );
    } else if (payment.penalty_id) {
      await run(
        `UPDATE penalties
         SET status = 'unpaid',
             updated_at = ?,
             paid_at = NULL
         WHERE id = ?`,
        [timestamp, payment.penalty_id],
      );
    }
  });

  if (!statusUpdated) {
    return;
  }

  const vendorNotification = getVendorPaymentNotification({
    previousStatus: payment.status,
    nextStatus: status,
    amount: payment.amount,
    chargeType: payment.charge_type,
    itemLabel,
    providerReference,
    transactionId,
    externalReference: payment.external_reference,
    completedAt: timestamp,
  });
  if (vendorNotification) {
    await queueNotification({
      userId: payment.vendor_id,
      type: "payment",
      message: vendorNotification.message,
      channels: vendorNotification.channels,
      destinationPhone: payment.phone,
    });
  }

  await logAuditEvent({
    actorUserId: null,
    actorName: "System",
    actorRole: "admin",
    marketId: payment.market_id,
    action: status === "completed" ? "PAYMENT_COMPLETED" : "PAYMENT_FAILED",
    entityType: "payment",
    entityId: paymentId,
    details: {
      bookingId: payment.booking_id,
      utilityChargeId: payment.utility_charge_id,
      penaltyId: payment.penalty_id,
      transactionId,
      providerReference: providerReference || null,
    },
  });
};

const readPesapalNotificationPayload = async ({
  req,
  url,
}: {
  req: Parameters<RouteDefinition["handler"]>[0]["req"];
  url: URL;
}) => {
  const rawBody = await readRawBody(req);
  const merged = new Map<string, string>();

  for (const [key, value] of url.searchParams.entries()) {
    merged.set(key, value);
  }

  if (rawBody) {
    try {
      const json = JSON.parse(rawBody) as Record<string, unknown>;
      Object.entries(json).forEach(([key, value]) => {
        if (typeof value === "string") {
          merged.set(key, value);
        }
      });
    } catch {
      const params = new URLSearchParams(rawBody);
      for (const [key, value] of params.entries()) {
        merged.set(key, value);
      }
    }
  }

  return {
    orderTrackingId:
      merged.get("OrderTrackingId") || merged.get("orderTrackingId") || merged.get("order_tracking_id") || "",
    orderNotificationType:
      merged.get("OrderNotificationType") ||
      merged.get("orderNotificationType") ||
      merged.get("order_notification_type") ||
      "",
    orderMerchantReference:
      merged.get("OrderMerchantReference") ||
      merged.get("orderMerchantReference") ||
      merged.get("order_merchant_reference") ||
      "",
    rawBody,
  };
};

const applyPesapalStatus = async ({
  orderTrackingId,
  merchantReference,
}: {
  orderTrackingId: string;
  merchantReference: string;
}) => {
  const payment = await get<{
    id: string;
    status: string;
    amount: number;
    currency?: string | null;
    external_reference: string;
  }>(
    `SELECT id, status, amount, external_reference
     FROM payments
     WHERE external_reference = ?`,
    [merchantReference],
  );

  if (!payment) {
    throw new HttpError(404, "Payment not found.");
  }

  const statusResponse = await getPesapalTransactionStatus(orderTrackingId);
  const timestamp = nowIso();

  await run(
    `UPDATE payments
     SET provider_reference = ?,
         gateway_response_json = ?,
         updated_at = ?
     WHERE id = ?`,
    [orderTrackingId, JSON.stringify(statusResponse), timestamp, payment.id],
  );

  if (payment.status !== "pending") {
    return await getPaymentById(payment.id);
  }

  if (String(statusResponse.merchant_reference || "") !== payment.external_reference) {
    throw new HttpError(409, "Pesapal merchant reference did not match the expected payment.");
  }

  if (String(statusResponse.currency || "").toUpperCase() && String(statusResponse.currency || "").toUpperCase() !== "UGX") {
    throw new HttpError(409, "Pesapal transaction currency did not match UGX.");
  }

  if (Number(statusResponse.amount || 0) < Number(payment.amount)) {
    throw new HttpError(409, "Paid amount is below the expected amount.");
  }

  const outcome = getPesapalPaymentOutcome(statusResponse.payment_status_description);

  if (outcome === "completed") {
    await completePayment({
      paymentId: payment.id,
      transactionId: statusResponse.confirmation_code || orderTrackingId,
      providerReference: orderTrackingId,
      status: "completed",
      gatewayResponse: statusResponse,
    });
  } else if (outcome === "failed") {
    await completePayment({
      paymentId: payment.id,
      transactionId: statusResponse.confirmation_code || orderTrackingId,
      providerReference: orderTrackingId,
      status: "failed",
      gatewayResponse: statusResponse,
    });
  }

  return await getPaymentById(payment.id);
};

const allowedReceiptTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const generateReceiptReference = () => {
  const now = new Date();
  return `RCPT-${now.getFullYear()}-${String(now.getTime() % 100000).padStart(5, "0")}`;
};

const getManualPaymentTarget = async ({
  bookingId,
  utilityChargeId,
  penaltyId,
  vendorId,
  marketId,
}: {
  bookingId?: string | null;
  utilityChargeId?: string | null;
  penaltyId?: string | null;
  vendorId: string;
  marketId: string;
}) => {
  if (bookingId) {
    const booking = await get<{
      id: string;
      market_id: string;
      vendor_id: string;
      status: string;
      amount: number;
    }>(`SELECT id, market_id, vendor_id, status, amount FROM bookings WHERE id = ?`, [bookingId]);
    if (!booking || booking.vendor_id !== vendorId || booking.market_id !== marketId) {
      throw new HttpError(404, "Booking not found.");
    }
    if (booking.status !== "approved") {
      throw new HttpError(409, "This booking is not eligible for receipt upload.");
    }
    await assertChargeEnabled("booking_fee", booking.market_id);
    return {
      marketId: booking.market_id,
      amount: booking.amount,
      chargeType: "booking_fee",
      bookingId: booking.id,
      utilityChargeId: null,
      utilityDueDate: null,
      penaltyId: null,
      duplicateClause: "booking_id",
      duplicateId: booking.id,
    };
  }

  if (utilityChargeId) {
    const utilityCharge = await get<{
      id: string;
      market_id: string;
      vendor_id: string;
      status: string;
      amount: number;
      due_date: string;
    }>(`SELECT id, market_id, vendor_id, status, amount, due_date::text AS due_date FROM utility_charges WHERE id = ?`, [utilityChargeId]);
    if (!utilityCharge || utilityCharge.vendor_id !== vendorId || utilityCharge.market_id !== marketId) {
      throw new HttpError(404, "Utility charge not found.");
    }
    if (!["unpaid", "overdue"].includes(utilityCharge.status)) {
      throw new HttpError(409, "This utility charge is not eligible for receipt upload.");
    }
    await assertChargeEnabled("utilities", utilityCharge.market_id);
    return {
      marketId: utilityCharge.market_id,
      amount: utilityCharge.amount,
      chargeType: "utilities",
      bookingId: null,
      utilityChargeId: utilityCharge.id,
      utilityDueDate: utilityCharge.due_date,
      penaltyId: null,
      duplicateClause: "utility_charge_id",
      duplicateId: utilityCharge.id,
    };
  }

  const penalty = await get<{
    id: string;
    market_id: string;
    vendor_id: string;
    status: string;
    amount: number;
  }>(`SELECT id, market_id, vendor_id, status, amount FROM penalties WHERE id = ?`, [penaltyId]);
  if (!penalty || penalty.vendor_id !== vendorId || penalty.market_id !== marketId) {
    throw new HttpError(404, "Penalty not found.");
  }
  if (penalty.status !== "unpaid") {
    throw new HttpError(409, "This penalty is not eligible for receipt upload.");
  }
  await assertChargeEnabled("penalties", penalty.market_id);
  return {
    marketId: penalty.market_id,
    amount: penalty.amount,
    chargeType: "penalties",
    bookingId: null,
    utilityChargeId: null,
    utilityDueDate: null,
    penaltyId: penalty.id,
    duplicateClause: "penalty_id",
    duplicateId: penalty.id,
  };
};

const servePaymentReceiptFile = async ({
  res,
  payment,
}: {
  res: ServerResponse;
  payment: { receiptFilePath: string | null; receiptFileMimeType: string | null; receiptFileName: string | null };
}) => {
  if (!payment.receiptFilePath) {
    throw new HttpError(404, "Receipt file not found.");
  }

  res.setHeader("Content-Type", payment.receiptFileMimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(payment.receiptFileName || "receipt")}"`);
  res.setHeader("Cache-Control", "private, max-age=60");

  if (payment.receiptFilePath.startsWith("supabase://")) {
    const buffer = await downloadSupabaseStorageObject(payment.receiptFilePath);
    if (!buffer) {
      throw new HttpError(404, "Receipt file not found.");
    }
    res.writeHead(200);
    res.end(buffer);
    return;
  }

  if (!fs.existsSync(payment.receiptFilePath)) {
    throw new HttpError(404, "Receipt file is missing from storage.");
  }

  res.writeHead(200);
  fs.createReadStream(payment.receiptFilePath).pipe(res);
};

export const paymentRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/payments",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "payment:read", url.searchParams.get("marketId"));
      const clauses: string[] = [];
      const params: string[] = [];

      if (marketId) {
        clauses.push("payments.market_id = ?");
        params.push(marketId);
      }
      if (session.user.role === "vendor") {
        clauses.push("payments.vendor_id = ?");
        params.push(session.user.id);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const payments = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        booking_id: string | null;
        utility_charge_id: string | null;
        penalty_id: string | null;
        vendor_id: string;
        provider: string;
        charge_type: string;
        amount: number;
        status: string;
        transaction_id: string | null;
        provider_reference: string | null;
        external_reference: string;
        phone: string;
        receipt_id: string | null;
        receipt_message: string | null;
        receipt_file_name: string | null;
        receipt_file_path: string | null;
        receipt_file_mime_type: string | null;
        receipt_file_size: number | null;
        verification_note: string | null;
        created_at: string;
        updated_at: string;
        completed_at: string | null;
        vendor_name: string;
        stall_name: string | null;
        utility_charge_description: string | null;
        utility_charge_type: string | null;
        utility_charge_billing_period: string | null;
        penalty_reason: string | null;
      }>(`${paymentSelect} ${whereClause} ORDER BY payments.created_at DESC`, params);
      sendJson(res, 200, { payments: payments.map(mapPayment) });
    },
  },
  {
    method: "POST",
    path: "/payments/initiate",
    handler: async ({ req, res, auth }) => {
      const { session, marketId } = resolveScopedMarket(auth, "payment:create");
      if (session.user.role !== "vendor") {
        throw new HttpError(403, "Only vendors can initiate payments.");
      }
      if (!marketId) {
        throw new HttpError(403, "Your account is not assigned to a market.");
      }
      if (!config.paymentsEnabled) {
        throw new HttpError(503, "Payments are currently disabled.");
      }

      const body = await readJsonBody<{
        bookingId?: string | null;
        utilityChargeId?: string | null;
        penaltyId?: string | null;
        receiptNumber?: string | null;
        receiptNote?: string | null;
        receiptFile?: FilePayload | null;
      }>(req);
      const bookingId = body.bookingId?.trim() || null;
      const utilityChargeId = body.utilityChargeId?.trim() || null;
      const penaltyId = body.penaltyId?.trim() || null;

      const targetCount = [bookingId, utilityChargeId, penaltyId].filter(Boolean).length;
      if (targetCount !== 1) {
        throw new HttpError(400, "Provide exactly one booking, utility charge, or penalty to pay.");
      }

      if (body.receiptFile) {
        validateFilePayload(body.receiptFile, allowedReceiptTypes, true);
        const target = await getManualPaymentTarget({
          bookingId,
          utilityChargeId,
          penaltyId,
          vendorId: session.user.id,
          marketId,
        });
        if (target.amount <= 0) {
          throw new HttpError(409, "There is no payment due for this record.");
        }

        const existingPending = await get<{ id: string }>(
          `SELECT id FROM payments WHERE ${target.duplicateClause} = ? AND status = 'pending'`,
          [target.duplicateId],
        );
        if (existingPending) {
          throw new HttpError(409, "A receipt is already awaiting verification for this record.");
        }

        const paymentId = createId("payment");
        const receiptReference = body.receiptNumber?.trim() || generateReceiptReference();
        const receiptMessage = body.receiptNote?.trim() || "Receipt uploaded and awaiting verification.";
        const timestamp = nowIso();
        const file = await persistFilePayload("payment-receipts", paymentId, body.receiptFile);

        await transaction(async () => {
          await run(
            `INSERT INTO payments (
               id, market_id, booking_id, utility_charge_id, penalty_id, vendor_id, provider, charge_type,
               amount, status, transaction_id, provider_reference, external_reference, phone,
               receipt_id, receipt_message, receipt_file_name, receipt_file_path, receipt_file_mime_type,
               receipt_file_size, verification_note, gateway_response_json, created_at, updated_at, completed_at
             )
             VALUES (?, ?, ?, ?, ?, ?, 'receipt', ?, ?, 'pending', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
            [
              paymentId,
              target.marketId,
              target.bookingId,
              target.utilityChargeId,
              target.penaltyId,
              session.user.id,
              target.chargeType,
              target.amount,
              receiptReference,
              paymentId,
              session.user.phone,
              receiptReference,
              receiptMessage,
              file.name,
              file.storagePath,
              file.mimeType,
              file.size,
              timestamp,
              timestamp,
            ],
          );
          await run(
            `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
             VALUES (?, ?, 'receipt', 'pending', ?, ?)`,
            [createId("attempt"), paymentId, timestamp, timestamp],
          );

          if (target.utilityChargeId) {
            await run(
              `UPDATE utility_charges
               SET status = 'pending',
                   updated_at = ?,
                   paid_at = NULL
               WHERE id = ?`,
              [timestamp, target.utilityChargeId],
            );
          }
          if (target.penaltyId) {
            await run(
              `UPDATE penalties
               SET status = 'pending',
                   updated_at = ?,
                   paid_at = NULL
               WHERE id = ?`,
              [timestamp, target.penaltyId],
            );
          }
        });

        await logAuditEvent({
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          marketId: target.marketId,
          action: "UPLOAD_RECEIPT",
          entityType: "payment",
          entityId: paymentId,
          details: {
            receiptReference,
            bookingId,
            utilityChargeId,
            penaltyId,
          },
        });

        sendJson(res, 201, {
          payment: await getPaymentById(paymentId),
          status: "pending",
          redirectUrl: "",
          orderTrackingId: "",
          iframe: false,
          message: "Receipt uploaded for verification.",
        });
        return;
      }

      const paymentId = createId("payment");
      const externalReference = paymentId;
      const timestamp = nowIso();
      const { firstName, lastName } = splitName(session.user.name);

      if (bookingId) {
        const booking = await get<{
          id: string;
          market_id: string;
          vendor_id: string;
          status: string;
          amount: number;
        }>(`SELECT id, market_id, vendor_id, status, amount FROM bookings WHERE id = ?`, [bookingId]);
        if (!booking || booking.vendor_id !== session.user.id) {
          throw new HttpError(404, "Booking not found.");
        }
        if (booking.market_id !== marketId) {
          throw new HttpError(403, "You do not have access to that booking.");
        }
        if (booking.status !== "approved") {
          throw new HttpError(409, "This booking is not eligible for payment.");
        }

        await assertChargeEnabled("payment_gateway", booking.market_id);
        await assertChargeEnabled("booking_fee", booking.market_id);

        const existingPending = await get<{ id: string }>(
          `SELECT id FROM payments WHERE booking_id = ? AND status = 'pending'`,
          [bookingId],
        );
        if (existingPending) {
          throw new HttpError(409, "A payment is already in progress for this booking.");
        }

        await transaction(async () => {
          await run(
            `INSERT INTO payments (id, market_id, booking_id, utility_charge_id, vendor_id, provider, charge_type, amount, status, transaction_id, provider_reference, external_reference, phone, receipt_id, receipt_message, gateway_response_json, created_at, updated_at, completed_at)
             VALUES (?, ?, ?, NULL, ?, ?, 'booking_fee', ?, 'pending', NULL, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)`,
            [
              paymentId,
              booking.market_id,
              bookingId,
              session.user.id,
              "pesapal",
              booking.amount,
              null,
              externalReference,
              session.user.phone,
              null,
              timestamp,
              timestamp,
            ],
          );
          await run(
            `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
             VALUES (?, ?, ?, 'pending', ?, ?)`,
            [createId("attempt"), paymentId, "pesapal", timestamp, timestamp],
          );
        });

        try {
          const order = await submitPesapalOrder({
            id: externalReference,
            amount: booking.amount,
            description: `Payment for booking ${booking.id}`,
            callbackUrl: config.pesapalCallbackUrl,
            notificationId: config.pesapalIpnId,
            email: session.user.email,
            phone: session.user.phone,
            firstName,
            lastName,
            accountNumber: booking.id,
          });

          if (!order.order_tracking_id || !order.redirect_url) {
            await failPaymentInitiation({
              paymentId,
              gatewayResponse: order,
              message: order.message || "Pesapal order creation failed.",
            });
            throw new HttpError(502, order.message || "Failed to create Pesapal checkout session.");
          }

          await run(
            `UPDATE payments
             SET transaction_id = ?,
                 provider_reference = ?,
                 gateway_response_json = ?,
                 updated_at = ?
             WHERE id = ?`,
            [order.order_tracking_id, order.order_tracking_id, JSON.stringify(order), nowIso(), paymentId],
          );

          await logAuditEvent({
            actorUserId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
            marketId: booking.market_id,
            action: "INITIATE_PAYMENT",
            entityType: "payment",
            entityId: paymentId,
            details: {
              bookingId,
              provider: "pesapal",
              merchantReference: externalReference,
              orderTrackingId: order.order_tracking_id,
            },
          });

          sendJson(res, 201, {
            payment: await getPaymentById(paymentId),
            status: "pending",
            redirectUrl: order.redirect_url,
            orderTrackingId: order.order_tracking_id,
            iframe: config.pesapalUseIframe,
            message: "Redirecting to Pesapal secure checkout.",
          });
          return;
        } catch (error) {
          if (error instanceof HttpError) {
            throw error;
          }

          await failPaymentInitiation({
            paymentId,
            gatewayResponse: {
              message: error instanceof Error ? error.message : "Pesapal order creation failed.",
            },
            message: error instanceof Error ? error.message : "Pesapal order creation failed.",
          });
          throw new HttpError(502, "Failed to initiate Pesapal checkout.", error);
        }
      }

      if (utilityChargeId) {
      const utilityCharge = await get<{
        id: string;
        market_id: string;
        vendor_id: string;
        status: string;
        amount: number;
        description: string;
        utility_type: string;
        billing_period: string;
        due_date: string;
      }>(
        `SELECT id,
                market_id,
                vendor_id,
                status,
                amount,
                description,
                utility_type,
                billing_period,
                due_date::text AS due_date
         FROM utility_charges
         WHERE id = ?`,
        [utilityChargeId],
      );
      if (!utilityCharge || utilityCharge.vendor_id !== session.user.id) {
        throw new HttpError(404, "Utility charge not found.");
      }
      if (utilityCharge.market_id !== marketId) {
        throw new HttpError(403, "You do not have access to that utility charge.");
      }
      if (!["unpaid", "overdue"].includes(utilityCharge.status)) {
        throw new HttpError(409, "This utility charge is not eligible for payment.");
      }

      await assertChargeEnabled("payment_gateway", utilityCharge.market_id);
      await assertChargeEnabled("utilities", utilityCharge.market_id);

      const existingPending = await get<{ id: string }>(
        `SELECT id FROM payments WHERE utility_charge_id = ? AND status = 'pending'`,
        [utilityCharge.id],
      );
      if (existingPending) {
        throw new HttpError(409, "A payment is already in progress for this utility charge.");
      }

      const utilityItemLabel = getUtilityChargeDisplayName({
        utilityType: utilityCharge.utility_type,
        description: utilityCharge.description,
        billingPeriod: utilityCharge.billing_period,
      });

      await transaction(async () => {
        await run(
          `INSERT INTO payments (id, market_id, booking_id, utility_charge_id, vendor_id, provider, charge_type, amount, status, transaction_id, provider_reference, external_reference, phone, receipt_id, receipt_message, gateway_response_json, created_at, updated_at, completed_at)
           VALUES (?, ?, NULL, ?, ?, ?, 'utilities', ?, 'pending', NULL, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)`,
          [
            paymentId,
            utilityCharge.market_id,
            utilityCharge.id,
            session.user.id,
            "pesapal",
            utilityCharge.amount,
            null,
            externalReference,
            session.user.phone,
            null,
            timestamp,
            timestamp,
          ],
        );
        await run(
          `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?)`,
          [createId("attempt"), paymentId, "pesapal", timestamp, timestamp],
        );

        const utilityChargeUpdate = await run(
          `UPDATE utility_charges
           SET status = 'pending',
               updated_at = ?,
               paid_at = NULL
           WHERE id = ?
             AND status IN ('unpaid', 'overdue')`,
          [timestamp, utilityCharge.id],
        );
        if (utilityChargeUpdate.rowCount === 0) {
          throw new HttpError(409, "This utility charge is no longer available for payment.");
        }
      });

      try {
        const order = await submitPesapalOrder({
          id: externalReference,
          amount: utilityCharge.amount,
          description: utilityItemLabel,
          callbackUrl: config.pesapalCallbackUrl,
          notificationId: config.pesapalIpnId,
          email: session.user.email,
          phone: session.user.phone,
          firstName,
          lastName,
          accountNumber: utilityCharge.id,
        });

        if (!order.order_tracking_id || !order.redirect_url) {
          await failPaymentInitiation({
            paymentId,
            utilityChargeId: utilityCharge.id,
            utilityChargeDueDate: utilityCharge.due_date,
            gatewayResponse: order,
            message: order.message || "Pesapal order creation failed.",
          });
          throw new HttpError(502, order.message || "Failed to create Pesapal checkout session.");
        }

        await run(
          `UPDATE payments
           SET transaction_id = ?,
               provider_reference = ?,
               gateway_response_json = ?,
               updated_at = ?
           WHERE id = ?`,
          [order.order_tracking_id, order.order_tracking_id, JSON.stringify(order), nowIso(), paymentId],
        );

        await logAuditEvent({
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          marketId: utilityCharge.market_id,
          action: "INITIATE_PAYMENT",
          entityType: "payment",
          entityId: paymentId,
          details: {
            utilityChargeId: utilityCharge.id,
            provider: "pesapal",
            merchantReference: externalReference,
            orderTrackingId: order.order_tracking_id,
          },
        });

        sendJson(res, 201, {
          payment: await getPaymentById(paymentId),
          status: "pending",
          redirectUrl: order.redirect_url,
          orderTrackingId: order.order_tracking_id,
          iframe: config.pesapalUseIframe,
          message: "Redirecting to Pesapal secure checkout.",
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        await failPaymentInitiation({
          paymentId,
          utilityChargeId: utilityCharge.id,
          utilityChargeDueDate: utilityCharge.due_date,
          gatewayResponse: {
            message: error instanceof Error ? error.message : "Pesapal order creation failed.",
          },
          message: error instanceof Error ? error.message : "Pesapal order creation failed.",
        });
        throw new HttpError(502, "Failed to initiate Pesapal checkout.", error);
      }
      return;
      }

      const penalty = await get<{
        id: string;
        market_id: string;
        vendor_id: string;
        status: string;
        amount: number;
        reason: string;
      }>(
        `SELECT id,
                market_id,
                vendor_id,
                status,
                amount,
                reason
         FROM penalties
         WHERE id = ?`,
        [penaltyId],
      );
      if (!penalty || penalty.vendor_id !== session.user.id) {
        throw new HttpError(404, "Penalty not found.");
      }
      if (penalty.market_id !== marketId) {
        throw new HttpError(403, "You do not have access to that penalty.");
      }
      if (penalty.status !== "unpaid") {
        throw new HttpError(409, "This penalty is not eligible for payment.");
      }

      await assertChargeEnabled("payment_gateway", penalty.market_id);
      await assertChargeEnabled("penalties", penalty.market_id);

      const existingPendingPenaltyPayment = await get<{ id: string }>(
        `SELECT id FROM payments WHERE penalty_id = ? AND status = 'pending'`,
        [penalty.id],
      );
      if (existingPendingPenaltyPayment) {
        throw new HttpError(409, "A payment is already in progress for this penalty.");
      }

      const penaltyItemLabel = getPenaltyDisplayName(penalty.reason);

      await transaction(async () => {
        await run(
          `INSERT INTO payments (id, market_id, booking_id, utility_charge_id, penalty_id, vendor_id, provider, charge_type, amount, status, transaction_id, provider_reference, external_reference, phone, receipt_id, receipt_message, gateway_response_json, created_at, updated_at, completed_at)
           VALUES (?, ?, NULL, NULL, ?, ?, ?, 'penalties', ?, 'pending', NULL, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)`,
          [
            paymentId,
            penalty.market_id,
            penalty.id,
            session.user.id,
            "pesapal",
            penalty.amount,
            null,
            externalReference,
            session.user.phone,
            null,
            timestamp,
            timestamp,
          ],
        );
        await run(
          `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?)`,
          [createId("attempt"), paymentId, "pesapal", timestamp, timestamp],
        );

        const penaltyUpdate = await run(
          `UPDATE penalties
           SET status = 'pending',
               updated_at = ?,
               paid_at = NULL
           WHERE id = ?
             AND status = 'unpaid'`,
          [timestamp, penalty.id],
        );
        if (penaltyUpdate.rowCount === 0) {
          throw new HttpError(409, "This penalty is no longer available for payment.");
        }
      });

      try {
        const order = await submitPesapalOrder({
          id: externalReference,
          amount: penalty.amount,
          description: penaltyItemLabel,
          callbackUrl: config.pesapalCallbackUrl,
          notificationId: config.pesapalIpnId,
          email: session.user.email,
          phone: session.user.phone,
          firstName,
          lastName,
          accountNumber: penalty.id,
        });

        if (!order.order_tracking_id || !order.redirect_url) {
          await failPaymentInitiation({
            paymentId,
            penaltyId: penalty.id,
            gatewayResponse: order,
            message: order.message || "Pesapal order creation failed.",
          });
          throw new HttpError(502, order.message || "Failed to create Pesapal checkout session.");
        }

        await run(
          `UPDATE payments
           SET transaction_id = ?,
               provider_reference = ?,
               gateway_response_json = ?,
               updated_at = ?
           WHERE id = ?`,
          [order.order_tracking_id, order.order_tracking_id, JSON.stringify(order), nowIso(), paymentId],
        );

        await logAuditEvent({
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          marketId: penalty.market_id,
          action: "INITIATE_PAYMENT",
          entityType: "payment",
          entityId: paymentId,
          details: {
            penaltyId: penalty.id,
            provider: "pesapal",
            merchantReference: externalReference,
            orderTrackingId: order.order_tracking_id,
          },
        });

        sendJson(res, 201, {
          payment: await getPaymentById(paymentId),
          status: "pending",
          redirectUrl: order.redirect_url,
          orderTrackingId: order.order_tracking_id,
          iframe: config.pesapalUseIframe,
          message: "Redirecting to Pesapal secure checkout.",
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        await failPaymentInitiation({
          paymentId,
          penaltyId: penalty.id,
          gatewayResponse: {
            message: error instanceof Error ? error.message : "Pesapal order creation failed.",
          },
          message: error instanceof Error ? error.message : "Pesapal order creation failed.",
        });
        throw new HttpError(502, "Failed to initiate Pesapal checkout.", error);
      }
    },
  },
  {
    method: "POST",
    path: "/payments/webhooks/pesapal",
    handler: async ({ req, res, url }) => {
      const payload = await readPesapalNotificationPayload({ req, url });

      if (!payload.orderTrackingId || !payload.orderMerchantReference) {
        throw new HttpError(400, "Missing Pesapal IPN fields.");
      }

      await recordPaymentWebhookEvent({
        provider: "pesapal",
        txRef: payload.orderMerchantReference,
        transactionId: payload.orderTrackingId,
        eventType: payload.orderNotificationType || "IPN",
        payload: payload.rawBody
          ? (() => {
              try {
                return JSON.parse(payload.rawBody);
              } catch {
                return {
                  OrderTrackingId: payload.orderTrackingId,
                  OrderMerchantReference: payload.orderMerchantReference,
                  OrderNotificationType: payload.orderNotificationType || "IPN",
                };
              }
            })()
          : {
              OrderTrackingId: payload.orderTrackingId,
              OrderMerchantReference: payload.orderMerchantReference,
              OrderNotificationType: payload.orderNotificationType || "IPN",
            },
      });

      await applyPesapalStatus({
        orderTrackingId: payload.orderTrackingId,
        merchantReference: payload.orderMerchantReference,
      });

      sendJson(res, 200, { status: 200, message: "IPN received" });
    },
  },
  {
    method: "GET",
    path: "/payments/pesapal/callback-status",
    handler: async ({ req, res, url }) => {
      const payload = await readPesapalNotificationPayload({ req, url });

      if (!payload.orderTrackingId || !payload.orderMerchantReference) {
        throw new HttpError(400, "Missing callback query parameters.");
      }

      await recordPaymentWebhookEvent({
        provider: "pesapal",
        txRef: payload.orderMerchantReference,
        transactionId: payload.orderTrackingId,
        eventType: payload.orderNotificationType || "CALLBACKURL",
        payload: {
          OrderTrackingId: payload.orderTrackingId,
          OrderMerchantReference: payload.orderMerchantReference,
          OrderNotificationType: payload.orderNotificationType || "CALLBACKURL",
        },
      });

      const payment = await applyPesapalStatus({
        orderTrackingId: payload.orderTrackingId,
        merchantReference: payload.orderMerchantReference,
      });

      sendJson(res, 200, {
        ok: true,
        payment,
      });
    },
  },
  {
    method: "GET",
    path: "/payments/:id/receipt",
    handler: async ({ res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "payment:read");
      const payment = await getPaymentById(params.id);
      if (!payment) {
        throw new HttpError(404, "Payment not found.");
      }
      if (session.user.role === "vendor" && payment.vendorId !== session.user.id) {
        throw new HttpError(403, "You may only view your own receipts.");
      }
      assertMarketAccess(session, payment.marketId);
      if (payment.status !== "completed" || !payment.receiptId || !payment.completedAt) {
        throw new HttpError(409, "Receipt is only available after confirmed payment.");
      }
      sendJson(res, 200, {
        receipt: {
          paymentId: payment.id,
          receiptId: payment.receiptId,
          message: payment.receiptMessage,
          transactionId: payment.transactionId,
          amount: payment.amount,
          createdAt: payment.completedAt || payment.updatedAt,
        },
      });
    },
  },
];
