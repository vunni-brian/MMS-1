import { Bell, Clock, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState, Panel } from "@/components/console/ConsolePage";
import { SettingToggle } from "@/components/settings";
import { cn, formatHumanDateTime } from "@/lib/utils";
import type { SettingsContext } from "@/components/settings/settingsProps";
import type { AppNotification } from "@/types";
import type { UseQueryResult } from "@tanstack/react-query";

interface NotificationsSectionProps extends SettingsContext {
  notificationsQuery: Pick<UseQueryResult, "isPending">;
  notifications: AppNotification[];
  canReadNotifications: boolean;
}

const NotificationsSection = ({
  getBoolean,
  updateSetting,
  notificationsQuery,
  notifications,
  canReadNotifications,
}: NotificationsSectionProps) => (
  <div className="space-y-4">
    <Panel
      title="Notification Channels"
      description="Choose where operational, billing, and security updates are delivered."
      actions={<Bell className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      <SettingToggle
        label="In-app notifications"
        detail="Show alerts in the dashboard and notification center."
        checked={getBoolean("inAppNotifications")}
        onCheckedChange={(checked) => updateSetting("inAppNotifications", checked)}
      />
      <SettingToggle
        label="SMS notifications"
        detail="Send important updates to the registered phone number."
        checked={getBoolean("smsNotifications")}
        onCheckedChange={(checked) => updateSetting("smsNotifications", checked)}
      />
      <SettingToggle
        label="Email notifications"
        detail="Send receipts, summaries, and account alerts by email."
        checked={getBoolean("emailNotifications")}
        onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
      />
      <SettingToggle
        label="Quiet hours"
        detail="Mute non-critical notifications between 10:00 PM and 7:00 AM."
        checked={getBoolean("quietHours")}
        onCheckedChange={(checked) => updateSetting("quietHours", checked)}
      />
    </Panel>

    <Panel
      title="Notification Topics"
      description="Control the categories that can interrupt your workflow."
      actions={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
      contentClassName="grid gap-3 md:grid-cols-2"
    >
      <SettingToggle
        label="Payment reminders"
        detail="Upcoming dues, overdue fees, and charge assignments."
        checked={getBoolean("notifyPayments")}
        onCheckedChange={(checked) => updateSetting("notifyPayments", checked)}
      />
      <SettingToggle
        label="Payment receipts"
        detail="Receipt verification and gateway status updates."
        checked={getBoolean("notifyReceipts")}
        onCheckedChange={(checked) => updateSetting("notifyReceipts", checked)}
      />
      <SettingToggle
        label="Complaint updates"
        detail="Ticket replies, escalation, and resolution notices."
        checked={getBoolean("notifyComplaints")}
        onCheckedChange={(checked) => updateSetting("notifyComplaints", checked)}
      />
      <SettingToggle
        label="Stall assignment changes"
        detail="Allocation, renewal, and stall status changes."
        checked={getBoolean("notifyAssignments")}
        onCheckedChange={(checked) => updateSetting("notifyAssignments", checked)}
      />
      <SettingToggle
        label="Market notices"
        detail="Announcements and market-wide operating updates."
        checked={getBoolean("notifyNotices")}
        onCheckedChange={(checked) => updateSetting("notifyNotices", checked)}
      />
    </Panel>

    <Panel title="Recent Notifications" description="Latest in-app notifications for this account." actions={<Clock className="h-4 w-4 text-muted-foreground" />}>
      {notificationsQuery.isPending && canReadNotifications ? (
        <LoadingState rows={3} itemClassName="h-14 rounded-lg" />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications loaded" description="Security, payment, complaint, and notice updates will appear here." icon={Bell} />
      ) : (
        <div className="settings-activity-list">
          {notifications.slice(0, 5).map((notification) => (
            <div key={notification.id} className="settings-activity-row">
              <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", notification.read ? "bg-muted-foreground/25" : "bg-primary")} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{notification.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatHumanDateTime(notification.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  </div>
);

export default NotificationsSection;
