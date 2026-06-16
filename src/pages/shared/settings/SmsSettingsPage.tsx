import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { SmsSection } from "@/components/settings";

const SmsSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <SmsSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default SmsSettingsPage;
