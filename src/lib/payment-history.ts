import type { ChargeTypeName, Payment, PaymentStatus } from "@/types";

export type PaymentHistoryStatusFilter = "all" | PaymentStatus | "cancelled";

export type PaymentHistoryFilters = {
  dateFrom: string;
  dateTo: string;
  status: PaymentHistoryStatusFilter;
  year: string;
};

const chargeTypeLabels: Record<ChargeTypeName, string> = {
  market_dues: "Market Dues",
  utilities: "Utilities Payment",
  penalties: "Penalty Payment",
  booking_fee: "Stall Booking",
  payment_gateway: "Payment Gateway Charge",
};

const getSafeTimestamp = (value: string | null) => {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
};

export const getChargeTypeLabel = (chargeType: ChargeTypeName) => chargeTypeLabels[chargeType] || "Payment";

export const getPaymentPurpose = (payment: Pick<Payment, "chargeType" | "stallName" | "description">) => {
  const chargeTypeLabel = getChargeTypeLabel(payment.chargeType);

  if (payment.description) {
    return payment.description;
  }

  if (payment.chargeType === "booking_fee" && payment.stallName) {
    return `${chargeTypeLabel} - ${payment.stallName}`;
  }

  return chargeTypeLabel;
};

export const getPaymentReference = (payment: Pick<Payment, "providerReference" | "externalReference">) =>
  payment.providerReference || payment.externalReference;

export const getPaymentTimelineDate = (payment: Pick<Payment, "completedAt" | "createdAt">) => payment.completedAt || payment.createdAt;

export const getPaymentHistoryYears = (payments: Payment[]) =>
  Array.from(
    new Set(
      payments
        .map((payment) => new Date(getPaymentTimelineDate(payment)).getFullYear())
        .filter((year) => Number.isFinite(year)),
    ),
  )
    .sort((left, right) => right - left)
    .map(String);

export const filterPaymentsByHistory = (payments: Payment[], filters: PaymentHistoryFilters) =>
  payments
    .filter((payment) => {
      if (filters.status !== "all" && payment.status !== filters.status) {
        return false;
      }

      const timelineDate = getPaymentTimelineDate(payment);
      const timelineTimestamp = getSafeTimestamp(timelineDate);

      if (filters.year !== "all") {
        if (!Number.isFinite(timelineTimestamp) || new Date(timelineTimestamp).getFullYear().toString() !== filters.year) {
          return false;
        }
      }

      if (filters.dateFrom) {
        const dateFromTimestamp = getSafeTimestamp(`${filters.dateFrom}T00:00:00`);
        if (Number.isFinite(dateFromTimestamp) && (!Number.isFinite(timelineTimestamp) || timelineTimestamp < dateFromTimestamp)) {
          return false;
        }
      }

      if (filters.dateTo) {
        const dateToTimestamp = getSafeTimestamp(`${filters.dateTo}T23:59:59.999`);
        if (Number.isFinite(dateToTimestamp) && (!Number.isFinite(timelineTimestamp) || timelineTimestamp > dateToTimestamp)) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => getSafeTimestamp(getPaymentTimelineDate(right)) - getSafeTimestamp(getPaymentTimelineDate(left)));
