import { all, createId, get, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";
import { config } from "../config.ts";

const paymentSelect = `
  SELECT payments.id,
         payments.market_id,
         markets.name AS market_name,
         payments.booking_id,
         payments.vendor_id,
         payments.provider,
         payments.amount,
         payments.status,
         payments.transaction_id,
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
  amount: number;
  status: string;
  transaction_id: string | null;
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
  amount: row.amount,
  status: row.status,
  transactionId: row.transaction_id,
  externalReference: row.external_reference,
  phone: row.phone,
  receiptId: row.receipt_id,
  receiptMessage: row.receipt_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
});

const getPaymentById = (paymentId: string) => {
  const payment = get<{
    id: string;
    market_id: string | null;
    market_name: string | null;
    booking_id: string;
    vendor_id: string;
    provider: string;
    amount: number;
    status: string;
    transaction_id: string | null;
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

const completePayment = ({
  paymentId,
  transactionId,
  status,
}: {
  paymentId: string;
  transactionId: string;
  status: "completed" | "failed";
}) => {
  const payment = get<{
    id: string;
    market_id: string | null;
    booking_id: string;
    vendor_id: string;
    amount: number;
    phone: string;
    vendor_name: string;
    stall_name: string;
  }>(
    `SELECT payments.id, payments.market_id, payments.booking_id, payments.vendor_id, payments.amount, payments.phone, users.name AS vendor_name, stalls.name AS stall_name
     FROM payments
     INNER JOIN users ON users.id = payments.vendor_id
     INNER JOIN bookings ON bookings.id = payments.booking_id
     INNER JOIN stalls ON stalls.id = bookings.stall_id
     WHERE payments.id = ?`,
    [paymentId],
  );

  if (!payment) {
    return;
  }

  const timestamp = nowIso();
  const receiptId = `RCPT-${paymentId.slice(-6).toUpperCase()}`;
  const receiptMessage =
    status === "completed"
      ? `Payment of UGX ${payment.amount.toLocaleString()} confirmed. Transaction ID ${transactionId}.`
      : `Payment for ${payment.stall_name} failed. Reference ${transactionId}.`;

  transaction(() => {
    run(
      `UPDATE payments
       SET status = ?, transaction_id = ?, receipt_id = ?, receipt_message = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`,
      [status, transactionId, receiptId, receiptMessage, timestamp, status === "completed" ? timestamp : null, paymentId],
    );
    run(`UPDATE payment_attempts SET status = ?, updated_at = ? WHERE payment_id = ?`, [status, timestamp, paymentId]);

    if (status === "completed") {
      run(`UPDATE bookings SET status = 'paid', updated_at = ? WHERE id = ?`, [timestamp, payment.booking_id]);
      run(
        `UPDATE stalls
         SET status = 'paid',
             updated_at = ?
         WHERE id = (SELECT stall_id FROM bookings WHERE id = ?)`,
        [timestamp, payment.booking_id],
      );
    }
  });

  queueNotification({
    userId: payment.vendor_id,
    type: "payment",
    message: receiptMessage,
    channels: ["system", "sms"],
    destinationPhone: payment.phone,
  });
  logAuditEvent({
    actorUserId: null,
    actorName: "System",
    actorRole: "manager",
    marketId: payment.market_id,
    action: status === "completed" ? "PAYMENT_COMPLETED" : "PAYMENT_FAILED",
    entityType: "payment",
    entityId: paymentId,
    details: { transactionId },
  });
};

export const settlePendingPayments = () => {
  const duePayments = all<{
    payment_id: string;
    created_at: string;
    provider: string;
    payment_status: string;
  }>(
    `SELECT payment_attempts.payment_id, payment_attempts.created_at, payment_attempts.provider, payments.status AS payment_status
     FROM payment_attempts
     INNER JOIN payments ON payments.id = payment_attempts.payment_id
     WHERE payment_attempts.status = 'pending' AND payments.status = 'pending'`,
  );

  duePayments.forEach((attempt) => {
    if (Date.now() - new Date(attempt.created_at).getTime() < config.paymentSettlementDelayMs) {
      return;
    }

    const providerPrefix = attempt.provider.toUpperCase();
    const transactionId = `${providerPrefix}-${Date.now()}`;
    completePayment({
      paymentId: attempt.payment_id,
      transactionId,
      status: "completed",
    });
  });
};

export const paymentRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/payments",
    handler: ({ res, auth, url }) => {
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
      const payments = all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        booking_id: string;
        vendor_id: string;
        provider: string;
        amount: number;
        status: string;
        transaction_id: string | null;
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

      const body = await readJsonBody<{ bookingId: string; provider: "mtn" | "airtel" }>(req);
      if (!body.bookingId || !body.provider) {
        throw new HttpError(400, "Booking and payment provider are required.");
      }

      const booking = get<{
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
      if (!["reserved", "paid"].includes(booking.status)) {
        throw new HttpError(409, "This booking is not eligible for payment.");
      }

      const existingPending = get<{ id: string }>(
        `SELECT id FROM payments WHERE booking_id = ? AND status = 'pending'`,
        [body.bookingId],
      );
      if (existingPending) {
        throw new HttpError(409, "A payment is already in progress for this booking.");
      }

      const paymentId = createId("payment");
      const externalReference = `EXT-${Date.now()}`;
      const timestamp = nowIso();
      transaction(() => {
        run(
          `INSERT INTO payments (id, market_id, booking_id, vendor_id, provider, amount, status, transaction_id, external_reference, phone, receipt_id, receipt_message, created_at, updated_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, NULL, NULL, ?, ?, NULL)`,
          [
            paymentId,
            booking.market_id,
            body.bookingId,
            session.user.id,
            body.provider,
            booking.amount,
            externalReference,
            session.user.phone,
            timestamp,
            timestamp,
          ],
        );
        run(
          `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?)`,
          [createId("attempt"), paymentId, body.provider, timestamp, timestamp],
        );
      });

      logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: booking.market_id,
        action: "INITIATE_PAYMENT",
        entityType: "payment",
        entityId: paymentId,
        details: { bookingId: body.bookingId, provider: body.provider },
      });

      sendJson(res, 201, {
        payment: getPaymentById(paymentId),
        status: "pending",
      });
    },
  },
  {
    method: "POST",
    path: "/payments/webhooks/:provider",
    handler: async ({ req, res, params }) => {
      const body = await readJsonBody<{
        externalReference: string;
        status: "completed" | "failed";
        transactionId?: string;
      }>(req);

      const payment = get<{ id: string }>(`SELECT id FROM payments WHERE external_reference = ?`, [body.externalReference]);
      if (!payment) {
        throw new HttpError(404, "Payment not found for webhook.");
      }

      completePayment({
        paymentId: payment.id,
        transactionId: body.transactionId || `${params.provider.toUpperCase()}-${Date.now()}`,
        status: body.status,
      });

      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: "GET",
    path: "/payments/:id/receipt",
    handler: ({ res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "payment:read");
      const payment = getPaymentById(params.id);
      if (!payment) {
        throw new HttpError(404, "Payment not found.");
      }
      if (session.user.role === "vendor" && payment.vendorId !== session.user.id) {
        throw new HttpError(403, "You may only view your own receipts.");
      }
      assertMarketAccess(session, payment.marketId);
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
