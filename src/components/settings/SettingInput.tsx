/**
 * SettingInput - Reusable labelled text input used inside settings panels.
 * Renders a label, optional detail text, and a controlled Input component.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Props for the SettingInput component. */
interface SettingInputProps {
  id: string;
  label: string;
  detail?: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}

const SettingInput = ({ id, label, detail, value, type = "text", onChange }: SettingInputProps) => (
  <div className="settings-field-row">
    <div className="min-w-0">
      <Label htmlFor={id} className="settings-control-label">{label}</Label>
      {detail && <p className="settings-control-detail">{detail}</p>}
    </div>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="settings-control-input"
    />
  </div>
);

export default SettingInput;
export type { SettingInputProps };
