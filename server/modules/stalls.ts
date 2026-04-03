import { all, createId, get, getManagerForMarket, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, resolveScopedMarket } from "../lib/session.ts";
import { addMinutes, nowIso } from "../lib/security.ts";

const monthsBetween = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Number.isFinite(diffMonths) && diffMonths > 0 ? diffMonths : 1;
};

const mapStall = (row: {
  id: string;
  market_id: string | null;
  market_name: string | null;
  name: string;
  zone: string;
  size: string;
  price_per_month: number;
  status: string;
  is_published: number;
  assigned_vendor_id: string | null;
  vendor_name: string | null;
  active_booking_id: string | null;
  active_booking_status: string | null;
  active_booking_amount: number | null;
}) => ({
  id: row.id,
  marketId: row.market_id,
  marketName: row.market_name,
  name: row.name,
  zone: row.zone,
  size: row.size,
  pricePerMonth: row.price_per_month,
  status: row.status,
  isPublished: Boolean(row.is_published),
  vendorId: row.assigned_vendor_id,
  vendorName: row.vendor_name,
  activeBooking: row.active_booking_id
    ? {
        id: row.active_booking_id,
        status: row.active_booking_status,
        amount: row.active_booking_amount,
      }
    : null,
});

const stallsSelect = `
  SELECT stalls.id,
         stalls.market_id,
         markets.name AS market_name,
         stalls.name,
         stalls.zone,
         stalls.size,
         stalls.price_per_month,
         stalls.status,
         stalls.is_published,
         stalls.assigned_vendor_id,
         users.name AS vendor_name,
         bookings.id AS active_booking_id,
         bookings.status AS active_booking_status,
         bookings.amount AS active_booking_amount
  FROM stalls
  LEFT JOIN markets ON markets.id = stalls.market_id
  LEFT JOIN users ON users.id = stalls.assigned_vendor_id
  LEFT JOIN bookings ON bookings.stall_id = stalls.id AND bookings.status IN ('reserved', 'paid', 'confirmed')
`;

const bookingSelect = `
  SELECT bookings.id,
         bookings.market_id,
         markets.name AS market_name,
         bookings.stall_id,
         bookings.vendor_id,
         bookings.status,
         bookings.start_date,
         bookings.end_date,
         bookings.amount,
         bookings.reserved_until,
         bookings.created_at,
         bookings.updated_at,
         bookings.confirmed_at,
         stalls.name AS stall_name,
         stalls.zone AS stall_zone,
         users.name AS vendor_name
  FROM bookings
  INNER JOIN stalls ON stalls.id = bookings.stall_id
  INNER JOIN users ON users.id = bookings.vendor_id
  LEFT JOIN markets ON markets.id = bookings.market_id
`;

const mapBooking = (row: {
  id: string;
  market_id: string | null;
  market_name: string | null;
  stall_id: string;
  vendor_id: string;
  status: string;
  start_date: string;
  end_date: string;
  amount: number;
  reserved_until: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  stall_name: string;
  stall_zone: string;
  vendor_name: string;
}) => ({
  id: row.id,
  marketId: row.market_id,
  marketName: row.market_name,
  stallId: row.stall_id,
  stallName: row.stall_name,
  stallZone: row.stall_zone,
  vendorId: row.vendor_id,
  vendorName: row.vendor_name,
  status: row.status,
  startDate: row.start_date,
  endDate: row.end_date,
  amount: row.amount,
  reservedUntil: row.reserved_until,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  confirmedAt: row.confirmed_at,
});

const getBookingById = async (bookingId: string) => {
  const booking = await get<{
    id: string;
    market_id: string | null;
    market_name: string | null;
    stall_id: string;
    vendor_id: string;
    status: string;
    start_date: string;
    end_date: string;
    amount: number;
    reserved_until: string | null;
    created_at: string;
    updated_at: string;
    confirmed_at: string | null;
    stall_name: string;
    stall_zone: string;
    vendor_name: string;
  }>(`${bookingSelect} WHERE bookings.id = ?`, [bookingId]);
  return booking ? mapBooking(booking) : null;
};

