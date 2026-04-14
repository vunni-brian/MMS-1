import { describe, expect, it } from "vitest";

import { getOtpNotificationMessage } from "../../server/lib/otp-messages.ts";

describe("OTP message templates", () => {
  it("uses the default registration template", () => {
    expect(
      getOtpNotificationMessage({
        config: {
          appName: "MMS",
          otpTtlMinutes: 10,
          otpRegistrationMessageTemplate: null,
          otpLoginMessageTemplate: null,
        },
        code: "123456",
        purpose: "registration",
      }),
    ).toBe("Your verification code is 123456. It expires in 10 minutes.");
  });

  it("renders custom login placeholders", () => {
    expect(
      getOtpNotificationMessage({
        config: {
          appName: "MarketFlow",
          otpTtlMinutes: 5,
          otpRegistrationMessageTemplate: null,
          otpLoginMessageTemplate: "{{appName}} {{purpose}} code: {{code}} ({{ttlMinutes}} mins)",
        },
        code: "654321",
        purpose: "login",
      }),
    ).toBe("MarketFlow login code: 654321 (5 mins)");
  });
});
