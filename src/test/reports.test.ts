/**
 * Tests for report helper functions.
 * Verifies date range normalization, market-scope clause appending,
 * and hours-between calculation for the revenue/dues reporting system.
 */
import { describe, expect, it } from "vitest";

import { normalizeDateRange, appendMarketScope, hoursBetween } from "../../server/modules/reports.ts";

describe("normalizeDateRange", () => {
  it("uses defaults when from and to are null", () => {
    const result = normalizeDateRange(null, null);
    expect(result.from).toBe("2000-01-01");
    expect(result.to).toBe("2999-12-31");
  });

  it("uses defaults when from and to are empty strings", () => {
    const result = normalizeDateRange("", null);
    expect(result.from).toBe("2000-01-01");
    expect(result.to).toBe("2999-12-31");
  });

  it("passes through provided dates", () => {
    const result = normalizeDateRange("2026-01-01", "2026-06-30");
    expect(result.from).toBe("2026-01-01");
    expect(result.to).toBe("2026-06-30");
  });

  it("handles only from date provided", () => {
    const result = normalizeDateRange("2026-06-01", null);
    expect(result.from).toBe("2026-06-01");
    expect(result.to).toBe("2999-12-31");
  });
});

describe("appendMarketScope", () => {
  it("appends market clause when marketId is provided", () => {
    const clauses: string[] = ["created_at::date BETWEEN ?::date AND ?::date"];
    const params: Array<string | null> = ["2026-01-01", "2026-06-30"];
    appendMarketScope(clauses, params, "payments.market_id", "market_1");
    expect(clauses).toHaveLength(2);
    expect(clauses[1]).toBe("payments.market_id = ?");
    expect(params).toHaveLength(3);
    expect(params[2]).toBe("market_1");
  });

  it("does not append clause when marketId is null", () => {
    const clauses: string[] = ["created_at::date BETWEEN ?::date AND ?::date"];
    const params: Array<string | null> = ["2026-01-01", "2026-06-30"];
    appendMarketScope(clauses, params, "payments.market_id", null);
    expect(clauses).toHaveLength(1);
    expect(params).toHaveLength(2);
  });
});

describe("hoursBetween", () => {
  it("returns null when either date is null", () => {
    expect(hoursBetween(null, "2026-06-30T00:00:00Z")).toBeNull();
    expect(hoursBetween("2026-01-01T00:00:00Z", null)).toBeNull();
    expect(hoursBetween(null, null)).toBeNull();
  });

  it("computes hours between two dates", () => {
    const result = hoursBetween("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z");
    expect(result).toBe(24);
  });

  it("handles partial day differences", () => {
    const result = hoursBetween("2026-06-01T06:00:00Z", "2026-06-02T12:30:00Z");
    expect(result).toBeCloseTo(30.5, 1);
  });

  it("returns null for invalid dates", () => {
    expect(hoursBetween("invalid", "2026-06-30T00:00:00Z")).toBeNull();
  });
});
