import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const FeatureManagementSection = ({ updateSetting, getBoolean }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:featureManagement.title")} description={t("settings:featureManagement.description")} actions={<Flag className="h-4 w-4 text-muted-foreground" />} contentClassName="grid gap-3 md:grid-cols-2">
        <SettingToggle label={t("settings:featureManagement.complaints")} detail={t("settings:featureManagement.complaintsDesc")} checked={getBoolean("featureComplaints")} onCheckedChange={(checked) => updateSetting("featureComplaints", checked)} />
        <SettingToggle label={t("settings:featureManagement.payments")} detail={t("settings:featureManagement.paymentsDesc")} checked={getBoolean("featurePayments")} onCheckedChange={(checked) => updateSetting("featurePayments", checked)} />
        <SettingToggle label={t("settings:featureManagement.stallAllocation")} detail={t("settings:featureManagement.stallAllocationDesc")} checked={getBoolean("featureStallAllocation")} onCheckedChange={(checked) => updateSetting("featureStallAllocation", checked)} />
        <SettingToggle label={t("settings:featureManagement.inspections")} detail={t("settings:featureManagement.inspectionsDesc")} checked={getBoolean("featureInspections")} onCheckedChange={(checked) => updateSetting("featureInspections", checked)} />
        <SettingToggle label={t("settings:featureManagement.reports")} detail={t("settings:featureManagement.reportsDesc")} checked={getBoolean("featureReports")} onCheckedChange={(checked) => updateSetting("featureReports", checked)} />
        <SettingToggle label={t("settings:featureManagement.assetTracking")} detail={t("settings:featureManagement.assetTrackingDesc")} checked={getBoolean("featureAssetTracking")} onCheckedChange={(checked) => updateSetting("featureAssetTracking", checked)} />
        <SettingToggle label={t("settings:featureManagement.gisMapping")} detail={t("settings:featureManagement.gisMappingDesc")} checked={getBoolean("featureGisMapping")} onCheckedChange={(checked) => updateSetting("featureGisMapping", checked)} />
      </Panel>
    </div>
  );
};

export default FeatureManagementSection;
