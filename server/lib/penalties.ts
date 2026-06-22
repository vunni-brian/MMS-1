/**
 * @file Penalty notification helpers.
 * Builds display names and notification messages for penalty events (issued
 * or cancelled).
 */

import type { NotificationChannel } from "../types.ts";

const penaltyNotificationChannels: NotificationChannel[] = ["system", "sms"];

/** Human-readable display name for a penalty, falling back to "Penalty Charge". */
export const getPenaltyDisplayName = (reason?: string | null) => {
  const trimmed = reason?.trim();
  return trimmed ? `Penalty - ${trimmed}` : "Penalty Charge";
};

/** Format the notification message for a newly issued penalty. */
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

/** Format the notification message for a cancelled penalty. */
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

/** Return the channels used for penalty notifications (`system` + `sms`). */
export const getPenaltyNotificationChannels = () => penaltyNotificationChannels;
