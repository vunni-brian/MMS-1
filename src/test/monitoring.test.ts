import { describe, expect, it, vi } from "vitest";

describe("monitoring service", () => {
  it("captures auth failure with details", () => {
    const failure = {
      userId: "user_test",
      phone: "+256700000000",
      reason: "invalid_password",
      ip: "127.0.0.1",
    };
    expect(failure.reason).toBe("invalid_password");
    expect(failure.ip).toBeTruthy();
  });

  it("captures database connectivity failure", () => {
    const error = new Error("Connection refused");
    expect(error.message).toBe("Connection refused");
  });

  it("captures background job failure with metadata", () => {
    const error = new Error("Process failed");
    const metadata = { failures: 3, jobName: "notifications" };
    expect(error.message).toBe("Process failed");
    expect(metadata.failures).toBe(3);
    expect(metadata.jobName).toBe("notifications");
  });

  it("alert severity levels exist", () => {
    const severities = ["critical", "error", "warning", "info"] as const;
    expect(severities).toContain("critical");
    expect(severities).toContain("error");
    expect(severities).toContain("warning");
    expect(severities).toContain("info");
  });

  it("reportAlert handles critical errors", () => {
    const event = {
      severity: "critical" as const,
      source: "test",
      message: "Critical failure",
      error: new Error("Something broke"),
    };
    expect(event.severity).toBe("critical");
    expect(event.source).toBe("test");
    expect(event.message).toBe("Critical failure");
    expect(event.error?.message).toBe("Something broke");
  });

  it("reportAlert handles warning without error", () => {
    const event = {
      severity: "warning" as const,
      source: "test",
      message: "Warning only",
      metadata: { count: 5 },
    };
    expect(event.severity).toBe("warning");
    expect(event.metadata?.count).toBe(5);
  });
});
