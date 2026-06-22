/**
 * @file Health-check and system-information module.
 * Provides `/health` endpoints that report DB / cache / external-service
 * status, server uptime, and version info.
 */

import fs from "node:fs";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { all, run } from "../lib/db.ts";
import { HttpError, sendJson, type RouteDefinition } from "../lib/http.ts";
import { logger } from "../lib/logger.ts";
import { requireAuth } from "../lib/session.ts";

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/migrations");

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number; error?: string };
    migrations?: { status: string; applied: number; total: number; pending: number };
    backgroundJobs?: Record<string, { status: string; failures: number }>;
    externalServices?: {
      pesapal?: { status: string; error?: string };
      africasTalking?: { status: string; error?: string };
      supabase?: { status: string; error?: string };
    };
  };
  version: string;
  environment: string;
  detailed?: boolean;
}

const backgroundTaskStateRef: { current: Map<string, { running: boolean; failures: number; nextRunAt: number }> } = { current: new Map() };

/** Provide the health endpoint with a reference to the background-task state map so it can report per-task status. */
export const setBackgroundTaskStateRef = (state: Map<string, { running: boolean; failures: number; nextRunAt: number }>) => {
  backgroundTaskStateRef.current = state;
};

// Prometheus-compatible counters
interface MetricsStore {
  httpRequestsTotal: number;
  httpRequestsActive: number;
  httpRequestDurationMs: number[];
  httpErrorsByCode: Map<number, number>;
  dbQueryCount: number;
  dbErrorCount: number;
  lastReset: string;
}

const metrics: MetricsStore = {
  httpRequestsTotal: 0,
  httpRequestsActive: 0,
  httpRequestDurationMs: [],
  httpErrorsByCode: new Map(),
  dbQueryCount: 0,
  dbErrorCount: 0,
  lastReset: new Date().toISOString(),
};

/** Record an HTTP request metric (duration and status code). */
export const recordRequest = (durationMs: number, statusCode: number) => {
  metrics.httpRequestsTotal++;
  metrics.httpRequestDurationMs.push(durationMs);
  if (metrics.httpRequestDurationMs.length > 1000) {
    metrics.httpRequestDurationMs = metrics.httpRequestDurationMs.slice(-500);
  }
  if (statusCode >= 400) {
    metrics.httpErrorsByCode.set(statusCode, (metrics.httpErrorsByCode.get(statusCode) || 0) + 1);
  }
};

/** Increment the DB query counter metric. */
export const recordDbQuery = () => { metrics.dbQueryCount++; };
/** Increment the DB error counter metric. */
export const recordDbError = () => { metrics.dbErrorCount++; };

const formatPrometheusMetrics = (): string => {
  const lines: string[] = [];
  lines.push("# HELP mms_http_requests_total Total HTTP requests");
  lines.push("# TYPE mms_http_requests_total counter");
  lines.push(`mms_http_requests_total ${metrics.httpRequestsTotal}`);

  lines.push("# HELP mms_http_requests_active Currently active HTTP requests");
  lines.push("# TYPE mms_http_requests_active gauge");
  lines.push(`mms_http_requests_active ${metrics.httpRequestsActive}`);

  lines.push("# HELP mms_http_request_duration_ms HTTP request duration in ms");
  lines.push("# TYPE mms_http_request_duration_ms histogram");
  const durations = metrics.httpRequestDurationMs;
  if (durations.length > 0) {
    const sum = durations.reduce((a, b) => a + b, 0);
    lines.push(`mms_http_request_duration_ms_count ${durations.length}`);
    lines.push(`mms_http_request_duration_ms_sum ${sum}`);
    // Buckets
    for (const bucket of [50, 100, 200, 500, 1000, 5000]) {
      const count = durations.filter((d) => d <= bucket).length;
      lines.push(`mms_http_request_duration_ms_bucket{le="${bucket}"} ${count}`);
    }
    lines.push(`mms_http_request_duration_ms_bucket{le="+Inf"} ${durations.length}`);
  }

  lines.push("# HELP mms_http_errors_total HTTP errors by status code");
  lines.push("# TYPE mms_http_errors_total counter");
  for (const [code, count] of metrics.httpErrorsByCode) {
    lines.push(`mms_http_errors_total{code="${code}"} ${count}`);
  }

  lines.push("# HELP mms_db_query_total Database queries executed");
  lines.push("# TYPE mms_db_query_total counter");
  lines.push(`mms_db_query_total ${metrics.dbQueryCount}`);

  lines.push("# HELP mms_db_error_total Database query errors");
  lines.push("# TYPE mms_db_error_total counter");
  lines.push(`mms_db_error_total ${metrics.dbErrorCount}`);

  lines.push("# HELP mms_process_info Process metadata");
  lines.push("# TYPE mms_process_info gauge");
  lines.push(`mms_process_info{pid="${process.pid}",platform="${process.platform}",node="${process.version}",uptime="${Math.floor(process.uptime())}"} 1`);

  lines.push("# HELP mms_memory_bytes Process memory usage in bytes");
  lines.push("# TYPE mms_memory_bytes gauge");
  const mem = process.memoryUsage();
  lines.push(`mms_memory_bytes{type="rss"} ${mem.rss}`);
  lines.push(`mms_memory_bytes{type="heapTotal"} ${mem.heapTotal}`);
  lines.push(`mms_memory_bytes{type="heapUsed"} ${mem.heapUsed}`);

  lines.push("# HELP mms_up Was the last scrape successful");
  lines.push("# TYPE mms_up gauge");
  lines.push("mms_up 1");

  return lines.join("\n");
};

