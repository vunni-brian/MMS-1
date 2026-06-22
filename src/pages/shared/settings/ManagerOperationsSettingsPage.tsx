/**
 * Manager operations settings page for configuring market operations.
 * Manager role only.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ManagerOperationsSection } from "@/components/settings";

/** ManagerOperationsSettingsPage - renders the manager operations configuration section. */
const ManagerOperationsSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <ManagerOperationsSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default ManagerOperationsSettingsPage;
