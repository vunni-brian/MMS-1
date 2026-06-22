/**
 * @file Utility-charge helpers.
 * Determines notification channels for utility creation, updates, and
 * invoice generation based on the utility type (water, electricity, etc.)
 * and current charge status.
 */

import type {
  NotificationChannel,
  UtilityCalculationMethod,
  UtilityChargeStatus,
  UtilityType,
} from "../types.ts";

const utilityNotificationChannels: NotificationChannel[] = ["system", "sms"];

const utilityTypeLabels: Record<UtilityType, string> = {
  electricity: "Electricity",
  water: "Water",
  sanitation: "Sanitation",
  garbage: "Garbage",
  other: "Utility Service",
};

/** Return a human-readable label for a utility type (Electricity, Water, etc.). */
export const getUtilityTypeLabel = (utilityType: UtilityType | string) => {
  return utilityTypeLabels[utilityType as UtilityType] || utilityType;
};

/** Build a display name for a utility charge, preferring a custom description. */
export const getUtilityChargeDisplayName = ({
  utilityType,
  description,
  billingPeriod,
}: {
  utilityType: UtilityType | string;
  description?: string | null;
  billingPeriod?: string | null;
}) => {
  const trimmedDescription = description?.trim();
  if (trimmedDescription) {
    return trimmedDescription;
  }

  const baseLabel = getUtilityTypeLabel(utilityType);
  return billingPeriod ? `${baseLabel} - ${billingPeriod}` : baseLabel;
};

/** Compute the amount for a utility charge — fixed or usage × rate — rounded to the nearest integer. */
export const calculateUtilityChargeAmount = ({
  calculationMethod,
  usageQuantity,
  ratePerUnit,
  amount,
}: {
  calculationMethod: UtilityCalculationMethod;
  usageQuantity?: number | null;
  ratePerUnit?: number | null;
  amount?: number | null;
}) => {
  if (calculationMethod === "fixed") {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("A valid fixed amount is required.");
    }

    return Math.round(amount);
  }

  if (typeof usageQuantity !== "number" || !Number.isFinite(usageQuantity) || usageQuantity <= 0) {
    throw new Error("Usage quantity must be greater than zero.");
  }

  if (typeof ratePerUnit !== "number" || !Number.isFinite(ratePerUnit) || ratePerUnit <= 0) {
    throw new Error("Rate per unit must be greater than zero.");
  }

  return Math.round(usageQuantity * ratePerUnit);
};

/** Determine whether a charge is `overdue` or still `unpaid` by comparing the due date with today. */
export const getUtilityChargeResetStatus = (
  dueDate: string,
  currentDate = new Date().toISOString().slice(0, 10),
): Extract<UtilityChargeStatus, "unpaid" | "overdue"> => (dueDate < currentDate ? "overdue" : "unpaid");

/** Format the notification message for a newly created utility charge. */
export const getUtilityChargeCreatedMessage = ({
  utilityType,
  description,
  billingPeriod,
  amount,
  dueDate,
}: {
  utilityType: UtilityType | string;
  description?: string | null;
  billingPeriod?: string | null;
  amount: number;
  dueDate: string;
}) =>
  [
    "New Utility Charge",
    "",
    `${getUtilityChargeDisplayName({ utilityType, description, billingPeriod })} has been assigned to your account.`,
    "",
    `Amount: UGX ${amount.toLocaleString()}`,
    `Due Date: ${dueDate}`,
    "Status: Unpaid",
  ].join("\n");

/** Format the notification message for an overdue utility charge. */
export const getUtilityChargeOverdueMessage = ({
  utilityType,
  description,
  billingPeriod,
  amount,
  dueDate,
}: {
  utilityType: UtilityType | string;
  description?: string | null;
  billingPeriod?: string | null;
  amount: number;
  dueDate: string;
}) =>
  [
    "Utility Charge Overdue",
    "",
    `${getUtilityChargeDisplayName({ utilityType, description, billingPeriod })} is now overdue.`,
    "",
    `Amount: UGX ${amount.toLocaleString()}`,
    `Due Date: ${dueDate}`,
    "Status: Overdue",
  ].join("\n");

/** Format the notification message for a cancelled utility charge. */
export const getUtilityChargeCancelledMessage = ({
  utilityType,
  description,
  billingPeriod,
  amount,
}: {
  utilityType: UtilityType | string;
  description?: string | null;
  billingPeriod?: string | null;
  amount: number;
}) =>
  [
    "Utility Charge Cancelled",
    "",
    `${getUtilityChargeDisplayName({ utilityType, description, billingPeriod })} has been cancelled.`,
    "",
    `Amount: UGX ${amount.toLocaleString()}`,
    "Status: Cancelled",
  ].join("\n");

/** Return the channels used for utility charge notifications (`system` + `sms`). */
export const getUtilityNotificationChannels = () => utilityNotificationChannels;
