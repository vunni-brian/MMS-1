import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SettingInput, SettingSelect, ReadOnlyRows } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const EmailSection = ({ getString, updateSetting }: SettingsContext) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:email.title")} description={t("settings:email.description")} actions={<Mail className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
        <SettingSelect
          id="settings-smtp-provider"
          label={t("settings:email.smtpProvider")}
          value={getString("smtpProvider")}
          onValueChange={(value) => updateSetting("smtpProvider", value)}
          options={[
            { value: "sendgrid", label: t("settings:email.sendGrid") },
            { value: "smtp", label: t("settings:email.customSmtp") },
            { value: "disabled", label: t("common:disabled") },
          ]}
        />
        <SettingInput id="settings-from-email" label={t("settings:email.fromEmail")} value={getString("fromEmail")} onChange={(value) => updateSetting("fromEmail", value)} />
        <SettingInput id="settings-from-name" label={t("settings:email.fromName")} value={getString("fromName")} onChange={(value) => updateSetting("fromName", value)} />
        <ReadOnlyRows
          rows={[
            { label: t("settings:email.welcomeEmail"), value: t("settings:email.templateAvailable") },
            { label: t("settings:email.paymentReceipt"), value: t("settings:email.templateAvailable") },
            { label: t("settings:email.complaintUpdate"), value: t("settings:email.templateAvailable") },
            { label: t("settings:email.passwordReset"), value: t("settings:email.templateAvailable") },
          ]}
        />
      </Panel>
    </div>
  );
};

export default EmailSection;
