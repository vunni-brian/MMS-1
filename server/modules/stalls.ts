import { all, createId, get, getManagerForMarket, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, requirePermission, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";

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
  LEFT JOIN bookings ON bookings.stall_id = stalls.id AND bookings.status IN ('approved', 'paid')
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
         bookings.reviewed_at,
         bookings.review_note,
         stalls.name AS stall_name,
         stalls.zone AS stall_zone,
         users.name AS vendor_name,
         reviewers.name AS reviewed_by_name
  FROM bookings
  INNER JOIN stalls ON stalls.id = bookings.stall_id
  INNER JOIN users ON users.id = bookings.vendor_id
  LEFT JOIN users AS reviewers ON reviewers.id = bookings.reviewed_by_user_id
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
  reviewed_at: string | null;
  review_note: string | null;
  stall_name: string;
  stall_zone: string;
  vendor_name: string;
  reviewed_by_name: string | null;
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
  reviewedAt: row.reviewed_at,
  reviewNote: row.review_note,
  reviewedByName: row.reviewed_by_name,
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
    reviewed_at: string | null;
    review_note: string | null;
    stall_name: string;
    stall_zone: string;
    vendor_name: string;
    reviewed_by_name: string | null;
  }>(`${bookingSelect} WHERE bookings.id = ?`, [bookingId]);
  return booking ? mapBooking(booking) : null;
};

const approveBookingApplication = async ({
  bookingId,
  actor,
  reviewNote,
}: {
  bookingId: string;
  actor: { id: string; name: string; role: "manager" | "official"; marketId: string | null };
  reviewNote?: string | null;
}) => {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Booking application not found.");
  }
  if (booking.status !== "pending") {
    throw new HttpError(409, "Only pending booking applications can be approved.");
  }

  const timestamp = nowIso();
  const competingApplicants = await all<{
    vendor_id: string;
    vendor_phone: string;
    vendor_name: string;
  }>(
    `SELECT bookings.vendor_id, users.phone AS vendor_phone, users.name AS vendor_name
     FROM bookings
     INNER JOIN users ON users.id = bookings.vendor_id
     WHERE bookings.stall_id = ? AND bookings.id != ? AND bookings.status = 'pending'`,
    [booking.stallId, bookingId],
  );

  await transaction(async () => {
    const stall = await get<{ status: string }>(`SELECT status FROM stalls WHERE id = ?`, [booking.stallId]);
    if (!stall || stall.status !== "inactive") {
      throw new HttpError(409, "This stall is no longer available for assignment.");
    }

    const activeBooking = await get<{ id: string }>(
      `SELECT id FROM bookings WHERE stall_id = ? AND status IN ('approved', 'paid') AND id != ?`,
      [booking.stallId, bookingId],
    );
    if (activeBooking) {
      throw new HttpError(409, "This stall already has an approved booking.");
    }

    await run(
      `UPDATE bookings
       SET status = 'approved',
           confirmed_at = ?,
           reviewed_by_user_id = ?,
           reviewed_at = ?,
           review_note = ?,
           updated_at = ?
       WHERE id = ?`,
      [timestamp, actor.id, timestamp, reviewNote?.trim() || null, timestamp, bookingId],
    );
    await run(
      `UPDATE stalls
       SET status = 'active',
           assigned_vendor_id = ?,
           updated_at = ?
       WHERE id = ?`,
      [booking.vendorId, timestamp, booking.stallId],
    );
    await run(
      `UPDATE bookings
       SET status = 'rejected',
           reviewed_by_user_id = ?,
           reviewed_at = ?,
           review_note = ?,
           updated_at = ?
       WHERE stall_id = ? AND id != ? AND status = 'pending'`,
      [actor.id, timestamp, "Another booking application was approved for this stall.", timestamp, booking.stallId, bookingId],
    );
  });

  await queueNotification({
    userId: booking.vendorId,
    type: "booking",
    message: `Your application for stall ${booking.stallName} was approved and the stall is now active on your dashboard.`,
    channels: ["system"],
  });

  for (const applicant of competingApplicants) {
    await queueNotification({
      userId: applicant.vendor_id,
      type: "booking",
      message: `Your application for stall ${booking.stallName} was not approved because another vendor was assigned.`,
      channels: ["system", "sms"],
      destinationPhone: applicant.vendor_phone,
    });
  }

  await logAuditEvent({
    actorUserId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    marketId: booking.marketId,
    action: "APPROVE_BOOKING_APPLICATION",
    entityType: "booking",
    entityId: bookingId,
    details: { stallId: booking.stallId, reviewNote: reviewNote?.trim() || null },
  });

  return await getBookingById(bookingId);
};

