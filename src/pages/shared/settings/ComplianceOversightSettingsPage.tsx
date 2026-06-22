/**
 * Compliance and oversight settings page for official role configuration.
 * Official role only.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { OfficialOversightSection } from "@/components/settings";

/** ComplianceOversightSettingsPage - renders the official oversight settings section. */
const ComplianceOversightSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <OfficialOversightSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default ComplianceOversightSettingsPage;
