import { useContext, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { SecuritySection } from "@/components/settings";

const SecuritySettingsPage = () => {
  const { user, logout } = useAuth();
  const hook = useContext(SettingsDataContext);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(passwordForm.currentPassword, passwordForm.newPassword),
    onSuccess: async (response) => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordMessage(response.message);
      setPasswordError(null);
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (mutationError) => {
      setPasswordMessage(null);
      setPasswordError(mutationError instanceof ApiError ? mutationError.message : "Unable to change password.");
    },
  });

  if (!user || !hook) return null;

  return (
    <SecuritySection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
      passwordForm={passwordForm}
      setPasswordForm={setPasswordForm}
      showPasswords={showPasswords}
      setShowPasswords={setShowPasswords}
      passwordMessage={passwordMessage}
      passwordError={passwordError}
      onChangePassword={() => changePassword.mutate()}
      isChangingPassword={changePassword.isPending}
      onLogout={async () => { await logout(); navigate("/login"); }}
      navigate={navigate}
    />
  );
};
export default SecuritySettingsPage;
