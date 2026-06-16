import { Smartphone } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { EvidenceField } from "@/components/console/ConsolePage";
import { SettingInput, SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

const SmsSection = ({ getString, updateSetting, getBoolean }: SettingsContext) => (
  <div className="space-y-4">
    <Panel title="SMS Configuration" description="SMS provider, sender ID, triggers, and usage controls." actions={<Smartphone className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
      <SettingSelect
        id="settings-sms-provider"
        label="SMS provider"
        value={getString("smsProvider")}
        onValueChange={(value) => updateSetting("smsProvider", value)}
        options={[
          { value: "africas-talking", label: "Africa's Talking" },
          { value: "twilio", label: "Twilio" },
          { value: "disabled", label: "Disabled" },
        ]}
      />
      <SettingInput id="settings-sender-id" label="Sender ID" value={getString("senderId")} onChange={(value) => updateSetting("senderId", value)} />
      <SettingToggle label="Payment confirmation SMS" detail="Send SMS after payment confirmation." checked={getBoolean("notifyReceipts")} onCheckedChange={(checked) => updateSetting("notifyReceipts", checked)} />
      <SettingToggle label="Critical market alerts" detail="Send high-priority market notices by SMS." checked={getBoolean("smsNotifications")} onCheckedChange={(checked) => updateSetting("smsNotifications", checked)} />
      <EvidenceField label="SMS sent this month" value="2,450 / 10,000" />
    </Panel>
  </div>
);

export default SmsSection;
