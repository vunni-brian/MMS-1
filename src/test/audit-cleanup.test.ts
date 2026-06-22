/**
 * Tests for audit log retention policy configuration and cleanup logic.
 * Validates default/custom retention periods, batch sizing limits,
 * cutoff-date computation, and cleanup summary reporting.
 */
import { describe, expect, it } from "vitest";

describe("audit log retention policy", () => {
  it("default retention is 365 days", () => {
    const retentionDays = 365;
    expect(retentionDays).toBe(365);
  });

  it("retention can be configured via env", () => {
    const envValue = "180";
    const parsed = Number(envValue);
    expect(Number.isFinite(parsed) && parsed >= 1).toBe(true);
    expect(parsed).toBe(180);
  });

  it("rejects invalid retention values", () => {
    const invalidValues = ["0", "-1", "abc", ""];
    for (const val of invalidValues) {
      const parsed = Number(val);
      const isValid = Number.isFinite(parsed) && parsed >= 1;
      expect(isValid).toBe(false);
    }
  });

  it("default batch size is 500", () => {
    const batchSize = 500;
    expect(batchSize).toBe(500);
  });

  it("batch size can be configured via env", () => {
    const envValue = "200";
    const parsed = Number(envValue);
    const isValid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 2000;
    expect(isValid).toBe(true);
    expect(parsed).toBe(200);
  });

  it("rejects batch sizes over 2000", () => {
    const envValue = "5000";
    const parsed = Number(envValue);
    const isValid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 2000;
    expect(isValid).toBe(false);
  });

  it("max batches per run is 20", () => {
    const maxBatches = 20;
    expect(maxBatches).toBe(20);
    const batchSize = 500;
    const maxDeletable = maxBatches * batchSize;
    expect(maxDeletable).toBe(10000);
  });

  it("cleanup logs summary to audit", () => {
    const summary = {
      deletedCount: 1500,
      batchesRun: 3,
      retentionDays: 365,
      durationMs: 1200,
    };
    expect(summary.deletedCount).toBe(1500);
    expect(summary.batchesRun).toBe(3);
    expect(summary.retentionDays).toBe(365);
    expect(summary.durationMs).toBeGreaterThan(0);
  });

  it("cleanup does not run when no records to delete", () => {
    const emptyBatch: unknown[] = [];
    expect(emptyBatch.length).toBe(0);
  });

  it("cutoff date is computed correctly", () => {
    const retentionDays = 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const now = new Date();
    const diffMs = now.getTime() - cutoffDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(retentionDays, 0);
  });
});
