import { all, createId, get, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { nowIso } from "../lib/security.ts";

const buildAvailabilityResponse = async () => {
  const stalls = await all<{ name: string; zone: string }>(
    `SELECT name, zone FROM stalls WHERE status = 'inactive' AND is_published = 1 ORDER BY zone, name LIMIT 3`,
  );
  if (stalls.length === 0) {
    return "No stalls are currently available.";
  }
  return `Available stalls: ${stalls.map((stall) => `${stall.name} (${stall.zone})`).join(", ")}`;
};

const buildPaymentStatusResponse = async (phone: string) => {
  const payment = await get<{
    status: string;
    transaction_id: string | null;
    created_at: string;
  }>(
    `SELECT payments.status, payments.transaction_id, payments.created_at
     FROM payments
     INNER JOIN users ON users.id = payments.vendor_id
     WHERE users.phone = ?
     ORDER BY payments.created_at DESC
     LIMIT 1`,
    [phone],
  );
  if (!payment) {
    return "No payment history found for this phone number.";
  }
  return `Last payment: ${payment.status} (${payment.transaction_id || "pending reference"}) on ${new Date(payment.created_at).toLocaleDateString()}.`;
};

const logQuery = async (userId: string | null, channel: "ussd" | "sms", phone: string, requestText: string, responseText: string) => {
  await run(
    `INSERT INTO fallback_queries (id, user_id, channel, phone, request_text, response_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [createId("fallback"), userId, channel, phone, requestText, responseText, nowIso()],
  );
};

const resolveUserIdByPhone = async (phone: string) => {
  return (await get<{ id: string }>(`SELECT id FROM users WHERE phone = ?`, [phone]))?.id || null;
};

const resolveFallbackResponse = async (input: string, phone: string) => {
  const normalized = input.trim().toUpperCase();
  if (normalized.includes("AVAIL") || normalized.includes("100")) {
    return await buildAvailabilityResponse();
  }
  if (normalized.includes("STATUS") || normalized.includes("PAY") || normalized.includes("200")) {
    return await buildPaymentStatusResponse(phone);
  }
  return "Unsupported query. Use AVAIL for stall availability or STATUS for last payment.";
};

export const fallbackRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/fallback/ussd",
    handler: async ({ req, res, config }) => {
      if (!config.fallbackRoutesEnabled) {
        throw new HttpError(404, "Route not found.");
      }

      const body = await readJsonBody<{ phone: string; input: string }>(req);
      if (!body.phone || !body.input) {
        throw new HttpError(400, "Phone and input are required.");
      }

      const responseText = await resolveFallbackResponse(body.input, body.phone);
      await logQuery(await resolveUserIdByPhone(body.phone), "ussd", body.phone, body.input, responseText);
      sendJson(res, 200, { response: responseText });
    },
  },
  {
    method: "POST",
    path: "/fallback/sms",
    handler: async ({ req, res, config }) => {
      if (!config.fallbackRoutesEnabled) {
        throw new HttpError(404, "Route not found.");
      }

      const body = await readJsonBody<{ phone: string; message: string }>(req);
      if (!body.phone || !body.message) {
        throw new HttpError(400, "Phone and message are required.");
      }

      const responseText = await resolveFallbackResponse(body.message, body.phone);
      await logQuery(await resolveUserIdByPhone(body.phone), "sms", body.phone, body.message, responseText);
      sendJson(res, 200, { response: responseText });
    },
  },
];
