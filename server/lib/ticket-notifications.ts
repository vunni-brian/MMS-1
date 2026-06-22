/**
 * @file Ticket notification helpers.
 * Determines which channels (SMS, system) to use for ticket-creation and
 * ticket-status-change events based on the current status.
 */

import type { NotificationChannel, TicketStatus } from "../types.ts";

const smsStatuses = new Set<TicketStatus>(["in_progress", "resolved", "closed"]);

/** Manager notifications for new tickets always go through the system channel. */
export const getTicketCreationManagerChannels = (): NotificationChannel[] => ["system"];

/** Build the notification channels and message for a ticket status change visible to the vendor. */
export const getVendorTicketNotification = ({
  previousStatus,
  nextStatus,
  subject,
  ticketNumber,
}: {
  previousStatus: TicketStatus;
  nextStatus: TicketStatus;
  subject: string;
  ticketNumber?: string;
}) => {
  const statusChanged = previousStatus !== nextStatus;
  const channels: NotificationChannel[] = statusChanged && smsStatuses.has(nextStatus) ? ["system", "sms"] : ["system"];
  const reference = ticketNumber ? `${ticketNumber}: ` : "";
  const subjectLabel = ticketNumber ? "complaint" : "ticket";

  return {
    channels,
    message: statusChanged
      ? `${reference}Your ${subjectLabel} "${subject}" is now ${nextStatus.replace("_", " ")}.`
      : `${reference}Your ${subjectLabel} "${subject}" has a new update.`,
  };
};
