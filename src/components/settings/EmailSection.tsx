import { Mail } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { SettingInput, SettingSelect, ReadOnlyRows } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const EmailSection = ({ getString, updateSetting }: SettingsContext) => (
  <div className="space-y-4">
    <Panel title="Email Configuration" description="SMTP provider and template controls." actions={<Mail className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
      <SettingSelect
        id="settings-smtp-provider"
        label="SMTP provider"
        value={getString("smtpProvider")}
        onValueChange={(value) => updateSetting("smtpProvider", value)}
        options={[
          { value: "sendgrid", label: "SendGrid" },
          { value: "smtp", label: "Custom SMTP" },
          { value: "disabled", label: "Disabled" },
        ]}
      />
      <SettingInput id="settings-from-email" label="From email" value={getString("fromEmail")} onChange={(value) => updateSetting("fromEmail", value)} />
      <SettingInput id="settings-from-name" label="From name" value={getString("fromName")} onChange={(value) => updateSetting("fromName", value)} />
      <ReadOnlyRows
        rows={[
          { label: "Welcome email", value: "Template available" },
          { label: "Payment receipt", value: "Template available" },
          { label: "Complaint update", value: "Template available" },
          { label: "Password reset", value: "Template available" },
        ]}
      />
    </Panel>
  </div>
);

export default EmailSection;
