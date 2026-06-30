/**
 * @file Application entry point.
 * Configures the HTTP server, registers all route modules, wires up background
 * task loops (notification delivery, audit cleanup), and initialises Sentry,
 * database migrations, and graceful shutdown handling.
 */

import crypto from "node:crypto";
import { createServer } from "node:http";

import { config } from "./config.ts";
import { getBearerToken, matchRoute, sendError, sendJson, setCorsHeaders, type RouteContext, type RouteDefinition } from "./lib/http.ts";
import { authenticateToken } from "./lib/session.ts";
import { canConnectToDatabase, initDatabase, seedDatabase } from "./lib/db.ts";
import { rateLimitMiddleware } from "./lib/rate-limit.ts";
import { cleanupAuditLogs } from "./lib/audit-cleanup.ts";
import { registerGracefulShutdown } from "./lib/graceful-shutdown.ts";
import { initSentry, captureException } from "./lib/sentry.ts";
import { logger, extractRequestContext } from "./lib/logger.ts";
import { getSecurityConfigFromAppConfig, setSecurityHeaders } from "./lib/security-headers.ts";
import { captureBackgroundJobFailure } from "./lib/monitoring.ts";
import { validateEnvVars, validateProductionConfig } from "./lib/startup-validation.ts";
import { authRoutes } from "./modules/auth.ts";
import { billingRoutes } from "./modules/billing.ts";
import { marketRoutes } from "./modules/markets.ts";
import { vendorRoutes } from "./modules/vendors.ts";
import { stallRoutes } from "./modules/stalls.ts";
import { paymentRoutes, sweepStaleInitiatingPayments } from "./modules/payments.ts";
import { notificationRoutes, processNotificationDeliveries } from "./modules/notifications.ts";
import { ticketRoutes } from "./modules/tickets.ts";
import { reportRoutes } from "./modules/reports.ts";
import { fallbackRoutes } from "./modules/fallback.ts";
import { coordinationRoutes } from "./modules/coordination.ts";
import { resourceRequestRoutes } from "./modules/resources.ts";
import { utilityChargeRoutes } from "./modules/utilities.ts";
import { penaltyRoutes } from "./modules/penalties.ts";
import { announcementRoutes } from "./modules/announcements.ts";
import { healthRoutes, recordRequest, setBackgroundTaskStateRef } from "./modules/health.ts";

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
  ...healthRoutes,
];

initSentry({
  dsn: process.env.SENTRY_DSN || "",
  environment: config.appEnv,
  release: process.env.npm_package_version || "1.0.0",
  enabled: Boolean(process.env.SENTRY_DSN),
  sampleRate: Number(process.env.SENTRY_SAMPLE_RATE || 0.1),
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.01),
});

if (config.autoMigrate) {
  try {
    await initDatabase();
  } catch (error) {
    console.warn("[startup] Skipping database migration because PostgreSQL is unavailable.", error instanceof Error ? error.message : error);
  }
}

if (config.seedOnBoot) {
  const databaseReady = await canConnectToDatabase();

  if (!databaseReady) {
    console.warn("[startup] Skipping database seed because PostgreSQL is unavailable.");
  } else {
    try {
      await seedDatabase();
    } catch (error) {
      console.warn("[startup] Seed data could not be applied at boot.", error instanceof Error ? error.message : error);
    }
  }
}

const backgroundTaskState = new Map<string, { running: boolean; failures: number; nextRunAt: number }>();
setBackgroundTaskStateRef(backgroundTaskState);

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
      const bgError = error instanceof Error ? error : new Error(String(error));
      logger.error(`[background:${label}]`, bgError);
      captureBackgroundJobFailure(label, bgError, { failures: state.failures + 1 });
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

// Audit log cleanup every hour
setInterval(() => {
  runBackgroundTask("audit-cleanup", cleanupAuditLogs);
}, 3_600_000);

// Stale-initiating payment sweep every 15 seconds
setInterval(() => {
  runBackgroundTask("sweep-initiating", sweepStaleInitiatingPayments);
}, 15_000);

const server = createServer(async (req, res) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqContext = { ...extractRequestContext(req), requestId };

  setCorsHeaders(req, res, config);
  setSecurityHeaders(req, res, getSecurityConfigFromAppConfig(config));

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const origin = req.headers.host || `localhost:${config.apiPort}`;
    const url = new URL(req.url || "/", `http://${origin}`);

    if (!url.pathname.startsWith("/health")) {
      const strategy = url.pathname.startsWith("/auth/") ? "auth" : "api";
      rateLimitMiddleware(strategy)(req, res, () => {});
    }

    const auth = await authenticateToken(getBearerToken(req));
    const route = routes.find((candidate) => candidate.method === req.method && matchRoute(candidate.path, url.pathname));

    if (!route) {
      sendJson(res, 404, { error: "Route not found." });
      logger.info("Route not found", { ...reqContext, statusCode: 404, durationMs: Date.now() - startTime });
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
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode || 200;
    recordRequest(durationMs, statusCode);
    if (!res.headersSent) {
      logger.info("Request completed", { ...reqContext, statusCode, durationMs });
    } else {
      logger.info("Request completed", { ...reqContext, durationMs });
    }
  } catch (error) {
    sendError(res, error);
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode || 500;
    recordRequest(durationMs, statusCode);
    logger.error("Request failed", error instanceof Error ? error : undefined, { ...reqContext, durationMs });
  }
});

registerGracefulShutdown(server);

validateEnvVars();
await validateProductionConfig(config);

server.listen(config.apiPort, () => {
  console.log(`MMS API listening on ${config.apiUrl}`);
});
