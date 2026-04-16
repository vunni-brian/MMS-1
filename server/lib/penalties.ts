import type { NotificationChannel } from "../types.ts";

const penaltyNotificationChannels: NotificationChannel[] = ["system", "sms"];

export const getPenaltyDisplayName = (reason?: string | null) => {
  const trimmed = reason?.trim();
  return trimmed ? `Penalty - ${trimmed}` : "Penalty Charge";
};

export const getPenaltyCreatedMessage = ({
  reason,
  amount,
}: {
  reason: string;
  amount: number;
}) =>
  [
    "Penalty Issued",
    "",
    `A penalty has been issued for: ${reason}.`,
    "",
    `Amount: UGX ${amount.toLocaleString()}`,
    "Status: Unpaid",
  ].join("\n");

export const getPenaltyCancelledMessage = ({
  reason,
  amount,
}: {
  reason: string;
  amount: number;
}) =>
  [
    "Penalty Cancelled",
    "",
    `The penalty for ${reason} has been cancelled.`,
    "",
    `Amount: UGX ${amount.toLocaleString()}`,
    "Status: Cancelled",
  ].join("\n");

export const getPenaltyNotificationChannels = () => penaltyNotificationChannels;
