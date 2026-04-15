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
                payments.amount,
                payments.provider,
                payments.transaction_id,
                payments.status
         FROM payments
         INNER JOIN users ON users.id = payments.vendor_id
         LEFT JOIN markets ON markets.id = payments.market_id
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
                bookings.amount,
                COALESCE(SUM(CASE WHEN payments.status = 'completed' THEN payments.amount ELSE 0 END), 0)::INT AS paid_amount,
                bookings.status,
                bookings.created_at
         FROM bookings
         INNER JOIN users ON users.id = bookings.vendor_id
         INNER JOIN stalls ON stalls.id = bookings.stall_id
         LEFT JOIN payments ON payments.booking_id = bookings.id
         LEFT JOIN markets ON markets.id = bookings.market_id
         WHERE ${clauses.join(" AND ")}
         GROUP BY bookings.id, bookings.market_id, markets.name, users.name, stalls.name, bookings.amount, bookings.status, bookings.created_at
         HAVING bookings.amount - COALESCE(SUM(CASE WHEN payments.status = 'completed' THEN payments.amount ELSE 0 END), 0) > 0
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
         ORDER BY audit_events.created_at DESC`,
        params,
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
    path: "/reports/financial-audit",
    handler: async ({ res, auth, url }) => {
      const range = normalizeDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
      const { marketId } = resolveScopedMarket(auth, "report:read", url.searchParams.get("marketId"));
      const collectionClauses = ["status = 'completed'", "created_at::date BETWEEN ?::date AND ?::date"];
      const collectionParams: Array<string | null> = [range.from, range.to];
      appendMarketScope(collectionClauses, collectionParams, "market_id", marketId);
      const collection = await all<{ amount: number }>(
        `SELECT amount
         FROM payments
         WHERE ${collectionClauses.join(" AND ")}`,
        collectionParams,
      );
      const depositClauses = ["bank_deposits.deposited_at::date BETWEEN ?::date AND ?::date"];
      const depositParams: Array<string | null> = [range.from, range.to];
      appendMarketScope(depositClauses, depositParams, "bank_deposits.market_id", marketId);
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
         ORDER BY bank_deposits.deposited_at DESC`,
        depositParams,
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
