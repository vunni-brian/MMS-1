/**
 * Logging settings page for configuring system logging levels and retention.
 * Admin role only.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { LoggingSection } from "@/components/settings";

/** LoggingSettingsPage - renders the logging configuration section. */
const LoggingSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <LoggingSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default LoggingSettingsPage;