const rejectBookingApplication = async ({
  bookingId,
  actor,
  reason,
}: {
  bookingId: string;
  actor: { id: string; name: string; role: "manager" | "official"; marketId: string | null };
  reason: string;
}) => {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Booking application not found.");
  }
  if (booking.status !== "pending") {
    throw new HttpError(409, "Only pending booking applications can be rejected.");
  }

  const reviewNote = reason.trim();
  if (!reviewNote) {
    throw new HttpError(400, "A rejection reason is required.");
  }

  const timestamp = nowIso();
  await run(
    `UPDATE bookings
     SET status = 'rejected',
         reviewed_by_user_id = ?,
         reviewed_at = ?,
         review_note = ?,
         updated_at = ?,
         confirmed_at = NULL
     WHERE id = ?`,
    [actor.id, timestamp, reviewNote, timestamp, bookingId],
  );

  await queueNotification({
    userId: booking.vendorId,
    type: "booking",
    message: `Your stall application for ${booking.stallName} was rejected: ${reviewNote}`,
    channels: ["system"],
  });

  await logAuditEvent({
    actorUserId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    marketId: booking.marketId,
    action: "REJECT_BOOKING_APPLICATION",
    entityType: "booking",
    entityId: bookingId,
    details: { stallId: booking.stallId, reason: reviewNote },
  });

  return await getBookingById(bookingId);
};

