/**
 * ActivitySection - Displays recent user activity / audit events in a timeline
 * list with loading and empty states.
 */
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";

/** A single activity event row. */
interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  time: string;
}

/** Props for the ActivitySection component. */
interface ActivitySectionProps {
  auditPending: boolean;
  canReadAudit: boolean;
  activityRows: ActivityRow[];
}

/**
 * ActivitySection - Renders a list of recent audit events or, as a fallback,
 * recent notifications. Shows loading skeleton while audit is pending.
 */
const ActivitySection = ({ auditPending, canReadAudit, activityRows }: ActivitySectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={t("settings:activity.title")}
        description={t("settings:activity.description")}
        actions={<Activity className="h-4 w-4 text-muted-foreground" />}
      >
        {auditPending && canReadAudit ? (
          <LoadingState rows={5} itemClassName="h-14 rounded-lg" />
        ) : activityRows.length === 0 ? (
          <EmptyState title={t("settings:activity.emptyTitle")} description={t("settings:activity.emptyDescription")} icon={<Activity className="h-6 w-6" />} />
        ) : (
          <div className="settings-activity-list">
            {activityRows.map((row) => (
              <div key={row.id} className="settings-activity-row">
                <span className="settings-activity-dot" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{row.time}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default ActivitySection;
export type { ActivitySectionProps, ActivityRow };
