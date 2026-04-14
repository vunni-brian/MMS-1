import { assertChargeEnabled } from "../lib/billing.ts";
import { all, createId, get, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, readRawBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { getPesapalPaymentOutcome, getPesapalTransactionStatus, submitPesapalOrder } from "../lib/pesapal.ts";
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
  gatewayResponse,
  message,
}: {
  paymentId: string;
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
  });
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

      const body = await readJsonBody<{ bookingId?: string }>(req);
      if (!body.bookingId) {
        throw new HttpError(400, "Booking is required.");
      }

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

      const paymentId = createId("payment");
      const externalReference = paymentId;
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
        const { firstName, lastName } = splitName(session.user.name);
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
            bookingId: body.bookingId,
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
