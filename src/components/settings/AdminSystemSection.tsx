import { Server } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const AdminSystemSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => (
  <div className="space-y-4">
    <Panel title="System Controls" description="Operational runtime controls and maintenance behavior." actions={<Server className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
      <SettingSelect
        id="settings-system-mode"
        label="System mode"
        value={getString("systemMode")}
        onValueChange={(value) => updateSetting("systemMode", value)}
        options={[
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
          { value: "maintenance", label: "Maintenance" },
        ]}
      />
      <SettingToggle
        label="Maintenance banner"
        detail="Display a visible maintenance state to users."
        checked={getBoolean("maintenanceMode")}
        onCheckedChange={(checked) => updateSetting("maintenanceMode", checked)}
      />
    </Panel>
  </div>
);

export default AdminSystemSection;
