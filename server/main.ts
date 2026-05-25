import { createServer } from "node:http";

import { config } from "./config.ts";
import { getBearerToken, matchRoute, sendError, sendJson, setCorsHeaders, type RouteContext, type RouteDefinition } from "./lib/http.ts";
import { authenticateToken } from "./lib/session.ts";
import { initDatabase, seedDatabase } from "./lib/db.ts";
import { authRoutes } from "./modules/auth.ts";
import { billingRoutes } from "./modules/billing.ts";
import { marketRoutes } from "./modules/markets.ts";
import { vendorRoutes } from "./modules/vendors.ts";
import { stallRoutes } from "./modules/stalls.ts";
import { paymentRoutes } from "./modules/payments.ts";
import { notificationRoutes, processNotificationDeliveries } from "./modules/notifications.ts";
import { ticketRoutes } from "./modules/tickets.ts";
import { reportRoutes } from "./modules/reports.ts";
import { fallbackRoutes } from "./modules/fallback.ts";
import { coordinationRoutes } from "./modules/coordination.ts";
import { resourceRequestRoutes } from "./modules/resources.ts";
import { utilityChargeRoutes } from "./modules/utilities.ts";
import { penaltyRoutes } from "./modules/penalties.ts";
import { announcementRoutes } from "./modules/announcements.ts";

const routes: RouteDefinition[] = [
  ...authRoutes,
  ...billingRoutes,
  ...marketRoutes,
  ...vendorRoutes,
  ...stallRoutes,
  ...paymentRoutes,
  ...notificationRoutes,
  ...ticketRoutes,
  ...reportRoutes,
  ...coordinationRoutes,
  ...announcementRoutes,
  ...resourceRequestRoutes,
  ...utilityChargeRoutes,
  ...penaltyRoutes,
  ...fallbackRoutes,
];

if (config.autoMigrate) {
  await initDatabase();
}

if (config.seedOnBoot) {
  await seedDatabase();
}

const backgroundTaskState = new Map<string, { running: boolean; failures: number; nextRunAt: number }>();

const runBackgroundTask = (label: string, task: () => Promise<void>) => {
  const state = backgroundTaskState.get(label) || { running: false, failures: 0, nextRunAt: 0 };

  // Avoid overlapping retries and back off when infrastructure is temporarily unavailable.
  if (state.running || Date.now() < state.nextRunAt) {
    backgroundTaskState.set(label, state);
    return;
  }

  state.running = true;
  backgroundTaskState.set(label, state);

  void task()
    .then(() => {
      backgroundTaskState.set(label, { running: false, failures: 0, nextRunAt: 0 });
    })
    .catch((error) => {
      const failures = state.failures + 1;
      const retryDelayMs = Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5));
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(`[background:${label}]`, message);
      backgroundTaskState.set(label, {
        running: false,
        failures,
        nextRunAt: Date.now() + retryDelayMs,
      });
    });
};

setInterval(() => {
  runBackgroundTask("notifications", processNotificationDeliveries);
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
