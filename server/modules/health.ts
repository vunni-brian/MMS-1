import { get, run } from "../lib/db.ts";
import { sendJson, type RouteDefinition } from "../lib/http.ts";
import { logger } from "../lib/logger.ts";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number; error?: string };
    redis?: { status: string; latency?: number; error?: string };
    externalServices?: {
      pesapal?: { status: string; error?: string };
      africasTalking?: { status: string; error?: string };
      supabase?: { status: string; error?: string };
    };
  };
  version: string;
  environment: string;
}

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

const checkRedis = async (): Promise<{ status: string; latency?: number; error?: string }> => {
  const start = Date.now();
  try {
    // Redis check would go here if Redis is configured
    // For now, we'll skip if not configured
    const latency = Date.now() - start;
    return { status: "healthy", latency };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Redis health check failed", error);
    return { status: "unhealthy", error: message };
  }
};

const checkExternalServices = async (config: {
  pesapalEnabled: boolean;
  africasTalkingEnabled: boolean;
  supabaseEnabled: boolean;
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

  if (config.pesapalEnabled) {
    try {
      // Pesapal health check would go here
      results.pesapal = { status: "healthy" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.pesapal = { status: "unhealthy", error: message };
    }
  }

  if (config.africasTalkingEnabled) {
    try {
      // Africa's Talking health check would go here
      results.africasTalking = { status: "healthy" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.africasTalking = { status: "unhealthy", error: message };
    }
  }

  if (config.supabaseEnabled) {
    try {
      // Supabase health check would go here
      results.supabase = { status: "healthy" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.supabase = { status: "unhealthy", error: message };
    }
  }

  return results;
};

export const healthRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/health",
    handler: async ({ res, config }) => {
      const startTime = Date.now();
      
      const dbCheck = await checkDatabase();
      const redisCheck = await checkRedis();
      const externalChecks = await checkExternalServices({
        pesapalEnabled: config.paymentsEnabled,
        africasTalkingEnabled: !!config.africasTalkingUsername,
        supabaseEnabled: config.supabaseAuthEnabled,
      });

      // Determine overall health status
      const allChecks = [dbCheck, redisCheck, ...Object.values(externalChecks)];
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
          redis: redisCheck,
          externalServices: externalChecks,
        },
        version: process.env.npm_package_version || "1.0.0",
        environment: config.appEnv || "unknown",
      };

      const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;
      sendJson(res, statusCode, result);
      
      logger.info("Health check completed", {
        status: overallStatus,
        latency: Date.now() - startTime,
      });
    },
  },
  {
    method: "GET",
    path: "/health/ready",
    handler: async ({ res, config }) => {
      // Readiness check - is the application ready to serve traffic?
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
      // Liveness check - is the application running?
      sendJson(res, 200, { alive: true, uptime: process.uptime() });
    },
  },
  {
    method: "GET",
    path: "/health/metrics",
    handler: async ({ res }) => {
      // Basic metrics endpoint
      const metrics = {
        process: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version,
        },
        timestamp: new Date().toISOString(),
      };

      sendJson(res, 200, metrics);
    },
  },
];
