import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { EvidenceField } from "@/components/console/ConsolePage";
import { SettingInput, SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const SmsSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:sms.title")} description={t("settings:sms.description")} actions={<Smartphone className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
        <SettingSelect
          id="settings-sms-provider"
          label={t("settings:sms.smsProvider")}
          value={getString("smsProvider")}
          onValueChange={(value) => updateSetting("smsProvider", value)}
          options={[
            { value: "africas-talking", label: t("settings:sms.africasTalking") },
            { value: "twilio", label: t("settings:sms.twilio") },
            { value: "disabled", label: t("common:disabled") },
          ]}
        />
        <SettingInput id="settings-sender-id" label={t("settings:sms.senderId")} value={getString("senderId")} onChange={(value) => updateSetting("senderId", value)} />
        <SettingToggle label={t("settings:sms.paymentConfirmationSms")} detail={t("settings:sms.paymentConfirmationSmsDesc")} checked={getBoolean("notifyReceipts")} onCheckedChange={(checked) => updateSetting("notifyReceipts", checked)} />
        <SettingToggle label={t("settings:sms.criticalMarketAlerts")} detail={t("settings:sms.criticalMarketAlertsDesc")} checked={getBoolean("smsNotifications")} onCheckedChange={(checked) => updateSetting("smsNotifications", checked)} />
        <EvidenceField label={t("settings:sms.smsSentThisMonth")} value="2,450 / 10,000" />
      </Panel>
    </div>
  );
};

export default SmsSection;