export const stallRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/stalls",
    handler: async ({ res, auth, url }) => {
      const { session, marketId } = resolveScopedMarket(auth, "stall:read", url.searchParams.get("marketId"));
      const zone = url.searchParams.get("zone");
      const scope = url.searchParams.get("scope");
      const clauses: string[] = [];
      const params: string[] = [];

      if (session.user.role === "vendor") {
        if (scope === "mine") {
          clauses.push("stalls.assigned_vendor_id = ?");
          params.push(session.user.id);
        } else {
          clauses.push("stalls.is_published = 1");
          clauses.push("stalls.status = 'inactive'");
        }
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
         VALUES (?, ?, ?, ?, ?, ?, 'inactive', ?, NULL, ?, ?)`,
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
      const stall = await get<{
        id: string;
        market_id: string | null;
        status: string;
        assigned_vendor_id: string | null;
      }>(`SELECT id, market_id, status, assigned_vendor_id FROM stalls WHERE id = ?`, [params.id]);
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

      if (body.status === "active") {
        throw new HttpError(409, "Occupied stalls must be assigned through booking approval.");
      }
      if (stall.status === "active" && body.status && body.status !== "active") {
        throw new HttpError(409, "Occupied stalls cannot be reassigned manually.");
      }

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
        reviewed_at: string | null;
        review_note: string | null;
        stall_name: string;
        stall_zone: string;
        vendor_name: string;
        reviewed_by_name: string | null;
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
        throw new HttpError(403, "Only vendors can apply for stalls.");
      }
      if (session.user.vendorStatus !== "approved") {
        throw new HttpError(403, "Your vendor profile must be approved before applying for a stall.");
      }
      if (!marketId) {
        throw new HttpError(403, "Your account is not assigned to a market.");
      }

      const body = await readJsonBody<{ startDate?: string; endDate?: string }>(req);
      const startDate = body.startDate || new Date().toISOString().slice(0, 10);
      const endDate =
        body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const timestamp = nowIso();

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
        throw new HttpError(409, "This stall is not open for applications.");
      }
      if (stall.status !== "inactive") {
        throw new HttpError(409, "This stall is no longer available.");
      }

      const duplicateApplication = await get<{ id: string }>(
        `SELECT id FROM bookings WHERE stall_id = ? AND vendor_id = ? AND status IN ('pending', 'approved', 'paid')`,
        [params.id, session.user.id],
      );
      if (duplicateApplication) {
        throw new HttpError(409, "You already have an active application for this stall.");
      }

      const bookingId = createId("booking");
      await run(
        `INSERT INTO bookings (id, market_id, stall_id, vendor_id, status, start_date, end_date, amount, reserved_until, created_at, updated_at, confirmed_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NULL, ?, ?, NULL)`,
        [
          bookingId,
          stall.market_id,
          params.id,
          session.user.id,
          startDate,
          endDate,
          stall.price_per_month * monthsBetween(startDate, endDate),
          timestamp,
          timestamp,
        ],
      );

      await queueNotification({
        userId: session.user.id,
        type: "booking",
        message: `Your application for stall ${stall.name} was submitted for manager review.`,
        channels: ["system"],
      });

      const marketManager = await getManagerForMarket(marketId);
      if (marketManager) {
        await queueNotification({
          userId: marketManager.id,
          type: "booking",
          message: `${session.user.name} applied for stall ${stall.name}. Review the booking application.`,
          channels: ["system", "sms"],
          destinationPhone: marketManager.phone,
        });
      }

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId,
        action: "CREATE_BOOKING_APPLICATION",
        entityType: "booking",
        entityId: bookingId,
        details: { stallId: params.id },
      });

      sendJson(res, 201, { booking: await getBookingById(bookingId) });
    },
  },
  {
    method: "POST",
    path: "/bookings/:id/approve",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "booking:update");
      const booking = await getBookingById(params.id);
      if (!booking) {
        throw new HttpError(404, "Booking application not found.");
      }
      assertMarketAccess(session, booking.marketId);

      const body = await readJsonBody<{ reviewNote?: string }>(req);
      const approved = await approveBookingApplication({
        bookingId: params.id,
        actor: {
          id: session.user.id,
          name: session.user.name,
          role: session.user.role as "manager" | "official",
          marketId: session.user.marketId,
        },
        reviewNote: body.reviewNote,
      });

      sendJson(res, 200, { booking: approved });
    },
  },
  {
    method: "POST",
    path: "/bookings/:id/reject",
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "booking:update");
      const booking = await getBookingById(params.id);
      if (!booking) {
        throw new HttpError(404, "Booking application not found.");
      }
      assertMarketAccess(session, booking.marketId);

      const body = await readJsonBody<{ reason?: string }>(req);
      const rejected = await rejectBookingApplication({
        bookingId: params.id,
        actor: {
          id: session.user.id,
          name: session.user.name,
          role: session.user.role as "manager" | "official",
          marketId: session.user.marketId,
        },
        reason: body.reason || "",
      });

      sendJson(res, 200, { booking: rejected });
    },
  },
  {
    method: "POST",
    path: "/bookings/:id/mark-paid",
    handler: async ({ req, res, auth, params }) => {
      const session = requirePermission(auth, "billing:manage");
      const booking = await getBookingById(params.id);
      if (!booking) {
        throw new HttpError(404, "Booking not found.");
      }
      assertMarketAccess(session, booking.marketId);
      if (!["approved", "paid"].includes(booking.status)) {
        throw new HttpError(409, "This booking must be approved before payment can be recorded.");
      }

      const body = await readJsonBody<{ transactionId?: string }>(req);
      const timestamp = nowIso();
      await run(`UPDATE bookings SET status = 'paid', updated_at = ? WHERE id = ?`, [timestamp, params.id]);

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
    handler: async ({ req, res, auth, params }) => {
      const { session } = resolveScopedMarket(auth, "booking:update");
      const booking = await getBookingById(params.id);
      if (!booking) {
        throw new HttpError(404, "Booking application not found.");
      }
      assertMarketAccess(session, booking.marketId);

      const body = await readJsonBody<{ reviewNote?: string }>(req);
      const approved = await approveBookingApplication({
        bookingId: params.id,
        actor: {
          id: session.user.id,
          name: session.user.name,
          role: session.user.role as "manager" | "official",
          marketId: session.user.marketId,
        },
        reviewNote: body.reviewNote,
      });

      sendJson(res, 200, { booking: approved });
    },
  },
];
