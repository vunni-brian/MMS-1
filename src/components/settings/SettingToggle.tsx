import { Switch } from "@/components/ui/switch";

interface SettingToggleProps {
  label: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const SettingToggle = ({ label, detail, checked, onCheckedChange }: SettingToggleProps) => (
  <div className="settings-control-row">
    <div className="min-w-0">
      <p className="settings-control-label">{label}</p>
      <p className="settings-control-detail">{detail}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

export default SettingToggle;
export type { SettingToggleProps };
