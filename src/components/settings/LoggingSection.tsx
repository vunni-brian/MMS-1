import { MonitorCog } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingInput, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const LoggingSection = ({ getBoolean, updateSetting, getString }: SettingsContext) => (
  <div className="space-y-4">
    <Panel title="Logging and Monitoring" description="Log levels, retention, destinations, and audit storage." actions={<MonitorCog className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <SettingToggle label="Debug logs" detail="Verbose troubleshooting output." checked={getBoolean("logDebug")} onCheckedChange={(checked) => updateSetting("logDebug", checked)} />
        <SettingToggle label="Info logs" detail="Standard operational records." checked={getBoolean("logInfo")} onCheckedChange={(checked) => updateSetting("logInfo", checked)} />
        <SettingToggle label="Warning logs" detail="Potential issues and policy exceptions." checked={getBoolean("logWarning")} onCheckedChange={(checked) => updateSetting("logWarning", checked)} />
        <SettingToggle label="Error logs" detail="Failures and request errors." checked={getBoolean("logError")} onCheckedChange={(checked) => updateSetting("logError", checked)} />
      </div>
      <SettingInput id="settings-log-retention" label="Application log retention" value={getString("logRetention")} onChange={(value) => updateSetting("logRetention", value)} />
      <SettingInput id="settings-audit-retention" label="Audit log retention" value={getString("auditRetention")} onChange={(value) => updateSetting("auditRetention", value)} />
    </Panel>
  </div>
);

export default LoggingSection;
