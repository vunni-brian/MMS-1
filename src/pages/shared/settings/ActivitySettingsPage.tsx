/**
 * Activity settings page displaying recent user activity audit log.
 * Accessible to all roles.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { ActivitySection } from "@/components/settings";

/** ActivitySettingsPage - renders the recent activity audit log section. */
const ActivitySettingsPage = () => {
  const hook = useContext(SettingsDataContext);
  if (!hook) return null;
  return (
    <ActivitySection
      auditPending={hook.auditQuery.isPending}
      canReadAudit={hook.canReadAudit}
      activityRows={hook.activityRows}
    />
  );
};
export default ActivitySettingsPage;
