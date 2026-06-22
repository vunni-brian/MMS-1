/**
 * types - Shared types for the settings feature: the Section descriptor
 * used to build the settings navigation sidebar.
 */
import type { ElementType, ReactNode } from "react";

/** Describes a single settings section for navigation and content rendering. */
interface SettingsSection {
  id: string;
  label: string;
  summary: string;
  icon: ElementType;
  keywords: string[];
  count?: number;
  content?: ReactNode;
}

export type { SettingsSection };
