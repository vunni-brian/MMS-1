import { Globe2, SlidersHorizontal } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const PreferencesSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => (
  <div className="space-y-4">
    <div className="rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs text-info">
      These preferences are saved in your browser. They control display behaviour on this device and do not affect server configuration or other users.
    </div>
    <Panel
      title="Regional Preferences"
      description="Display choices used across dashboards, reports, and exports."
      actions={<Globe2 className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      <SettingSelect
        id="settings-language"
        label="Language"
        value={getString("language")}
        onValueChange={(value) => updateSetting("language", value)}
        options={[
          { value: "English", label: "English" },
          { value: "Luganda", label: "Luganda" },
          { value: "Swahili", label: "Swahili" },
        ]}
      />
      <SettingSelect
        id="settings-time-zone"
        label="Time zone"
        value={getString("timeZone")}
        onValueChange={(value) => updateSetting("timeZone", value)}
        options={[
          { value: "Africa/Kampala", label: "Africa/Kampala" },
          { value: "UTC", label: "UTC" },
        ]}
      />
      <SettingSelect
        id="settings-date-format"
        label="Date format"
        value={getString("dateFormat")}
        onValueChange={(value) => updateSetting("dateFormat", value)}
        options={[
          { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
          { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
        ]}
      />
      <SettingSelect
        id="settings-currency"
        label="Currency"
        value={getString("currency")}
        onValueChange={(value) => updateSetting("currency", value)}
        options={[
          { value: "UGX", label: "UGX - Uganda Shillings" },
          { value: "USD", label: "USD - US Dollars" },
        ]}
      />
    </Panel>

    <Panel
      title="Dashboard Preferences"
      description="Control density and behavior for repeated operational work."
      actions={<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />}
      contentClassName="grid gap-3 md:grid-cols-2"
    >
      <SettingToggle
        label="Dense tables"
        detail="Show more rows in market tables."
        checked={getBoolean("denseTables")}
        onCheckedChange={(checked) => updateSetting("denseTables", checked)}
      />
      <SettingToggle
        label="Remember filters"
        detail="Keep table filters between visits."
        checked={getBoolean("rememberFilters")}
        onCheckedChange={(checked) => updateSetting("rememberFilters", checked)}
      />
      <SettingToggle
        label="Payment reminder widgets"
        detail="Show due-date reminders on dashboards."
        checked={getBoolean("paymentReminders")}
        onCheckedChange={(checked) => updateSetting("paymentReminders", checked)}
      />
      <SettingToggle
        label="Dashboard hints"
        detail="Show additional helper notes in empty states."
        checked={getBoolean("dashboardHints")}
        onCheckedChange={(checked) => updateSetting("dashboardHints", checked)}
      />
    </Panel>
  </div>
);

export default PreferencesSection;
