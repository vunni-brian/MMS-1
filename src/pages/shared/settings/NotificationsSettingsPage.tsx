import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationsSection } from "@/components/settings";

const NotificationsSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  if (!user || !hook) return null;
  return (
    <NotificationsSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
      notificationsQuery={hook.notificationsQuery}
      notifications={hook.notifications}
      canReadNotifications={hook.canReadNotifications}
    />
  );
};
export default NotificationsSettingsPage;
