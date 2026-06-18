import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const AdminSystemSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:adminSystem.title")} description={t("settings:adminSystem.description")} actions={<Server className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
        <SettingSelect
          id="settings-system-mode"
          label={t("settings:adminSystem.systemMode")}
          value={getString("systemMode")}
          onValueChange={(value) => updateSetting("systemMode", value)}
          options={[
            { value: "production", label: t("settings:adminSystem.production") },
            { value: "staging", label: t("settings:adminSystem.staging") },
            { value: "maintenance", label: t("settings:adminSystem.maintenance") },
          ]}
        />
        <SettingToggle
          label={t("settings:adminSystem.maintenanceBanner")}
          detail={t("settings:adminSystem.maintenanceBannerDesc")}
          checked={getBoolean("maintenanceMode")}
          onCheckedChange={(checked) => updateSetting("maintenanceMode", checked)}
        />
      </Panel>
    </div>
  );
};

export default AdminSystemSection;
