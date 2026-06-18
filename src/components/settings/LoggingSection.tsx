import { useTranslation } from "react-i18next";
import { MonitorCog } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingInput, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const LoggingSection = ({ getBoolean, updateSetting, getString }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:logging.title")} description={t("settings:logging.description")} actions={<MonitorCog className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <SettingToggle label={t("settings:logging.debugLogs")} detail={t("settings:logging.debugLogsDesc")} checked={getBoolean("logDebug")} onCheckedChange={(checked) => updateSetting("logDebug", checked)} />
          <SettingToggle label={t("settings:logging.infoLogs")} detail={t("settings:logging.infoLogsDesc")} checked={getBoolean("logInfo")} onCheckedChange={(checked) => updateSetting("logInfo", checked)} />
          <SettingToggle label={t("settings:logging.warningLogs")} detail={t("settings:logging.warningLogsDesc")} checked={getBoolean("logWarning")} onCheckedChange={(checked) => updateSetting("logWarning", checked)} />
          <SettingToggle label={t("settings:logging.errorLogs")} detail={t("settings:logging.errorLogsDesc")} checked={getBoolean("logError")} onCheckedChange={(checked) => updateSetting("logError", checked)} />
        </div>
        <SettingInput id="settings-log-retention" label={t("settings:logging.appLogRetention")} value={getString("logRetention")} onChange={(value) => updateSetting("logRetention", value)} />
        <SettingInput id="settings-audit-retention" label={t("settings:logging.auditLogRetention")} value={getString("auditRetention")} onChange={(value) => updateSetting("auditRetention", value)} />
      </Panel>
    </div>
  );
};

export default LoggingSection;
