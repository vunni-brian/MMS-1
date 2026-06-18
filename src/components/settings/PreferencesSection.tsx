import { useTranslation } from "react-i18next";
import { Globe2, SlidersHorizontal } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const PreferencesSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs text-info">
        {t("settings:preferences.browserNotice")}
      </div>
      <Panel
        title={t("settings:preferences.regional")}
        description={t("settings:preferences.regionalDesc")}
        actions={<Globe2 className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        <SettingSelect
          id="settings-language"
          label={t("settings:preferences.language")}
          value={getString("language")}
          onValueChange={(value) => updateSetting("language", value)}
          options={[
            { value: "English", label: t("settings:preferences.english") },
            { value: "Luganda", label: t("settings:preferences.luganda") },
            { value: "Swahili", label: t("settings:preferences.swahili") },
          ]}
        />
        <SettingSelect
          id="settings-time-zone"
          label={t("settings:preferences.timeZone")}
          value={getString("timeZone")}
          onValueChange={(value) => updateSetting("timeZone", value)}
          options={[
            { value: "Africa/Kampala", label: t("settings:preferences.africaKampala") },
            { value: "UTC", label: t("settings:preferences.utc") },
          ]}
        />
        <SettingSelect
          id="settings-date-format"
          label={t("settings:preferences.dateFormat")}
          value={getString("dateFormat")}
          onValueChange={(value) => updateSetting("dateFormat", value)}
          options={[
            { value: "DD/MM/YYYY", label: t("settings:preferences.ddMmYyyy") },
            { value: "YYYY-MM-DD", label: t("settings:preferences.yyyyMmDd") },
          ]}
        />
        <SettingSelect
          id="settings-currency"
          label={t("settings:preferences.currency")}
          value={getString("currency")}
          onValueChange={(value) => updateSetting("currency", value)}
          options={[
            { value: "UGX", label: t("settings:preferences.ugx") },
            { value: "USD", label: t("settings:preferences.usd") },
          ]}
        />
      </Panel>

      <Panel
        title={t("settings:preferences.dashboard")}
        description={t("settings:preferences.dashboardDesc")}
        actions={<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />}
        contentClassName="grid gap-3 md:grid-cols-2"
      >
        <SettingToggle
          label={t("settings:preferences.denseTables")}
          detail={t("settings:preferences.denseTablesDesc")}
          checked={getBoolean("denseTables")}
          onCheckedChange={(checked) => updateSetting("denseTables", checked)}
        />
        <SettingToggle
          label={t("settings:preferences.rememberFilters")}
          detail={t("settings:preferences.rememberFiltersDesc")}
          checked={getBoolean("rememberFilters")}
          onCheckedChange={(checked) => updateSetting("rememberFilters", checked)}
        />
        <SettingToggle
          label={t("settings:preferences.paymentReminderWidgets")}
          detail={t("settings:preferences.paymentReminderWidgetsDesc")}
          checked={getBoolean("paymentReminders")}
          onCheckedChange={(checked) => updateSetting("paymentReminders", checked)}
        />
        <SettingToggle
          label={t("settings:preferences.dashboardHints")}
          detail={t("settings:preferences.dashboardHintsDesc")}
          checked={getBoolean("dashboardHints")}
          onCheckedChange={(checked) => updateSetting("dashboardHints", checked)}
        />
      </Panel>
    </div>
  );
};

export default PreferencesSection;
