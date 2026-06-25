/**
 * Tests for billing charge-type resolution and assertion logic.
 * Verifies global vs market-level overrides, enabled/disabled states,
 * and that disabled charge types throw appropriate HTTP errors.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/lib/db.ts", () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

import { all, get, run } from "../../server/lib/db.ts";
import { listChargeTypes, getChargeTypeById, getResolvedChargeType, assertChargeEnabled, updateChargeType } from "../../server/lib/billing.ts";

beforeEach(() => {
  vi.resetAllMocks();
});

const mockGlobalRow = (overrides = {}) => ({
  id: "ct_global_1",
  name: "payment_gateway",
  display_name: "Online Payment",
  scope: "global" as const,
  market_id: null,
  is_enabled: 1,
  updated_by: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_name: null,
  ...overrides,
});

const mockMarketRow = (overrides = {}) => ({
  id: "ct_market_1",
  name: "payment_gateway",
  display_name: "Online Payment",
  scope: "market" as const,
  market_id: "market_1",
  is_enabled: 0,
  updated_by: "user_admin",
  updated_at: "2026-06-01T00:00:00.000Z",
  updated_by_name: "Admin User",
  ...overrides,
});

describe("listChargeTypes", () => {
  it("returns global charge types when no marketId is given", async () => {
    vi.mocked(all).mockResolvedValue([mockGlobalRow()]);
    const result = await listChargeTypes();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("payment_gateway");
    expect(result[0].scope).toBe("global");
    expect(result[0].isEnabled).toBe(true);
  });

  it("merges market-level overrides when marketId is given", async () => {
    vi.mocked(all)
      .mockResolvedValueOnce([mockGlobalRow()])
      .mockResolvedValueOnce([mockMarketRow()]);
    const result = await listChargeTypes("market_1");
    expect(result).toHaveLength(1);
    expect(result[0].isEnabled).toBe(false);
    expect(result[0].marketId).toBe("market_1");
  });

  it("returns global type when no market override exists", async () => {
    vi.mocked(all)
      .mockResolvedValueOnce([mockGlobalRow()])
      .mockResolvedValueOnce([]);
    const result = await listChargeTypes("market_2");
    expect(result).toHaveLength(1);
    expect(result[0].isEnabled).toBe(true);
    expect(result[0].marketId).toBeNull();
  });
});

describe("getChargeTypeById", () => {
  it("returns null when charge type not found", async () => {
    vi.mocked(get).mockResolvedValue(null);
    const result = await getChargeTypeById("nonexistent");
    expect(result).toBeNull();
  });

  it("returns mapped charge type when found", async () => {
    vi.mocked(get).mockResolvedValue(mockGlobalRow());
    const result = await getChargeTypeById("ct_global_1");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("payment_gateway");
    expect(result!.isEnabled).toBe(true);
  });
});

describe("getResolvedChargeType", () => {
  it("prefers market-level override when it exists", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(mockMarketRow())
      .mockResolvedValueOnce(mockGlobalRow());
    const result = await getResolvedChargeType({ name: "payment_gateway", marketId: "market_1" });
    expect(result).not.toBeNull();
    expect(result!.scope).toBe("market");
    expect(result!.isEnabled).toBe(false);
    expect(result!.marketId).toBe("market_1");
  });

  it("falls back to global when no market override exists", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockGlobalRow());
    const result = await getResolvedChargeType({ name: "payment_gateway", marketId: "market_2" });
    expect(result).not.toBeNull();
    expect(result!.scope).toBe("global");
    expect(result!.isEnabled).toBe(true);
  });

  it("returns null when neither market nor global exists", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const result = await getResolvedChargeType({ name: "nonexistent", marketId: "market_1" });
    expect(result).toBeNull();
  });
});

describe("assertChargeEnabled", () => {
  it("throws 500 when charge type is not configured", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(assertChargeEnabled("payment_gateway", "market_1")).rejects.toThrow("is not configured");
  });

  it("throws 409 when charge type is disabled", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(mockMarketRow({ is_enabled: 0 }))
      .mockResolvedValueOnce(mockGlobalRow());
    await expect(assertChargeEnabled("payment_gateway", "market_1")).rejects.toThrow("is currently disabled");
  });

  it("resolves successfully when charge type is enabled", async () => {
    vi.mocked(get).mockResolvedValue(mockGlobalRow({ is_enabled: 1 }));
    await assertChargeEnabled("payment_gateway");
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("updateChargeType", () => {
  it("updates is_enabled and returns mapped result", async () => {
    vi.mocked(run).mockResolvedValue({ rowCount: 1 } as never);
    vi.mocked(get).mockResolvedValue(mockGlobalRow({ is_enabled: 0 }));
    const result = await updateChargeType({
      chargeTypeId: "ct_global_1",
      isEnabled: false,
      actorUserId: "user_admin",
    });
    expect(result).not.toBeNull();
    expect(result!.isEnabled).toBe(false);
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE charge_types"),
      expect.arrayContaining([0, "user_admin", "ct_global_1"]),
    );
  });

  it("returns null when no rows affected", async () => {
    vi.mocked(run).mockResolvedValue({ rowCount: 0 } as never);
    const result = await updateChargeType({
      chargeTypeId: "nonexistent",
      isEnabled: true,
      actorUserId: "user_admin",
    });
    expect(result).toBeNull();
  });
});
