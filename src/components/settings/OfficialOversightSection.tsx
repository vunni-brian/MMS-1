import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingInput, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const OfficialOversightSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => (
  <div className="space-y-4">
    <Panel
      title="Compliance and Oversight"
      description="Thresholds and alerts for regional monitoring, inspections, and approval gates."
      actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      <SettingInput
        id="settings-sla-threshold"
        label="Complaint SLA threshold"
        detail="Hours before unresolved items become compliance risks."
        value={getString("slaThreshold")}
        onChange={(value) => updateSetting("slaThreshold", value)}
      />
      <SettingToggle
        label="Occupancy alerts"
        detail="Alert when market occupancy drops below expected levels."
        checked={getBoolean("occupancyAlerts")}
        onCheckedChange={(checked) => updateSetting("occupancyAlerts", checked)}
      />
      <SettingToggle
        label="Revenue variance alerts"
        detail="Alert when collections move outside expected thresholds."
        checked={getBoolean("revenueAlerts")}
        onCheckedChange={(checked) => updateSetting("revenueAlerts", checked)}
      />
      <SettingInput
        id="settings-approval-threshold"
        label="Approval threshold"
        detail="UGX value requiring official review."
        value={getString("approvalThreshold")}
        onChange={(value) => updateSetting("approvalThreshold", value)}
      />
    </Panel>
  </div>
);

export default OfficialOversightSection;
