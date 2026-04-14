import { createServer } from "node:http";

import { config } from "./config.ts";
import { getBearerToken, matchRoute, sendError, sendJson, setCorsHeaders, type RouteContext, type RouteDefinition } from "./lib/http.ts";
import { authenticateToken } from "./lib/session.ts";
import { initDatabase, seedDatabase } from "./lib/db.ts";
import { authRoutes } from "./modules/auth.ts";
import { marketRoutes } from "./modules/markets.ts";
import { vendorRoutes } from "./modules/vendors.ts";
import { stallRoutes } from "./modules/stalls.ts";
import { paymentRoutes, settlePendingPayments } from "./modules/payments.ts";
import { notificationRoutes, processNotificationDeliveries } from "./modules/notifications.ts";
import { ticketRoutes } from "./modules/tickets.ts";
import { reportRoutes } from "./modules/reports.ts";
import { fallbackRoutes } from "./modules/fallback.ts";
import { coordinationRoutes } from "./modules/coordination.ts";
import { resourceRequestRoutes } from "./modules/resources.ts";

const routes: RouteDefinition[] = [
  ...authRoutes,
  ...marketRoutes,
  ...vendorRoutes,
  ...stallRoutes,
  ...paymentRoutes,
  ...notificationRoutes,
  ...ticketRoutes,
  ...reportRoutes,
  ...coordinationRoutes,
  ...resourceRequestRoutes,
  ...fallbackRoutes,
];

if (config.autoMigrate) {
  await initDatabase();
}

if (config.seedOnBoot) {
  await seedDatabase();
}

const runBackgroundTask = (label: string, task: () => Promise<void>) => {
  void task().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[background:${label}]`, message);
  });
};

setInterval(() => {
  runBackgroundTask("notifications", processNotificationDeliveries);
  if (config.mockPaymentSettlementEnabled) {
    runBackgroundTask("payments", settlePendingPayments);
  }
}, 2_000);

const server = createServer(async (req, res) => {
  setCorsHeaders(req, res, config);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const origin = req.headers.host || `localhost:${config.apiPort}`;
    const url = new URL(req.url || "/", `http://${origin}`);
    const auth = await authenticateToken(getBearerToken(req));
    const route = routes.find((candidate) => candidate.method === req.method && matchRoute(candidate.path, url.pathname));

    if (!route) {
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 404, { error: "Route not found." });
      return;
    }

    const params = matchRoute(route.path, url.pathname) || {};
    const context: RouteContext = {
      req,
      res,
      url,
      config,
      params,
      auth,
    };

    await route.handler(context);
  } catch (error) {
    sendError(res, error);
  }
});

server.listen(config.apiPort, () => {
  console.log(`MMS API listening on ${config.apiUrl}`);
});
