import type { ElementType, ReactNode } from "react";

interface SettingsSection {
  id: string;
  label: string;
  summary: string;
  icon: ElementType;
  keywords: string[];
  count?: number;
  content: ReactNode;
}

export type { SettingsSection };
