/**
 * @file Notification priority inference.
 * Determines whether a notification should be labelled `low`, `normal`, or
 * `high` based on its type and message content.
 */

import type { NotificationPriority, NotificationType } from "../types.ts";

/** Infer priority level (`high` / `normal` / `low`) from notification type and message content. */
export const getNotificationPriority = (type: NotificationType | string, message: string): NotificationPriority => {
  const normalized = message.toLowerCase();
  if (
    type === "otp" ||
    normalized.includes("rejected") ||
    normalized.includes("failed") ||
    normalized.includes("expired") ||
    normalized.includes("suspended") ||
    normalized.includes("overdue") ||
    normalized.includes("penalty")
  ) {
    return "high";
  }

  if (
    type === "complaint" ||
    normalized.includes("awaiting") ||
    normalized.includes("approval") ||
    normalized.includes("approved") ||
    normalized.includes("assigned") ||
    normalized.includes("payment")
  ) {
    return "normal";
  }

  return "low";
};
