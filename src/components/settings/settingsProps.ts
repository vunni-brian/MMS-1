/**
 * settingsProps - Core types for the settings system: the union type for
 * setting values and the context interface passed to all section components.
 */
import type { AuthUser } from "@/types";

type SettingValue = string | boolean;

/** Context injected into every settings section for reading/updating settings. */
interface SettingsContext {
  settings: Record<string, SettingValue>;
  updateSetting: (key: string, value: SettingValue) => void;
  getBoolean: (key: string) => boolean;
  getString: (key: string) => string;
  user: AuthUser;
}

export type { SettingValue, SettingsContext };
