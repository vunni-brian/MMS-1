import { describe, expect, it } from "vitest";

import { buildVendorPasswordResetMessage, validatePasswordStrength } from "../../server/lib/passwords.ts";

describe("password helpers", () => {
  it("rejects passwords shorter than eight characters", () => {
    expect(() => validatePasswordStrength("short")).toThrow("Password must be at least 8 characters long.");
  });

  it("accepts passwords that meet the minimum length", () => {
    expect(() => validatePasswordStrength("Vendor123!")).not.toThrow();
  });

  it("builds the vendor password reset message", () => {
    expect(
      buildVendorPasswordResetMessage({
        temporaryPassword: "Tmpabcd1234!",
        reason: "Identity confirmed at the office",
        appUrl: "https://mms.example.com",
      }),
    ).toBe(
      "Your password was reset by market support. Reason: Identity confirmed at the office. Temporary password: Tmpabcd1234!. Sign in at https://mms.example.com and change it immediately.",
    );
  });
});