export const stallRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/stalls",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "stall:read", url.searchParams.get("marketId"));
      const zone = url.searchParams.get("zone");
      const clauses: string[] = [];
      const params: string[] = [];

      if (session.user.role === "vendor") {
        clauses.push("stalls.is_published = 1");
        clauses.push("stalls.status = 'available'");
      }
      if (marketId) {
        clauses.push("stalls.market_id = ?");
        params.push(marketId);
      }
      if (zone) {
        clauses.push("stalls.zone = ?");
        params.push(zone);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const stalls = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        name: string;
        zone: string;
        size: string;
        price_per_month: number;
        status: string;
        is_published: number;
        assigned_vendor_id: string | null;
        vendor_name: string | null;
        active_booking_id: string | null;
        active_booking_status: string | null;
        active_booking_amount: number | null;
      }>(`${stallsSelect} ${whereClause} ORDER BY stalls.zone, stalls.name`, params);

      sendJson(res, 200, { stalls: stalls.map(mapStall) });
    },
  },
  {
    method: "POST",
    path: "/stalls",
    handler: async ({ req, res, auth }) => {
      const { session, marketId } = resolveScopedMarket(auth, "stall:write");
      if (!marketId) {
        throw new HttpError(403, "Manager account is not assigned to a market.");
      }

      const body = await readJsonBody<{
        name: string;
        zone: string;
        size: string;
        pricePerMonth: number;
        isPublished?: boolean;
      }>(req);

      if (!body.name || !body.zone || !body.size || !body.pricePerMonth) {
        throw new HttpError(400, "Name, zone, size, and price are required.");
      }

      const stallId = createId("stall");
      const timestamp = nowIso();
      await run(
        `INSERT INTO stalls (id, market_id, name, zone, size, price_per_month, status, is_published, assigned_vendor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'available', ?, NULL, ?, ?)`,
        [stallId, marketId, body.name.trim(), body.zone.trim(), body.size.trim(), body.pricePerMonth, body.isPublished === false ? 0 : 1, timestamp, timestamp],
      );

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_STALL",
        entityType: "stall",
        entityId: stallId,
        details: { name: body.name, zone: body.zone },
      });

      const stall = await get<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        name: string;
        zone: string;
        size: string;
        price_per_month: number;
        status: string;
        is_published: number;
        assigned_vendor_id: string | null;
        vendor_name: string | null;
        active_booking_id: string | null;
        active_booking_status: string | null;
        active_booking_amount: number | null;
      }>(`${stallsSelect} WHERE stalls.id = ?`, [stallId]);

      sendJson(res, 201, { stall: stall ? mapStall(stall) : null });
    },
  },
  {
    method: "PATCH",
    path: "/stalls/:id",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "stall:write");
      const stall = await get<{ id: string; market_id: string | null }>(`SELECT id, market_id FROM stalls WHERE id = ?`, [params.id]);
      if (!stall) {
        throw new HttpError(404, "Stall not found.");
      }
      assertMarketAccess(session, stall.market_id);

      const body = await readJsonBody<{
        name?: string;
        zone?: string;
        size?: string;
        status?: string;
        pricePerMonth?: number;
        isPublished?: boolean;
      }>(req);
      const timestamp = nowIso();
      await run(
        `UPDATE stalls
         SET name = COALESCE(?, name),
             zone = COALESCE(?, zone),
             size = COALESCE(?, size),
             status = COALESCE(?, status),
             price_per_month = COALESCE(?, price_per_month),
             is_published = COALESCE(?, is_published),
             updated_at = ?
         WHERE id = ?`,
        [
          body.name?.trim() || null,
          body.zone?.trim() || null,
          body.size?.trim() || null,
          body.status || null,
          body.pricePerMonth ?? null,
          typeof body.isPublished === "boolean" ? Number(body.isPublished) : null,
          timestamp,
          params.id,
        ],
      );

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: stall.market_id,
        action: "UPDATE_STALL",
        entityType: "stall",
        entityId: params.id,
        details: body,
      });

      const updated = await get<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        name: string;
        zone: string;
        size: string;
        price_per_month: number;
        status: string;
        is_published: number;
        assigned_vendor_id: string | null;
        vendor_name: string | null;
        active_booking_id: string | null;
        active_booking_status: string | null;
        active_booking_amount: number | null;
      }>(`${stallsSelect} WHERE stalls.id = ?`, [params.id]);
      sendJson(res, 200, { stall: updated ? mapStall(updated) : null });
    },
  },
  {
    method: "GET",
    path: "/bookings",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "booking:read", url.searchParams.get("marketId"));
      const clauses: string[] = [];
      const params: string[] = [];

      if (marketId) {
        clauses.push("bookings.market_id = ?");
        params.push(marketId);
      }
      if (session.user.role === "vendor") {
        clauses.push("bookings.vendor_id = ?");
        params.push(session.user.id);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const bookings = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        stall_id: string;
        vendor_id: string;
        status: string;
        start_date: string;
        end_date: string;
        amount: number;
        reserved_until: string | null;
        created_at: string;
        updated_at: string;
        confirmed_at: string | null;
        stall_name: string;
        stall_zone: string;
        vendor_name: string;
      }>(`${bookingSelect} ${whereClause} ORDER BY bookings.created_at DESC`, params);
      sendJson(res, 200, { bookings: bookings.map(mapBooking) });
    },
  },
  {
    method: "POST",
    path: "/stalls/:id/reservations",
    handler: async ({ req, res, auth, params }) => {
      const { session, marketId } = resolveScopedMarket(auth, "booking:create");
      if (session.user.role !== "vendor") {
        throw new HttpError(403, "Only vendors can reserve stalls.");
      }
      if (session.user.vendorStatus !== "approved") {
        throw new HttpError(403, "Your vendor profile must be approved before reserving a stall.");
      }
      if (!marketId) {
        throw new HttpError(403, "Your account is not assigned to a market.");
      }

      const body = await readJsonBody<{ startDate?: string; endDate?: string }>(req);
      const startDate = body.startDate || new Date().toISOString().slice(0, 10);
      const endDate =
        body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const timestamp = nowIso();

      const bookingId = await transaction(async () => {
        const stall = await get<{
          id: string;
          market_id: string;
          name: string;
          zone: string;
          price_per_month: number;
          status: string;
          is_published: number;
        }>(
          `SELECT id, market_id, name, zone, price_per_month, status, is_published
           FROM stalls
           WHERE id = ? AND market_id = ?`,
          [params.id, marketId],
        );
        if (!stall) {
          throw new HttpError(404, "Stall not found.");
        }
        if (!stall.is_published) {
          throw new HttpError(409, "This stall is not available for reservation.");
        }
        if (stall.status !== "available") {
          throw new HttpError(409, "This stall is no longer available.");
        }

        const activeBooking = await get<{ id: string }>(
          `SELECT id FROM bookings WHERE stall_id = ? AND status IN ('reserved', 'paid', 'confirmed')`,
          [params.id],
        );
        if (activeBooking) {
          throw new HttpError(409, "This stall already has an active booking.");
        }

        const id = createId("booking");
        await run(
          `INSERT INTO bookings (id, market_id, stall_id, vendor_id, status, start_date, end_date, amount, reserved_until, created_at, updated_at, confirmed_at)
           VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?, ?, NULL)`,
          [
            id,
            stall.market_id,
            params.id,
            session.user.id,
            startDate,
            endDate,
            stall.price_per_month * monthsBetween(startDate, endDate),
            addMinutes(30),
            timestamp,
            timestamp,
          ],
        );
        await run(
          `UPDATE stalls SET status = 'reserved', assigned_vendor_id = ?, updated_at = ? WHERE id = ?`,
          [session.user.id, timestamp, params.id],
        );
        return id;
      });

      await queueNotification({
        userId: session.user.id,
        type: "booking",
        message: "Your stall reservation was created and is awaiting payment confirmation.",
        channels: ["system"],
      });

      const marketManager = await getManagerForMarket(marketId);
      if (marketManager) {
        await queueNotification({
          userId: marketManager.id,
          type: "booking",
          message: `${session.user.name} reserved stall ${params.id}.`,
          channels: ["system", "sms"],
          destinationPhone: marketManager.phone,
        });
      }

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_BOOKING",
        entityType: "booking",
        entityId: bookingId,
        details: { stallId: params.id },
      });

      sendJson(res, 201, { booking: await getBookingById(bookingId) });
    },
  },
  {
    method: "POST",
    path: "/bookings/:id/mark-paid",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "booking:update");
      const booking = await getBookingById(params.id);
      if (!booking) {
        throw new HttpError(404, "Booking not found.");
      }
      assertMarketAccess(session, booking.marketId);

      const body = await readJsonBody<{ transactionId?: string }>(req);
      const timestamp = nowIso();

      await transaction(async () => {
        await run(`UPDATE bookings SET status = 'paid', updated_at = ? WHERE id = ?`, [timestamp, params.id]);
        await run(`UPDATE stalls SET status = 'paid', updated_at = ? WHERE id = ?`, [timestamp, booking.stallId]);
      });

      await queueNotification({
        userId: booking.vendorId,
        type: "payment",
        message: `Your booking ${booking.id} has been marked as paid${body.transactionId ? ` (${body.transactionId})` : ""}.`,
        channels: ["system"],
      });
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: booking.marketId,
        action: "MARK_BOOKING_PAID",
        entityType: "booking",
        entityId: params.id,
        details: body,
      });

      sendJson(res, 200, { booking: await getBookingById(params.id) });
    },
  },
  {
    method: "POST",
    path: "/bookings/:id/confirm",
    handler: async ({ res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "booking:update");
      const booking = await getBookingById(params.id);
      if (!booking) {
        throw new HttpError(404, "Booking not found.");
      }
      assertMarketAccess(session, booking.marketId);
      if (booking.status !== "paid") {
        throw new HttpError(409, "Booking must be paid before it can be confirmed.");
      }

      const timestamp = nowIso();
      await transaction(async () => {
        await run(`UPDATE bookings SET status = 'confirmed', updated_at = ?, confirmed_at = ? WHERE id = ?`, [timestamp, timestamp, params.id]);
        await run(`UPDATE stalls SET status = 'confirmed', updated_at = ? WHERE id = ?`, [timestamp, booking.stallId]);
      });

      await queueNotification({
        userId: booking.vendorId,
        type: "booking",
        message: `Your booking for stall ${booking.stallName} has been confirmed.`,
        channels: ["system", "sms"],
        destinationPhone: (await get<{ phone: string }>(`SELECT phone FROM users WHERE id = ?`, [booking.vendorId]))?.phone,
      });
      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: booking.marketId,
        action: "CONFIRM_BOOKING",
        entityType: "booking",
        entityId: params.id,
        details: { stallId: booking.stallId },
      });

      sendJson(res, 200, { booking: await getBookingById(params.id) });
    },
  },
];
