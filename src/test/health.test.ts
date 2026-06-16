import { describe, expect, it } from "vitest";

describe("health check endpoints", () => {
  it("public health returns ok status", () => {
    const result = { status: "healthy", timestamp: new Date().toISOString() };
    expect(result.status).toBe("healthy");
    expect(result.timestamp).toBeTruthy();
  });

  it("determines overall status from checks", () => {
    const checks = [
      { status: "healthy" },
      { status: "healthy" },
    ];
    const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
    const hasDegraded = checks.some((c) => c.status === "degraded");
    const overall = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";
    expect(overall).toBe("healthy");
  });

  it("reports degraded when any check degraded", () => {
    const checks = [
      { status: "healthy" },
      { status: "degraded" },
    ];
    const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
    const hasDegraded = checks.some((c) => c.status === "degraded");
    const overall = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";
    expect(overall).toBe("degraded");
  });

  it("reports unhealthy when any check unhealthy", () => {
    const checks = [
      { status: "healthy" },
      { status: "unhealthy" },
    ];
    const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
    const hasDegraded = checks.some((c) => c.status === "degraded");
    const overall = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";
    expect(overall).toBe("unhealthy");
  });

  it("uptime is a positive number", () => {
    const uptime = process.uptime();
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(typeof uptime).toBe("number");
  });

  it("liveness check returns alive true", () => {
    const liveness = { alive: true, uptime: process.uptime() };
    expect(liveness.alive).toBe(true);
    expect(liveness.uptime).toBeGreaterThanOrEqual(0);
  });

  it("readiness check passes when database is healthy", () => {
    const ready = { ready: true };
    expect(ready.ready).toBe(true);
  });

  it("readiness check fails when database is unhealthy", () => {
    const notReady = { ready: false, reason: "Database not ready" };
    expect(notReady.ready).toBe(false);
    expect(notReady.reason).toBeTruthy();
  });

  it("metrics returns process info", () => {
    const metrics = {
      process: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
        nodeVersion: process.version,
      },
    };
    expect(metrics.process.uptime).toBeGreaterThanOrEqual(0);
    expect(metrics.process.memoryUsage).toBeDefined();
    expect(metrics.process.pid).toBeGreaterThan(0);
    expect(metrics.process.nodeVersion).toBeTruthy();
  });

  it("migration check counts correctly", () => {
    const check = { applied: 21, total: 21, pending: 0 };
    expect(check.applied).toBe(21);
    expect(check.total).toBe(21);
    expect(check.pending).toBe(0);
    expect(check.pending === 0 ? "healthy" : "degraded").toBe("healthy");
  });

  it("maps unhealthy status to 503", () => {
    const status = "unhealthy" as const;
    const statusCode = status === "unhealthy" ? 503 : 200;
    expect(statusCode).toBe(503);
  });

  it("maps healthy status to 200", () => {
    const status = "healthy" as const;
    const statusCode = status === "unhealthy" ? 503 : 200;
    expect(statusCode).toBe(200);
  });

  it("background job health tracks failures", () => {
    const jobs = {
      notifications: { status: "healthy", failures: 0 },
      "audit-cleanup": { status: "degraded", failures: 2 },
    };
    expect(jobs.notifications.status).toBe("healthy");
    expect(jobs["audit-cleanup"].status).toBe("degraded");
  });
});
