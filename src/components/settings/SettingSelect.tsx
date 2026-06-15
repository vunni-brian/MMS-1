import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SettingSelectProps {
  id: string;
  label: string;
  detail?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}

const SettingSelect = ({ id, label, detail, value, options, onValueChange }: SettingSelectProps) => (
  <div className="settings-field-row">
    <div className="min-w-0">
      <Label htmlFor={id} className="settings-control-label">{label}</Label>
      {detail && <p className="settings-control-detail">{detail}</p>}
    </div>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="settings-control-input">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default SettingSelect;
export type { SettingSelectProps };
