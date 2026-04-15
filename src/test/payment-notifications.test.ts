import { describe, expect, it } from "vitest";

import { formatPaymentNotificationDate, getPaymentItemLabel, getVendorPaymentNotification } from "../../server/lib/payment-notifications.ts";

describe("payment notification rules", () => {
  it("formats a confirmed vendor payment message after completion", () => {
    const completedAt = "2026-04-15T10:20:00.000Z";

    expect(
      getVendorPaymentNotification({
        previousStatus: "pending",
        nextStatus: "completed",
        amount: 150000,
        chargeType: "booking_fee",
        providerReference: "PESA-123456",
        transactionId: "CONFIRM-777",
        externalReference: "payment_abc123",
        completedAt,
      }),
    ).toEqual({
      channels: ["system", "sms"],
      message: [
        "Payment Successful",
        "",
        "Your payment of UGX 150,000 for Stall Booking has been received successfully.",
        "",
        "Reference: PESA-123456",
        "Status: Confirmed",
        `Date: ${formatPaymentNotificationDate(completedAt)}`,
        "",
        "Thank you.",
      ].join("\n"),
    });
  });

  it("does not create a vendor message for failed payments or repeated completions", () => {
    expect(
      getVendorPaymentNotification({
        previousStatus: "pending",
        nextStatus: "failed",
        amount: 150000,
        chargeType: "booking_fee",
        providerReference: "PESA-123456",
        transactionId: "CONFIRM-777",
        externalReference: "payment_abc123",
        completedAt: "2026-04-15T10:20:00.000Z",
      }),
    ).toBeNull();

    expect(
      getVendorPaymentNotification({
        previousStatus: "completed",
        nextStatus: "completed",
        amount: 150000,
        chargeType: "booking_fee",
        providerReference: "PESA-123456",
        transactionId: "CONFIRM-777",
        externalReference: "payment_abc123",
        completedAt: "2026-04-15T10:20:00.000Z",
      }),
    ).toBeNull();
  });

  it("uses friendly labels for charge types", () => {
    expect(getPaymentItemLabel({ chargeType: "utilities" })).toBe("Utilities Payment");
    expect(getPaymentItemLabel({ chargeType: "market_dues" })).toBe("Market Dues");
  });
});
