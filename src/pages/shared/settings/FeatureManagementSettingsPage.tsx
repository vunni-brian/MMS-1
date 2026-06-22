/**
 * Feature management settings page for toggling system feature flags.
 * Admin role only.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { FeatureManagementSection } from "@/components/settings";

/** FeatureManagementSettingsPage - renders the feature flag management section. */
const FeatureManagementSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <FeatureManagementSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default FeatureManagementSettingsPage;
