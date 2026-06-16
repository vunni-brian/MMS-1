import { useContext, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { AccountSection } from "@/components/settings";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";

const AccountSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  const navigate = useNavigate();
  const [deactivationState, setDeactivationState] = useState<"idle" | "confirm" | "submitting" | "done" | "error">("idle");

  const requestDeactivation = useMutation({
    mutationFn: () => api.createTicket({
      category: "other",
      priority: "high",
      subject: "Account Deactivation Request",
      description: `Vendor ${user?.name} (ID: ${user?.id}) has requested deactivation of their account. Please review and process stall release.`,
    }),
    onSuccess: () => setDeactivationState("done"),
    onError: () => setDeactivationState("error"),
  });

  if (!user || !hook) {
    return null;
  }

  return (
    <AccountSection
      user={user}
      navigate={navigate}
      roleHomePath={hook.roleHomePath}
      setActiveSection={navigate}
      deactivationState={deactivationState}
      setDeactivationState={setDeactivationState}
      onRequestDeactivation={() => requestDeactivation.mutate()}
    />
  );
};

export default AccountSettingsPage;
