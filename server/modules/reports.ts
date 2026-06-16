import { all } from "../lib/db.ts";
import { sendJson, type RouteDefinition } from "../lib/http.ts";
import { resolveScopedMarket } from "../lib/session.ts";

const normalizeDateRange = (from: string | null, to: string | null) => {
  return {
    from: from || "2000-01-01",
    to: to || "2999-12-31",
  };
};

const appendMarketScope = (clauses: string[], params: Array<string | null>, column: string, marketId: string | null) => {
  if (marketId) {
    clauses.push(`${column} = ?`);
    params.push(marketId);
  }
};

const hoursBetween = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(diff) && diff >= 0 ? diff / (1000 * 60 * 60) : null;
};

export const reportRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/reports/revenue",
    handler: async ({ res, auth, url }) => {
      const range = normalizeDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
      const { marketId } = resolveScopedMarket(auth, "report:read", url.searchParams.get("marketId"));
      const clauses = ["payments.created_at::date BETWEEN ?::date AND ?::date"];
      const params: Array<string | null> = [range.from, range.to];
      appendMarketScope(clauses, params, "payments.market_id", marketId);
      const rows = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        created_at: string;
        vendor_name: string;
        amount: number;
        provider: string;
        transaction_id: string | null;
        status: string;
      }>(
        `SELECT payments.id,
                payments.market_id,
                markets.name AS market_name,
                payments.created_at,
                users.name AS vendor_name,
                CASE
                  WHEN COALESCE(payment_market_charge.is_enabled, payment_global_charge.is_enabled, 1) = 1
                  THEN payments.amount
                  ELSE 0
                END AS amount,
                payments.provider,
                payments.transaction_id,
                payments.status
         FROM payments
         INNER JOIN users ON users.id = payments.vendor_id
         LEFT JOIN markets ON markets.id = payments.market_id
         LEFT JOIN charge_types AS payment_market_charge
           ON payment_market_charge.name = payments.charge_type
          AND payment_market_charge.scope = 'market'
          AND payment_market_charge.market_id = payments.market_id
         LEFT JOIN charge_types AS payment_global_charge
           ON payment_global_charge.name = payments.charge_type
          AND payment_global_charge.scope = 'global'
         WHERE ${clauses.join(" AND ")}
         ORDER BY payments.created_at DESC`,
        params,
      );

      const completed = rows.filter((row) => row.status === "completed");
      const totalRevenue = completed.reduce((total, row) => total + row.amount, 0);
      sendJson(res, 200, {
        summary: {
          from: range.from,
          to: range.to,
          totalRevenue,
          transactionCount: rows.length,
        },
        rows: rows.map((row) => ({
          id: row.id,
          marketId: row.market_id,
          marketName: row.market_name,
          createdAt: row.created_at,
          vendorName: row.vendor_name,
          amount: row.amount,
          method: row.provider,
          transactionId: row.transaction_id,
          status: row.status,
        })),
      });
    },
  },
  {
    method: "GET",
    path: "/reports/dues",
    handler: async ({ res, auth, url }) => {
      const range = normalizeDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
      const { marketId } = resolveScopedMarket(auth, "report:read", url.searchParams.get("marketId"));
      const clauses = [
        "bookings.created_at::date BETWEEN ?::date AND ?::date",
        "bookings.status IN ('approved', 'paid')",
      ];
      const params: Array<string | null> = [range.from, range.to];
      appendMarketScope(clauses, params, "bookings.market_id", marketId);
      const rows = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        vendor_name: string;
        stall_name: string;
        amount: number;
        paid_amount: number;
        status: string;
        created_at: string;
      }>(
        `SELECT bookings.id,
                bookings.market_id,
                markets.name AS market_name,
                users.name AS vendor_name,
                stalls.name AS stall_name,
                CASE
                  WHEN COALESCE(booking_market_charge.is_enabled, booking_global_charge.is_enabled, 1) = 1
                  THEN bookings.amount
                  ELSE 0
                END AS amount,
                COALESCE(SUM(
                  CASE
                    WHEN payments.status = 'completed'
                     AND COALESCE(payment_market_charge.is_enabled, payment_global_charge.is_enabled, 1) = 1
                    THEN payments.amount
                    ELSE 0
                  END
                ), 0)::INT AS paid_amount,
                bookings.status,
                bookings.created_at
         FROM bookings
         INNER JOIN users ON users.id = bookings.vendor_id
         INNER JOIN stalls ON stalls.id = bookings.stall_id
         LEFT JOIN payments ON payments.booking_id = bookings.id
         LEFT JOIN markets ON markets.id = bookings.market_id
         LEFT JOIN charge_types AS booking_market_charge
           ON booking_market_charge.name = 'booking_fee'
          AND booking_market_charge.scope = 'market'
          AND booking_market_charge.market_id = bookings.market_id
         LEFT JOIN charge_types AS booking_global_charge
           ON booking_global_charge.name = 'booking_fee'
          AND booking_global_charge.scope = 'global'
         LEFT JOIN charge_types AS payment_market_charge
           ON payment_market_charge.name = payments.charge_type
          AND payment_market_charge.scope = 'market'
          AND payment_market_charge.market_id = payments.market_id
         LEFT JOIN charge_types AS payment_global_charge
           ON payment_global_charge.name = payments.charge_type
          AND payment_global_charge.scope = 'global'
         WHERE ${clauses.join(" AND ")}
         GROUP BY bookings.id,
                  bookings.market_id,
                  markets.name,
                  users.name,
                  stalls.name,
                  bookings.amount,
                  booking_market_charge.is_enabled,
                  booking_global_charge.is_enabled,
                  bookings.status,
                  bookings.created_at
         HAVING CASE
                  WHEN COALESCE(booking_market_charge.is_enabled, booking_global_charge.is_enabled, 1) = 1
                  THEN bookings.amount
                  ELSE 0
                END - COALESCE(SUM(
                  CASE
                    WHEN payments.status = 'completed'
                     AND COALESCE(payment_market_charge.is_enabled, payment_global_charge.is_enabled, 1) = 1
                    THEN payments.amount
                    ELSE 0
                  END
                ), 0) > 0
         ORDER BY bookings.created_at DESC`,
        params,
      );

      sendJson(res, 200, {
        summary: {
          from: range.from,
          to: range.to,
          outstandingTotal: rows.reduce((total, row) => total + (row.amount - row.paid_amount), 0),
          bookingCount: rows.length,
        },
        rows: rows.map((row) => ({
          id: row.id,
          marketId: row.market_id,
          marketName: row.market_name,
          vendorName: row.vendor_name,
          stallName: row.stall_name,
          amount: row.amount,
          paidAmount: row.paid_amount,
          outstandingAmount: row.amount - row.paid_amount,
          status: row.status,
          createdAt: row.created_at,
        })),
      });
    },
  },
  {
    method: "GET",
    path: "/audit",
    handler: async ({ res, auth, url }) => {
      const { marketId } = resolveScopedMarket(auth, "audit:read", url.searchParams.get("marketId"));
      const clauses = ["1 = 1"];
      const params: Array<string | null> = [];
      appendMarketScope(clauses, params, "audit_events.market_id", marketId);
      const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") || 50)), 100);
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

      const rows = await all<{
        id: string;
        actor_user_id: string | null;
        actor_name: string;
        actor_role: string;
        market_id: string | null;
        market_name: string | null;
        action: string;
        entity_type: string;
        entity_id: string;
        details_json: string | null;
        created_at: string;
      }>(
        `SELECT audit_events.id,
                audit_events.actor_user_id,
                audit_events.actor_name,
                audit_events.actor_role,
                audit_events.market_id,
                markets.name AS market_name,
                audit_events.action,
                audit_events.entity_type,
                audit_events.entity_id,
                audit_events.details_json,
                audit_events.created_at
         FROM audit_events
         LEFT JOIN markets ON markets.id = audit_events.market_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY audit_events.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      sendJson(res, 200, {
        events: rows.map((row) => ({
          id: row.id,
          actorUserId: row.actor_user_id,
          actorName: row.actor_name,
          actorRole: row.actor_role,
          marketId: row.market_id,
          marketName: row.market_name,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          details: row.details_json ? JSON.parse(row.details_json) : null,
          createdAt: row.created_at,
        })),
      });
    },
  },
  {
    method: "GET",
    path: "/reports/tickets",
    handler: async ({ res, auth, url }) => {
      const range = normalizeDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
      const { marketId } = resolveScopedMarket(auth, "report:read", url.searchParams.get("marketId"));
      const clauses = ["tickets.created_at::date BETWEEN ?::date AND ?::date"];
      const params: Array<string | null> = [range.from, range.to];
      appendMarketScope(clauses, params, "tickets.market_id", marketId);

      const rows = await all<{
        id: string;
        ticket_number: string;
        market_id: string | null;
        market_name: string | null;
        vendor_name: string;
        assigned_to_name: string | null;
        category: string;
        priority: string;
        status: string;
        subject: string;
        created_at: string;
        sla_due_at: string | null;
        first_response_at: string | null;
        resolved_at: string | null;
        closed_at: string | null;
        escalated_at: string | null;
        breached_sla: boolean;
        comment_count: number;
      }>(
        `SELECT tickets.id,
                tickets.ticket_number,
                tickets.market_id,
                markets.name AS market_name,
                vendors.name AS vendor_name,
                assignees.name AS assigned_to_name,
                tickets.category,
                tickets.priority,
                tickets.status,
                tickets.subject,
                tickets.created_at,
                tickets.sla_due_at,
                tickets.first_response_at,
                tickets.resolved_at,
                tickets.closed_at,
                tickets.escalated_at,
                tickets.breached_sla,
                COUNT(ticket_updates.id)::INT AS comment_count
         FROM tickets
         INNER JOIN users AS vendors ON vendors.id = tickets.vendor_id
         LEFT JOIN users AS assignees ON assignees.id = tickets.assigned_to
         LEFT JOIN markets ON markets.id = tickets.market_id
         LEFT JOIN ticket_updates ON ticket_updates.ticket_id = tickets.id
         WHERE ${clauses.join(" AND ")}
         GROUP BY tickets.id,
                  tickets.ticket_number,
                  tickets.market_id,
                  markets.name,
                  vendors.name,
                  assignees.name,
                  tickets.category,
                  tickets.priority,
                  tickets.status,
                  tickets.subject,
                  tickets.created_at,
                  tickets.sla_due_at,
                  tickets.first_response_at,
                  tickets.resolved_at,
                  tickets.closed_at,
                  tickets.escalated_at,
                  tickets.breached_sla
         ORDER BY tickets.created_at DESC`,
        params,
      );

      const byCategory = new Map<string, number>();
      const byPriority = new Map<string, number>();
      const byStatus = new Map<string, number>();
      const responseHours: number[] = [];
      const resolutionHours: number[] = [];

      for (const row of rows) {
        byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
        byPriority.set(row.priority, (byPriority.get(row.priority) || 0) + 1);
        byStatus.set(row.status, (byStatus.get(row.status) || 0) + 1);

        const response = hoursBetween(row.created_at, row.first_response_at);
        const resolution = hoursBetween(row.created_at, row.resolved_at || row.closed_at);
        if (response !== null) responseHours.push(response);
        if (resolution !== null) resolutionHours.push(resolution);
      }

      const average = (values: number[]) =>
        values.length ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2)) : null;
      const toBreakdown = (map: Map<string, number>) =>
        Array.from(map.entries())
          .map(([key, count]) => ({
            key,
            count,
            percentage: rows.length ? Number(((count / rows.length) * 100).toFixed(1)) : 0,
          }))
          .sort((left, right) => right.count - left.count);

      const generatedAt = new Date();
      const reportId = `RPT-${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, "0")}-${String(
        generatedAt.getTime() % 1000,
      ).padStart(3, "0")}`;

      sendJson(res, 200, {
        reportId,
        generatedAt: generatedAt.toISOString(),
        dateRange: range,
        summary: {
          totalTickets: rows.length,
          openTickets: byStatus.get("open") || 0,
          inProgressTickets: byStatus.get("in_progress") || 0,
          resolvedTickets: byStatus.get("resolved") || 0,
          closedTickets: byStatus.get("closed") || 0,
          escalatedTickets: rows.filter((row) => row.escalated_at).length,
          slaBreaches: rows.filter(
            (row) =>
              row.breached_sla ||
              (row.sla_due_at &&
                !["resolved", "closed"].includes(row.status) &&
                new Date(row.sla_due_at).getTime() < Date.now()),
          ).length,
          averageFirstResponseHours: average(responseHours),
          averageResolutionHours: average(resolutionHours),
        },
        byCategory: toBreakdown(byCategory),
        byPriority: toBreakdown(byPriority),
        byStatus: toBreakdown(byStatus),
        rows: rows.map((row) => ({
          id: row.id,
          ticketNumber: row.ticket_number,
          marketId: row.market_id,
          marketName: row.market_name,
          vendorName: row.vendor_name,
          assignedToName: row.assigned_to_name,
          category: row.category,
          priority: row.priority,
          status: row.status,
          subject: row.subject,
          commentCount: row.comment_count,
          breachedSla: row.breached_sla,
          slaDueAt: row.sla_due_at,
          escalatedAt: row.escalated_at,
          createdAt: row.created_at,
          firstResponseAt: row.first_response_at,
          resolvedAt: row.resolved_at,
          closedAt: row.closed_at,
        })),
      });
    },
  },
  {
    method: "GET",
    path: "/reports/financial-audit",
    handler: async ({ res, auth, url }) => {
      const range = normalizeDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
      const { marketId } = resolveScopedMarket(auth, "report:read", url.searchParams.get("marketId"));
      const collectionClauses = [
        "payments.status = 'completed'",
        "payments.created_at::date BETWEEN ?::date AND ?::date",
      ];
      const collectionParams: Array<string | null> = [range.from, range.to];
      appendMarketScope(collectionClauses, collectionParams, "payments.market_id", marketId);
      const collection = await all<{ amount: number }>(
        `SELECT CASE
                  WHEN COALESCE(payment_market_charge.is_enabled, payment_global_charge.is_enabled, 1) = 1
                  THEN payments.amount
                  ELSE 0
                END AS amount
         FROM payments
         LEFT JOIN charge_types AS payment_market_charge
           ON payment_market_charge.name = payments.charge_type
          AND payment_market_charge.scope = 'market'
          AND payment_market_charge.market_id = payments.market_id
         LEFT JOIN charge_types AS payment_global_charge
           ON payment_global_charge.name = payments.charge_type
          AND payment_global_charge.scope = 'global'
         WHERE ${collectionClauses.join(" AND ")}`,
        collectionParams,
      );
      const depositClauses = ["bank_deposits.deposited_at::date BETWEEN ?::date AND ?::date"];
      const depositParams: Array<string | null> = [range.from, range.to];
      appendMarketScope(depositClauses, depositParams, "bank_deposits.market_id", marketId);
      const depositLimit = Math.min(Math.max(1, Number(url.searchParams.get("limit") || 50)), 100);
      const depositOffset = Math.max(0, Number(url.searchParams.get("offset") || 0));
      const deposits = await all<{
        id: string;
        market_id: string | null;
        market_name: string | null;
        reference: string;
        amount: number;
        deposited_at: string;
      }>(
        `SELECT bank_deposits.id,
                bank_deposits.market_id,
                markets.name AS market_name,
                bank_deposits.reference,
                bank_deposits.amount,
                bank_deposits.deposited_at
         FROM bank_deposits
         LEFT JOIN markets ON markets.id = bank_deposits.market_id
         WHERE ${depositClauses.join(" AND ")}
         ORDER BY bank_deposits.deposited_at DESC
         LIMIT ? OFFSET ?`,
        [...depositParams, depositLimit, depositOffset],
      );

      const collectedTotal = collection.reduce((total, row) => total + row.amount, 0);
      const depositedTotal = deposits.reduce((total, row) => total + row.amount, 0);

      sendJson(res, 200, {
        summary: {
          from: range.from,
          to: range.to,
          collectedTotal,
          depositedTotal,
          variance: collectedTotal - depositedTotal,
        },
        rows: deposits.map((row) => ({
          id: row.id,
          marketId: row.market_id,
          marketName: row.market_name,
          reference: row.reference,
          amount: row.amount,
          depositedAt: row.deposited_at,
        })),
      });
    },
  },
];
