import { describe, expect, it } from "vitest";

import { filterPaymentsByHistory, getPaymentHistoryYears, getPaymentPurpose, getPaymentReference } from "@/lib/payment-history";
import type { Payment } from "@/types";

const makePayment = (overrides: Partial<Payment>): Payment => ({
  id: "payment_1",
  marketId: "market_kampala",
  marketName: "Kampala Central Market",
  bookingId: "booking_1",
  utilityChargeId: null,
  vendorId: "vendor_1",
  vendorName: "Amina",
  stallName: "Stall A12",
  description: null,
  method: "pesapal",
  chargeType: "booking_fee",
  amount: 150000,
  status: "completed",
  transactionId: "CONFIRM-001",
  providerReference: "ORDER-001",
  externalReference: "payment_001",
  phone: "+256700100200",
  receiptId: "RCPT-001",
  receiptMessage: "Payment Successful",
  createdAt: "2026-01-10T08:00:00.000Z",
  updatedAt: "2026-01-10T08:10:00.000Z",
  completedAt: "2026-01-10T08:10:00.000Z",
  ...overrides,
});

describe("payment history helpers", () => {
  it("builds a friendly purpose label for booking payments", () => {
    expect(getPaymentPurpose(makePayment({}))).toBe("Stall Booking - Stall A12");
    expect(
      getPaymentPurpose(
        makePayment({
          bookingId: null,
          utilityChargeId: "utility_charge_1",
          chargeType: "utilities",
          stallName: null,
          description: "Electricity - April 2026",
        }),
      ),
    ).toBe("Electricity - April 2026");
    expect(getPaymentPurpose(makePayment({ chargeType: "utilities", stallName: null }))).toBe("Utilities Payment");
  });

  it("prefers the provider reference when presenting payment evidence", () => {
    expect(getPaymentReference(makePayment({}))).toBe("ORDER-001");
    expect(getPaymentReference(makePayment({ providerReference: null }))).toBe("payment_001");
  });

  it("filters payment history by status, year, and date range", () => {
    const payments = [
      makePayment({ id: "payment_1", status: "completed", completedAt: "2026-01-10T08:10:00.000Z" }),
      makePayment({
        id: "payment_2",
        status: "pending",
        createdAt: "2025-06-01T09:00:00.000Z",
        completedAt: null,
        providerReference: "ORDER-002",
        externalReference: "payment_002",
      }),
      makePayment({
        id: "payment_3",
        status: "failed",
        createdAt: "2026-03-15T11:00:00.000Z",
        completedAt: null,
        providerReference: "ORDER-003",
        externalReference: "payment_003",
      }),
    ];

    expect(
      filterPaymentsByHistory(payments, {
        status: "completed",
        year: "all",
        dateFrom: "",
        dateTo: "",
      }).map((payment) => payment.id),
    ).toEqual(["payment_1"]);

    expect(
      filterPaymentsByHistory(payments, {
        status: "all",
        year: "2025",
        dateFrom: "",
        dateTo: "",
      }).map((payment) => payment.id),
    ).toEqual(["payment_2"]);

    expect(
      filterPaymentsByHistory(payments, {
        status: "all",
        year: "all",
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
      }).map((payment) => payment.id),
    ).toEqual(["payment_3"]);
  });

  it("derives unique years from the payment timeline", () => {
    const payments = [
      makePayment({ completedAt: "2026-01-10T08:10:00.000Z" }),
      makePayment({ id: "payment_2", createdAt: "2025-06-01T09:00:00.000Z", completedAt: null }),
      makePayment({ id: "payment_3", completedAt: "2026-03-15T11:00:00.000Z" }),
    ];

    expect(getPaymentHistoryYears(payments)).toEqual(["2026", "2025"]);
  });
});