const checkDatabase = async (): Promise<{ status: string; latency?: number; error?: string }> => {
  const start = Date.now();
  try {
    await run("SELECT 1");
    const latency = Date.now() - start;
    return { status: "healthy", latency };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Database health check failed", error);
    return { status: "unhealthy", error: message };
  }
};

const checkMigrations = async (): Promise<{ status: string; applied: number; total: number; pending: number }> => {
  try {
    const appliedRows = await all<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name ASC");
    const applied = appliedRows.length;

    let total = 0;
    try {
      const files = fs.readdirSync(migrationsDir, { withFileTypes: true });
      total = files.filter((entry) => entry.isFile() && entry.name.endsWith(".sql")).length;
    } catch {
      total = applied;
    }

    const pending = total - applied;
    return {
      status: pending === 0 ? "healthy" : "degraded",
      applied,
      total,
      pending,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { status: "unhealthy", applied: 0, total: 0, pending: 0 };
  }
};

const pingUrl = (url: string, timeoutMs = 5_000): Promise<{ status: string; error?: string }> => {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const requester = parsed.protocol === "https:" ? httpsGet : httpGet;
      const req = requester(
        url,
        { timeout: timeoutMs, headers: { "User-Agent": "MMS-HealthCheck/1.0" } },
        (res) => {
          res.resume();
          resolve(res.statusCode && res.statusCode < 500 ? { status: "healthy" } : { status: "degraded", error: `HTTP ${res.statusCode}` });
        },
      );
      req.on("error", (err) => resolve({ status: "degraded", error: err.message }));
      req.on("timeout", () => { req.destroy(); resolve({ status: "degraded", error: "timeout" }); });
    } catch {
      resolve({ status: "degraded", error: "invalid URL" });
    }
  });
};

const checkExternalServices = async (config: {
  pesapalEnabled: boolean;
  pesapalBaseUrl: string;
  africasTalkingEnabled: boolean;
  africasTalkingUsername: string;
  supabaseEnabled: boolean;
  supabaseUrl: string;
}): Promise<{
  pesapal?: { status: string; error?: string };
  africasTalking?: { status: string; error?: string };
  supabase?: { status: string; error?: string };
}> => {
  const results: {
    pesapal?: { status: string; error?: string };
    africasTalking?: { status: string; error?: string };
    supabase?: { status: string; error?: string };
  } = {};

  if (config.pesapalEnabled && config.pesapalBaseUrl) {
    results.pesapal = await pingUrl(`${config.pesapalBaseUrl}/api/health`, 3_000);
  }

  if (config.africasTalkingEnabled && config.africasTalkingUsername) {
    results.africasTalking = await pingUrl(`https://api.africastalking.com/version`, 3_000);
  }

  if (config.supabaseEnabled && config.supabaseUrl) {
    results.supabase = await pingUrl(`${config.supabaseUrl}/rest/v1/`, 3_000);
  }

  return results;
};

const checkBackgroundJobs = (): Record<string, { status: string; failures: number }> => {
  const jobs: Record<string, { status: string; failures: number }> = {};
  for (const [label, state] of backgroundTaskStateRef.current.entries()) {
    jobs[label] = {
      status: state.failures > 3 ? "unhealthy" : state.failures > 0 ? "degraded" : "healthy",
      failures: state.failures,
    };
  }
  return jobs;
};

