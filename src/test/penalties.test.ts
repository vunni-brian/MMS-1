import { describe, expect, it } from "vitest";

import { getPenaltyCreatedMessage, getPenaltyDisplayName } from "../../server/lib/penalties.ts";

describe("penalty helpers", () => {
  it("builds a clear penalty label", () => {
    expect(getPenaltyDisplayName("Late utility payment")).toBe("Penalty - Late utility payment");
    expect(getPenaltyDisplayName("")).toBe("Penalty Charge");
  });

  it("formats a vendor penalty notification", () => {
    expect(getPenaltyCreatedMessage({ reason: "Late utility payment", amount: 15000 })).toBe(
      [
        "Penalty Issued",
        "",
        "A penalty has been issued for: Late utility payment.",
        "",
        "Amount: UGX 15,000",
        "Status: Unpaid",
      ].join("\n"),
    );
  });
});
