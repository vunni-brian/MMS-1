import { describe, expect, it } from "vitest";

import { calculateUtilityChargeAmount, getUtilityChargeDisplayName, getUtilityChargeResetStatus } from "../../server/lib/utilities.ts";

describe("utility charge helpers", () => {
  it("calculates fixed and usage-based utility amounts", () => {
    expect(calculateUtilityChargeAmount({ calculationMethod: "fixed", amount: 60000 })).toBe(60000);
    expect(calculateUtilityChargeAmount({ calculationMethod: "metered", usageQuantity: 120, ratePerUnit: 500 })).toBe(60000);
    expect(calculateUtilityChargeAmount({ calculationMethod: "estimated", usageQuantity: 40, ratePerUnit: 2500 })).toBe(100000);
  });

  it("builds utility display names from description or fallback labels", () => {
    expect(
      getUtilityChargeDisplayName({
        utilityType: "electricity",
        description: "April Electricity Bill",
        billingPeriod: "April 2026",
      }),
    ).toBe("April Electricity Bill");

    expect(
      getUtilityChargeDisplayName({
        utilityType: "water",
        description: "",
        billingPeriod: "April 2026",
      }),
    ).toBe("Water - April 2026");
  });

  it("resets failed utility payments back to unpaid or overdue", () => {
    expect(getUtilityChargeResetStatus("2026-04-20", "2026-04-15")).toBe("unpaid");
    expect(getUtilityChargeResetStatus("2026-04-10", "2026-04-15")).toBe("overdue");
  });
});
