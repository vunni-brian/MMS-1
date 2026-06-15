import { cn } from "@/lib/utils";
import type { SettingsSection } from "./types";

interface SectionCardProps {
  section: SettingsSection;
  active: boolean;
  onSelect: () => void;
}

const SectionCard = ({ section, active, onSelect }: SectionCardProps) => {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("settings-section-card", active && "is-active")}
      aria-current={active ? "true" : undefined}
    >
      <span className="settings-section-icon">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{section.label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{section.summary}</span>
      </span>
    </button>
  );
};

export default SectionCard;
export type { SectionCardProps };
