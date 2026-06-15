import type { AuthUser } from "@/types";

type SettingValue = string | boolean;

interface SettingsContext {
  settings: Record<string, SettingValue>;
  updateSetting: (key: string, value: SettingValue) => void;
  getBoolean: (key: string) => boolean;
  getString: (key: string) => string;
  user: AuthUser;
}

export type { SettingValue, SettingsContext };
