import { assertChargeEnabled } from "../lib/billing.ts";
import { all, createId, get, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { initiateFlutterwaveUgandaCharge, isValidFlutterwaveWebhook, verifyFlutterwaveTransaction } from "../lib/flutterwave.ts";
import { HttpError, readJsonBody, readRawBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { normalizePhoneNumber, nowIso } from "../lib/security.ts";
import { config } from "../config.ts";

const paymentSelect = `
  SELECT payments.id,
         payments.market_id,
         markets.name AS market_name,
         payments.booking_id,
         payments.vendor_id,
         payments.provider,
         payments.charge_type,
         payments.amount,
         payments.status,
         payments.transaction_id,
         payments.provider_reference,
         payments.external_reference,
         payments.phone,
         payments.receipt_id,
         payments.receipt_message,
         payments.created_at,
         payments.updated_at,
         payments.completed_at,
         users.name AS vendor_name,
         stalls.name AS stall_name
  FROM payments
  INNER JOIN users ON users.id = payments.vendor_id
  INNER JOIN bookings ON bookings.id = payments.booking_id
  INNER JOIN stalls ON stalls.id = bookings.stall_id
  LEFT JOIN markets ON markets.id = payments.market_id
`;

const mapPayment = (row: {
  id: string;
  market_id: string | null;
  market_name: string | null;
  booking_id: string;
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
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  vendor_name: string;
  stall_name: string;
}) => ({
  id: row.id,
  marketId: row.market_id,
  marketName: row.market_name,
  bookingId: row.booking_id,
  vendorId: row.vendor_id,
  vendorName: row.vendor_name,
  stallName: row.stall_name,
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
});

const getPaymentById = async (paymentId: string) => {
  const payment = await get<{
    id: string;
    market_id: string | null;
    market_name: string | null;
    booking_id: string;
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
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    vendor_name: string;
    stall_name: string;
  }>(`${paymentSelect} WHERE payments.id = ?`, [paymentId]);

  return payment ? mapPayment(payment) : null;
};

const completePayment = async ({
  paymentId,
  transactionId,
  providerReference,
  status,
  gatewayResponse,
}: {
  paymentId: string;
  transactionId: string;
  providerReference?: string | null;
  status: "completed" | "failed";
  gatewayResponse?: unknown;
}) => {
  const payment = await get<{
    id: string;
    status: string;
    market_id: string | null;
    booking_id: string;
    vendor_id: string;
    amount: number;
    phone: string;
    vendor_name: string;
    stall_name: string;
  }>(
    `SELECT payments.id,
            payments.status,
            payments.market_id,
            payments.booking_id,
            payments.vendor_id,
            payments.amount,
            payments.phone,
            users.name AS vendor_name,
            stalls.name AS stall_name
     FROM payments
     INNER JOIN users ON users.id = payments.vendor_id
     INNER JOIN bookings ON bookings.id = payments.booking_id
     INNER JOIN stalls ON stalls.id = bookings.stall_id
     WHERE payments.id = ?`,
    [paymentId],
  );

  if (!payment || payment.status !== "pending") {
    return;
  }

  const timestamp = nowIso();
  const receiptId = status === "completed" ? `RCPT-${paymentId.slice(-6).toUpperCase()}` : null;
  const receiptMessage =
    status === "completed"
      ? `Payment of UGX ${payment.amount.toLocaleString()} confirmed. Transaction ID ${transactionId}.`
      : `Payment for ${payment.stall_name} failed. Reference ${providerReference || transactionId}.`;

  await transaction(async () => {
    await run(
      `UPDATE payments
       SET status = ?,
           transaction_id = ?,
           provider_reference = ?,
           receipt_id = ?,
           receipt_message = ?,
           gateway_response_json = ?,
           updated_at = ?,
           completed_at = ?
       WHERE id = ?`,
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
    await run(`UPDATE payment_attempts SET status = ?, updated_at = ? WHERE payment_id = ?`, [status, timestamp, paymentId]);

    if (status === "completed") {
      await run(`UPDATE bookings SET status = 'paid', updated_at = ? WHERE id = ?`, [timestamp, payment.booking_id]);
    }
  });

  await queueNotification({
    userId: payment.vendor_id,
    type: "payment",
    message: receiptMessage,
    channels: ["system", "sms"],
    destinationPhone: payment.phone,
  });
  await logAuditEvent({
    actorUserId: null,
    actorName: "System",
    actorRole: "admin",
    marketId: payment.market_id,
    action: status === "completed" ? "PAYMENT_COMPLETED" : "PAYMENT_FAILED",
    entityType: "payment",
    entityId: paymentId,
    details: { transactionId, providerReference: providerReference || null },
  });
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
        booking_id: string;
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
        created_at: string;
        updated_at: string;
        completed_at: string | null;
        vendor_name: string;
        stall_name: string;
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

      const body = await readJsonBody<{ bookingId?: string; provider?: "mtn" | "airtel"; phoneNumber?: string }>(req);
      if (!body.bookingId || !body.provider || !body.phoneNumber) {
        throw new HttpError(400, "Booking, payment network, and phone number are required.");
      }

      const normalizedPhoneNumber = normalizePhoneNumber(body.phoneNumber);
      const booking = await get<{
        id: string;
        market_id: string;
        vendor_id: string;
        status: string;
        amount: number;
      }>(`SELECT id, market_id, vendor_id, status, amount FROM bookings WHERE id = ?`, [body.bookingId]);
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
        [body.bookingId],
      );
      if (existingPending) {
        throw new HttpError(409, "A payment is already in progress for this booking.");
      }

      const txRef = createId("flwtx");
      const chargeResponse = await initiateFlutterwaveUgandaCharge({
        secretKey: config.flutterwaveSecret,
        txRef,
        amount: booking.amount,
        email: session.user.email,
        phoneNumber: normalizedPhoneNumber,
        network: body.provider,
        fullname: session.user.name,
      });

      const providerReference =
        chargeResponse.data?.reference != null
          ? String(chargeResponse.data.reference)
          : chargeResponse.data?.id != null
            ? String(chargeResponse.data.id)
            : null;

      const paymentId = createId("payment");
      const timestamp = nowIso();
      await transaction(async () => {
        await run(
          `INSERT INTO payments (id, market_id, booking_id, vendor_id, provider, charge_type, amount, status, transaction_id, provider_reference, external_reference, phone, receipt_id, receipt_message, gateway_response_json, created_at, updated_at, completed_at)
           VALUES (?, ?, ?, ?, ?, 'booking_fee', ?, 'pending', NULL, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)`,
          [
            paymentId,
            booking.market_id,
            body.bookingId,
            session.user.id,
            body.provider,
            booking.amount,
            providerReference,
            txRef,
            normalizedPhoneNumber,
            JSON.stringify(chargeResponse),
            timestamp,
            timestamp,
          ],
        );
        await run(
          `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?)`,
          [createId("attempt"), paymentId, body.provider, timestamp, timestamp],
        );
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: booking.market_id,
        action: "INITIATE_PAYMENT",
        entityType: "payment",
        entityId: paymentId,
        details: {
          bookingId: body.bookingId,
          provider: body.provider,
          txRef,
        },
      });

      sendJson(res, 201, {
        payment: await getPaymentById(paymentId),
        status: "pending",
        message: "Payment initiated. Approve the mobile money prompt on your phone.",
      });
    },
  },
  {
    method: "POST",
    path: "/payments/webhooks/flutterwave",
    handler: async ({ req, res }) => {
      const rawBody = await readRawBody(req);
      const signatureHeader = req.headers["flutterwave-signature"];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

      if (
        !isValidFlutterwaveWebhook({
          rawBody,
          signature,
          secretHash: config.flutterwaveWebhookSecret,
        })
      ) {
        throw new HttpError(401, "Invalid Flutterwave webhook signature.");
      }

      let payload: {
        id?: string;
        type?: string;
        data?: {
          id?: string | number;
          tx_ref?: string;
          txRef?: string;
          reference?: string;
          status?: string;
        };
      };

      try {
        payload = JSON.parse(rawBody);
      } catch (error) {
        throw new HttpError(400, "Invalid Flutterwave webhook payload.", error);
      }

      const webhookId = payload.id?.trim();
      if (!webhookId) {
        throw new HttpError(400, "Flutterwave webhook is missing an event id.");
      }

      const existingEvent = await get<{ processed_at: string | null }>(
        `SELECT processed_at FROM payment_webhook_events WHERE id = ?`,
        [webhookId],
      );
      if (existingEvent?.processed_at) {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (!existingEvent) {
        await run(
          `INSERT INTO payment_webhook_events (id, provider, tx_ref, transaction_id, event_type, payload_json, created_at, processed_at)
           VALUES (?, 'flutterwave', ?, ?, ?, ?, ?, NULL)`,
          [
            webhookId,
            payload.data?.tx_ref || payload.data?.txRef || payload.data?.reference || null,
            payload.data?.id != null ? String(payload.data.id) : null,
            payload.type || null,
            rawBody,
            nowIso(),
          ],
        );
      }

      const txRef = payload.data?.tx_ref || payload.data?.txRef || payload.data?.reference || "";
      const transactionId = payload.data?.id != null ? String(payload.data.id) : "";
      const webhookStatus = (payload.data?.status || "").toLowerCase();

      const payment = txRef
        ? await get<{ id: string; amount: number; external_reference: string }>(
            `SELECT id, amount, external_reference FROM payments WHERE external_reference = ?`,
            [txRef],
          )
        : null;

      if (!payment || !transactionId) {
        await run(`UPDATE payment_webhook_events SET processed_at = ? WHERE id = ?`, [nowIso(), webhookId]);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (webhookStatus === "successful" || webhookStatus === "succeeded") {
        const verification = await verifyFlutterwaveTransaction({
          secretKey: config.flutterwaveSecret,
          transactionId,
        });

        const verified = verification.data;
        const verifiedStatus = (verified?.status || "").toLowerCase();
        if (
          !verified ||
          !String(verified.tx_ref || "").trim() ||
          String(verified.tx_ref) !== payment.external_reference ||
          Number(verified.amount || 0) !== payment.amount ||
          String(verified.currency || "").toUpperCase() !== "UGX" ||
          (verifiedStatus !== "successful" && verifiedStatus !== "succeeded")
        ) {
          throw new HttpError(409, "Flutterwave verification did not match the expected transaction.");
        }

        await completePayment({
          paymentId: payment.id,
          transactionId: String(verified.id || transactionId),
          providerReference: verified.reference ? String(verified.reference) : null,
          status: "completed",
          gatewayResponse: verification,
        });
      } else if (webhookStatus === "failed" || webhookStatus === "cancelled") {
        await completePayment({
          paymentId: payment.id,
          transactionId,
          providerReference: payload.data?.reference ? String(payload.data.reference) : null,
          status: "failed",
          gatewayResponse: payload,
        });
      }

      await run(`UPDATE payment_webhook_events SET processed_at = ? WHERE id = ?`, [nowIso(), webhookId]);
      sendJson(res, 200, { ok: true });
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
