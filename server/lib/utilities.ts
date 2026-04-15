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

export const getUtilityTypeLabel = (utilityType: UtilityType | string) => {
  return utilityTypeLabels[utilityType as UtilityType] || utilityType;
};

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

export const getUtilityChargeResetStatus = (
  dueDate: string,
  currentDate = new Date().toISOString().slice(0, 10),
): Extract<UtilityChargeStatus, "unpaid" | "overdue"> => (dueDate < currentDate ? "overdue" : "unpaid");

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

export const getUtilityNotificationChannels = () => utilityNotificationChannels;
