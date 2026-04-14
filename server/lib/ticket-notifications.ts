import type { NotificationChannel, TicketStatus } from "../types.ts";

const smsStatuses = new Set<TicketStatus>(["in_progress", "resolved"]);

export const getTicketCreationManagerChannels = (): NotificationChannel[] => ["system"];

export const getVendorTicketNotification = ({
  previousStatus,
  nextStatus,
  subject,
}: {
  previousStatus: TicketStatus;
  nextStatus: TicketStatus;
  subject: string;
}) => {
  const statusChanged = previousStatus !== nextStatus;
  const channels: NotificationChannel[] = statusChanged && smsStatuses.has(nextStatus) ? ["system", "sms"] : ["system"];

  return {
    channels,
    message: statusChanged
      ? `Your ticket "${subject}" is now ${nextStatus.replace("_", " ")}.`
      : `Your ticket "${subject}" has a new update.`,
  };
};
