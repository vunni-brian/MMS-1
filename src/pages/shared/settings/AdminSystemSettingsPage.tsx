import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSystemSection } from "@/components/settings";

const AdminSystemSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <AdminSystemSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
    />
  );
};
export default AdminSystemSettingsPage;
