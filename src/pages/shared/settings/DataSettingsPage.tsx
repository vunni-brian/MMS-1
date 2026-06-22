/**
 * Data settings page for data management, including test data wipe capability.
 * Accessible to all roles.
 */
import { useContext, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { DataSection } from "@/components/settings";

/** DataSettingsPage - renders the data management section with wipe controls. */
const DataSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  const navigate = useNavigate();
  const [wipeState, setWipeState] = useState<"idle" | "confirm" | "submitting" | "done" | "error">("idle");

  const wipeTestData = useMutation({
    mutationFn: async () => {
      await api.wipeTestData();
    },
    onSuccess: () => setWipeState("done"),
    onError: () => setWipeState("error"),
  });

  if (!user || !hook) return null;

  return (
    <DataSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
      payments={hook.payments}
      auditEvents={hook.auditEvents}
      notifications={hook.notifications}
      navigate={navigate}
      roleHomePath={hook.roleHomePath}
      canReadAudit={hook.canReadAudit}
      wipeState={wipeState}
      setWipeState={setWipeState}
      wipeTestData={wipeTestData}
    />
  );
};
export default DataSettingsPage;
