/**
 * Payment history utilities.
 * Provides filtering, sorting, and label helpers for payments.
 */
import type { ChargeTypeName, Payment, PaymentStatus } from "@/types";

/** Filter value that includes all payment statuses, or a specific status. */
export type PaymentHistoryStatusFilter = "all" | PaymentStatus;

/** Filter criteria for querying payment history. */
export type PaymentHistoryFilters = {
  /** Start date for filtering (YYYY-MM-DD). */
  dateFrom: string;
  /** End date for filtering (YYYY-MM-DD). */
  dateTo: string;
  /** Payment status filter. */
  status: PaymentHistoryStatusFilter;
  /** Year filter (four-digit year string or "all"). */
  year: string;
};

/** Human-readable labels for each charge type. */
const chargeTypeLabels: Record<ChargeTypeName, string> = {
  market_dues: "Market Dues",
  utilities: "Utilities Payment",
  penalties: "Penalty Payment",
  booking_fee: "Stall Booking",
  payment_gateway: "Payment service charge",
};

const getSafeTimestamp = (value: string | null) => {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
};

/**
 * Returns a human-readable label for a charge type.
 * @param chargeType - The charge type name.
 * @returns Localised label or "Payment" as fallback.
 */
export const getChargeTypeLabel = (chargeType: ChargeTypeName) => chargeTypeLabels[chargeType] || "Payment";

/**
 * Returns a human-readable payment purpose string.
 * Falls back to stall name for booking fees, or the raw label.
 * @param payment - Partial payment with chargeType, stallName, and description.
 * @returns Purpose description string.
 */
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

/**
 * Returns the best available reference for a payment.
 * Prefers provider references over uploaded receipt IDs.
 * @param payment - Partial payment with reference fields.
 * @returns Reference string or "Receipt pending".
 */
export const getPaymentReference = (payment: Pick<Payment, "providerReference" | "externalReference" | "receiptId">) =>
  payment.providerReference || payment.externalReference || payment.receiptId || "Receipt pending";

/**
 * Returns the date to use when placing a payment on a timeline.
 * Prefers completedAt and falls back to createdAt.
 * @param payment - Partial payment with date fields.
 * @returns Date string for timeline positioning.
 */
export const getPaymentTimelineDate = (payment: Pick<Payment, "completedAt" | "createdAt">) => payment.completedAt || payment.createdAt;

/**
 * Extracts the distinct years from a list of payments, sorted descending.
 * @param payments - Full list of payments.
 * @returns Array of year strings (e.g., ["2026", "2025"]).
 */
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

/**
 * Filters and sorts a list of payments by the given filter criteria.
 * Orders results from newest to oldest by timeline date.
 * @param payments - The full list of payments to filter.
 * @param filters - Filter criteria (status, year, date range).
 * @returns Filtered and sorted payment array.
 */
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
