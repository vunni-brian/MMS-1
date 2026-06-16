import { Flag } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const FeatureManagementSection = ({ updateSetting, getBoolean }: SettingsContext) => (
  <div className="space-y-4">
    <Panel title="Feature Management" description="Enable modules during phased municipal rollout." actions={<Flag className="h-4 w-4 text-muted-foreground" />} contentClassName="grid gap-3 md:grid-cols-2">
      <SettingToggle label="Complaints" detail="Vendor complaint intake and resolution." checked={getBoolean("featureComplaints")} onCheckedChange={(checked) => updateSetting("featureComplaints", checked)} />
      <SettingToggle label="Payments" detail="Gateway and receipt payment workflows." checked={getBoolean("featurePayments")} onCheckedChange={(checked) => updateSetting("featurePayments", checked)} />
      <SettingToggle label="Stall Allocation" detail="Stall inventory, booking, and allocation." checked={getBoolean("featureStallAllocation")} onCheckedChange={(checked) => updateSetting("featureStallAllocation", checked)} />
      <SettingToggle label="Inspections" detail="Compliance inspection workflows." checked={getBoolean("featureInspections")} onCheckedChange={(checked) => updateSetting("featureInspections", checked)} />
      <SettingToggle label="Reports" detail="Exports and analytics workspaces." checked={getBoolean("featureReports")} onCheckedChange={(checked) => updateSetting("featureReports", checked)} />
      <SettingToggle label="Asset Tracking" detail="Future fixed asset register." checked={getBoolean("featureAssetTracking")} onCheckedChange={(checked) => updateSetting("featureAssetTracking", checked)} />
      <SettingToggle label="GIS Mapping" detail="Future map-based market planning." checked={getBoolean("featureGisMapping")} onCheckedChange={(checked) => updateSetting("featureGisMapping", checked)} />
    </Panel>
  </div>
);

export default FeatureManagementSection;