/** Health-check and metrics routes. */
export const healthRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/health",
    handler: async ({ res, config }) => {
      const dbCheck = await checkDatabase();
      const migrationCheck = await checkMigrations();
      const jobChecks = checkBackgroundJobs();
      const externalChecks = await checkExternalServices({
        pesapalEnabled: config.paymentsEnabled,
        pesapalBaseUrl: config.pesapalBaseUrl,
        africasTalkingEnabled: !!config.africasTalkingUsername,
        africasTalkingUsername: config.africasTalkingUsername || "",
        supabaseEnabled: config.supabaseAuthEnabled,
        supabaseUrl: config.supabaseUrl || "",
      });

      const allChecks = [
        dbCheck,
        migrationCheck,
        ...Object.values(jobChecks),
        ...Object.values(externalChecks),
      ];
      const hasUnhealthy = allChecks.some((check) => check.status === "unhealthy");
      const hasDegraded = allChecks.some((check) => check.status === "degraded");

      const overallStatus: "healthy" | "degraded" | "unhealthy" = hasUnhealthy
        ? "unhealthy"
        : hasDegraded
        ? "degraded"
        : "healthy";

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: dbCheck,
          migrations: migrationCheck,
          backgroundJobs: jobChecks,
          externalServices: externalChecks,
        },
        version: process.env.npm_package_version || "1.0.0",
        environment: config.appEnv || "unknown",
      };

      const statusCode = overallStatus === "unhealthy" ? 503 : 200;
      sendJson(res, statusCode, result);

      if (overallStatus !== "healthy") {
        logger.warn("Health check reported non-healthy status", {
          status: overallStatus,
          db: dbCheck.status,
          migrations: migrationCheck.status,
        });
      }
    },
  },
  {
    method: "GET",
    path: "/health/detailed",
    handler: async ({ res, auth, config }) => {
      const session = requireAuth(auth);
      if (session.user.role !== "admin") {
        throw new HttpError(403, "Only admins can access detailed health information.");
      }
      const startTime = Date.now();
      const dbCheck = await checkDatabase();
      const migrationCheck = await checkMigrations();
      const jobChecks = checkBackgroundJobs();
      const externalChecks = await checkExternalServices({
        pesapalEnabled: config.paymentsEnabled,
        pesapalBaseUrl: config.pesapalBaseUrl,
        africasTalkingEnabled: !!config.africasTalkingUsername,
        africasTalkingUsername: config.africasTalkingUsername || "",
        supabaseEnabled: config.supabaseAuthEnabled,
        supabaseUrl: config.supabaseUrl || "",
      });

      const allChecks = [
        dbCheck,
        migrationCheck,
        ...Object.values(jobChecks),
        ...Object.values(externalChecks),
      ];
      const hasUnhealthy = allChecks.some((check) => check.status === "unhealthy");
      const hasDegraded = allChecks.some((check) => check.status === "degraded");

      const overallStatus: "healthy" | "degraded" | "unhealthy" = hasUnhealthy
        ? "unhealthy"
        : hasDegraded
        ? "degraded"
        : "healthy";

      const result = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: {
            ...dbCheck,
            poolTotalCount: undefined as number | undefined,
            poolIdleCount: undefined as number | undefined,
            poolWaitingCount: undefined as number | undefined,
          },
          migrations: migrationCheck,
          backgroundJobs: jobChecks,
          externalServices: externalChecks,
        },
        version: process.env.npm_package_version || "1.0.0",
        environment: config.appEnv || "unknown",
        detailed: true,
        responseTimeMs: Date.now() - startTime,
      };

      const statusCode = overallStatus === "unhealthy" ? 503 : 200;
      sendJson(res, statusCode, result);
    },
  },
  {
    method: "GET",
    path: "/health/ready",
    handler: async ({ res }) => {
      const dbCheck = await checkDatabase();

      if (dbCheck.status !== "healthy") {
        sendJson(res, 503, { ready: false, reason: "Database not ready" });
        return;
      }

      sendJson(res, 200, { ready: true });
    },
  },
  {
    method: "GET",
    path: "/health/live",
    handler: async ({ res }) => {
      sendJson(res, 200, { alive: true, uptime: process.uptime() });
    },
  },
  {
    method: "GET",
    path: "/health/metrics",
    handler: async ({ res, auth }) => {
      requireAuth(auth);
      const metrics = {
        process: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version,
        },
        backgroundJobs: checkBackgroundJobs(),
        timestamp: new Date().toISOString(),
      };

      sendJson(res, 200, metrics);
    },
  },
  {
    method: "GET",
    path: "/health/metrics/prometheus",
    handler: async ({ res, auth }) => {
      requireAuth(auth);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.writeHead(200);
      res.end(formatPrometheusMetrics());
    },
  },
  {
    method: "POST",
    path: "/admin/wipe-test-data",
    handler: async ({ res, auth, config }) => {
      requireAuth(auth);
      if (auth?.user.role !== "admin") {
        throw new HttpError(403, "Only admins can wipe test data.");
      }
      if (config.appEnv === "production") {
        throw new HttpError(403, "Cannot wipe test data in production.");
      }

      const tables = [
        "payment_attempts", "payments", "penalties", "utility_charges",
        "ticket_updates", "tickets", "notification_deliveries", "notifications",
        "coordination_messages", "announcements", "resource_requests",
        "bookings", "stalls", "vendor_profiles", "sessions", "audit_events",
        "fallback_queries", "otp_challenges",
      ];
      for (const table of tables) {
        await run(`DELETE FROM ${table}`);
      }
      await run("DELETE FROM users WHERE role != 'admin'");

      logger.info("Test data wiped by admin", { adminId: auth.user.id });
      sendJson(res, 200, { ok: true, message: "Test data wiped successfully." });
    },
  },
];
