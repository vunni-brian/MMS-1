import { useTranslation } from "react-i18next";
import { Bell, Clock, MessageSquare } from "lucide-react";
import { EmptyState, LoadingState, Panel } from "@/components/console/ConsolePage";
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
}: NotificationsSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={t("settings:notifications.channels")}
        description={t("settings:notifications.channelsDesc")}
        actions={<Bell className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        <SettingToggle
          label={t("settings:notifications.inApp")}
          detail={t("settings:notifications.inAppDesc")}
          checked={getBoolean("inAppNotifications")}
          onCheckedChange={(checked) => updateSetting("inAppNotifications", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.sms")}
          detail={t("settings:notifications.smsDesc")}
          checked={getBoolean("smsNotifications")}
          onCheckedChange={(checked) => updateSetting("smsNotifications", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.email")}
          detail={t("settings:notifications.emailDesc")}
          checked={getBoolean("emailNotifications")}
          onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.quietHours")}
          detail={t("settings:notifications.quietHoursDesc")}
          checked={getBoolean("quietHours")}
          onCheckedChange={(checked) => updateSetting("quietHours", checked)}
        />
      </Panel>

      <Panel
        title={t("settings:notifications.topics")}
        description={t("settings:notifications.topicsDesc")}
        actions={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        contentClassName="grid gap-3 md:grid-cols-2"
      >
        <SettingToggle
          label={t("settings:notifications.paymentReminders")}
          detail={t("settings:notifications.paymentRemindersDesc")}
          checked={getBoolean("notifyPayments")}
          onCheckedChange={(checked) => updateSetting("notifyPayments", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.paymentReceipts")}
          detail={t("settings:notifications.paymentReceiptsDesc")}
          checked={getBoolean("notifyReceipts")}
          onCheckedChange={(checked) => updateSetting("notifyReceipts", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.complaintUpdates")}
          detail={t("settings:notifications.complaintUpdatesDesc")}
          checked={getBoolean("notifyComplaints")}
          onCheckedChange={(checked) => updateSetting("notifyComplaints", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.stallAssignmentChanges")}
          detail={t("settings:notifications.stallAssignmentChangesDesc")}
          checked={getBoolean("notifyAssignments")}
          onCheckedChange={(checked) => updateSetting("notifyAssignments", checked)}
        />
        <SettingToggle
          label={t("settings:notifications.marketNotices")}
          detail={t("settings:notifications.marketNoticesDesc")}
          checked={getBoolean("notifyNotices")}
          onCheckedChange={(checked) => updateSetting("notifyNotices", checked)}
        />
      </Panel>

      <Panel title={t("settings:notifications.recentNotifications")} description={t("settings:notifications.recentNotificationsDesc")} actions={<Clock className="h-4 w-4 text-muted-foreground" />}>
        {notificationsQuery.isPending && canReadNotifications ? (
          <LoadingState rows={3} itemClassName="h-14 rounded-lg" />
        ) : notifications.length === 0 ? (
          <EmptyState title={t("settings:notifications.emptyTitle")} description={t("settings:notifications.emptyDescription")} icon={Bell} />
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
};

export default NotificationsSection;
