import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SettingInput, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const OfficialOversightSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={t("settings:officialOversight.title")}
        description={t("settings:officialOversight.description")}
        actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        <SettingInput
          id="settings-sla-threshold"
          label={t("settings:officialOversight.complaintSlaThreshold")}
          detail={t("settings:officialOversight.complaintSlaThresholdDesc")}
          value={getString("slaThreshold")}
          onChange={(value) => updateSetting("slaThreshold", value)}
        />
        <SettingToggle
          label={t("settings:officialOversight.occupancyAlerts")}
          detail={t("settings:officialOversight.occupancyAlertsDesc")}
          checked={getBoolean("occupancyAlerts")}
          onCheckedChange={(checked) => updateSetting("occupancyAlerts", checked)}
        />
        <SettingToggle
          label={t("settings:officialOversight.revenueVarianceAlerts")}
          detail={t("settings:officialOversight.revenueVarianceAlertsDesc")}
          checked={getBoolean("revenueAlerts")}
          onCheckedChange={(checked) => updateSetting("revenueAlerts", checked)}
        />
        <SettingInput
          id="settings-approval-threshold"
          label={t("settings:officialOversight.approvalThreshold")}
          detail={t("settings:officialOversight.approvalThresholdDesc")}
          value={getString("approvalThreshold")}
          onChange={(value) => updateSetting("approvalThreshold", value)}
        />
      </Panel>
    </div>
  );
};

export default OfficialOversightSection;
