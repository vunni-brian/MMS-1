import { describe, expect, it } from "vitest";

import { getPesapalPaymentOutcome, getPesapalRedirectMode } from "../../server/lib/pesapal.ts";

describe("Pesapal helpers", () => {
  it("uses the parent window when iframe checkout is enabled", () => {
    expect(getPesapalRedirectMode(true)).toBe("PARENT_WINDOW");
    expect(getPesapalRedirectMode(false)).toBe("TOP_WINDOW");
  });

  it("maps Pesapal payment status descriptions into local outcomes", () => {
    expect(getPesapalPaymentOutcome("COMPLETED")).toBe("completed");
    expect(getPesapalPaymentOutcome("FAILED")).toBe("failed");
    expect(getPesapalPaymentOutcome("INVALID")).toBe("failed");
    expect(getPesapalPaymentOutcome("REVERSED")).toBe("failed");
    expect(getPesapalPaymentOutcome("PENDING")).toBe("pending");
    expect(getPesapalPaymentOutcome("")).toBe("pending");
  });
});
