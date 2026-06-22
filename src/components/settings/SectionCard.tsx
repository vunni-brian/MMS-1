/**
 * SectionCard - Clickable card representing a settings section, used in the
 * settings navigation sidebar. Highlights when active.
 */
import { cn } from "@/lib/utils";
import type { SettingsSection } from "./types";

/** Props for the SectionCard component. */
interface SectionCardProps {
  section: SettingsSection;
  active: boolean;
  onSelect: () => void;
}

/**
 * SectionCard - Clickable settings-section card with icon, label, and summary.
 * Highlights when it matches the currently active section.
 */
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
