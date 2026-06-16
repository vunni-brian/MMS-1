import { Activity } from "lucide-react";
import { Panel, LoadingState } from "@/components/console/ConsolePage";
import { EmptyState } from "@/components/EmptyState";

interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  time: string;
}

interface ActivitySectionProps {
  auditPending: boolean;
  canReadAudit: boolean;
  activityRows: ActivityRow[];
}

const ActivitySection = ({ auditPending, canReadAudit, activityRows }: ActivitySectionProps) => (
  <div className="space-y-4">
    <Panel
      title="Activity Log"
      description="Account and operational activity visible to this role."
      actions={<Activity className="h-4 w-4 text-muted-foreground" />}
    >
      {auditPending && canReadAudit ? (
        <LoadingState rows={5} itemClassName="h-14 rounded-lg" />
      ) : activityRows.length === 0 ? (
        <EmptyState title="No activity records loaded" description="Profile changes, password updates, receipts, and operational events will appear here." icon={Activity} />
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

export default ActivitySection;
export type { ActivitySectionProps, ActivityRow };
