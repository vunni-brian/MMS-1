import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SettingInput, SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const ManagerOperationsSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={t("settings:managerOps.title")}
        description={t("settings:managerOps.description")}
        actions={<Building2 className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        <SettingSelect
          id="settings-rent-cycle"
          label={t("settings:managerOps.defaultRentCycle")}
          value={getString("defaultRentCycle")}
          onValueChange={(value) => updateSetting("defaultRentCycle", value)}
          options={[
            { value: "weekly", label: t("settings:managerOps.weekly") },
            { value: "monthly", label: t("settings:managerOps.monthly") },
            { value: "quarterly", label: t("settings:managerOps.quarterly") },
          ]}
        />
        <SettingSelect
          id="settings-complaint-routing"
          label={t("settings:managerOps.complaintRouting")}
          value={getString("complaintRouting")}
          onValueChange={(value) => updateSetting("complaintRouting", value)}
          options={[
            { value: "market-manager", label: t("settings:managerOps.marketManager") },
            { value: "operations-team", label: t("settings:managerOps.operationsTeam") },
            { value: "official-review", label: t("settings:managerOps.officialReview") },
          ]}
        />
        <SettingInput
          id="settings-escalation-hours"
          label={t("settings:managerOps.escalationTiming")}
          detail={t("settings:managerOps.escalationTimingDesc")}
          value={getString("escalationHours")}
          onChange={(value) => updateSetting("escalationHours", value)}
        />
        <SettingToggle
          label={t("settings:managerOps.automatedReports")}
          detail={t("settings:managerOps.automatedReportsDesc")}
          checked={getBoolean("reportAutomation")}
          onCheckedChange={(checked) => updateSetting("reportAutomation", checked)}
        />
        <SettingToggle
          label={t("settings:managerOps.assistantDelegation")}
          detail={t("settings:managerOps.assistantDelegationDesc")}
          checked={getBoolean("assistantDelegation")}
          onCheckedChange={(checked) => updateSetting("assistantDelegation", checked)}
        />
      </Panel>
    </div>
  );
};

export default ManagerOperationsSection;
