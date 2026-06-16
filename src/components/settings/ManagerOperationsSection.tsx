import { Building2 } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingInput, SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const ManagerOperationsSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => (
  <div className="space-y-4">
    <Panel
      title="Market Operations"
      description="Defaults for rent cycles, complaint routing, escalation behavior, report automation, and delegated work."
      actions={<Building2 className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      <SettingSelect
        id="settings-rent-cycle"
        label="Default rent cycle"
        value={getString("defaultRentCycle")}
        onValueChange={(value) => updateSetting("defaultRentCycle", value)}
        options={[
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
        ]}
      />
      <SettingSelect
        id="settings-complaint-routing"
        label="Complaint routing"
        value={getString("complaintRouting")}
        onValueChange={(value) => updateSetting("complaintRouting", value)}
        options={[
          { value: "market-manager", label: "Market manager first" },
          { value: "operations-team", label: "Operations team" },
          { value: "official-review", label: "Official review queue" },
        ]}
      />
      <SettingInput
        id="settings-escalation-hours"
        label="Escalation timing"
        detail="Hours before unresolved complaints escalate."
        value={getString("escalationHours")}
        onChange={(value) => updateSetting("escalationHours", value)}
      />
      <SettingToggle
        label="Automated weekly reports"
        detail="Prepare summary reports for market leadership."
        checked={getBoolean("reportAutomation")}
        onCheckedChange={(checked) => updateSetting("reportAutomation", checked)}
      />
      <SettingToggle
        label="Assistant delegation"
        detail="Allow assigned assistants to triage routine requests."
        checked={getBoolean("assistantDelegation")}
        onCheckedChange={(checked) => updateSetting("assistantDelegation", checked)}
      />
    </Panel>
  </div>
);

export default ManagerOperationsSection;
