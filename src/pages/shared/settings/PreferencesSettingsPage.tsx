/**
 * User preferences settings page for personalization options.
 * Accessible to all roles.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { PreferencesSection } from "@/components/settings";

/** PreferencesSettingsPage - renders the user preferences section. */
const PreferencesSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <PreferencesSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default PreferencesSettingsPage;
