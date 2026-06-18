import { useTranslation } from "react-i18next";
import { type Dispatch, type SetStateAction } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/Panel";
import { SettingSelect, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ShowPasswords {
  current: boolean;
  next: boolean;
  confirm: boolean;
}

interface SecuritySectionProps extends SettingsContext {
  passwordForm: PasswordForm;
  setPasswordForm: Dispatch<SetStateAction<PasswordForm>>;
  showPasswords: ShowPasswords;
  setShowPasswords: Dispatch<SetStateAction<ShowPasswords>>;
  passwordMessage: string | null;
  passwordError: string | null;
  onChangePassword: () => void;
  isChangingPassword: boolean;
  onLogout: () => Promise<void> | void;
  navigate: (path: string) => void;
}

const SecuritySection = ({
  user,
  getBoolean,
  getString,
  updateSetting,
  passwordForm,
  setPasswordForm,
  showPasswords,
  setShowPasswords,
  passwordMessage,
  passwordError,
  onChangePassword,
  isChangingPassword,
  onLogout,
  navigate,
}: SecuritySectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={t("settings:security.password")}
        description={t("settings:security.passwordDesc")}
        actions={<KeyRound className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="settings-current-password">{t("settings:security.currentPassword")}</Label>
            <div className="relative">
              <Input
                id="settings-current-password"
                type={showPasswords.current ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              />
              <button
                type="button"
                aria-label={showPasswords.current ? t("settings:security.hidePassword") : t("settings:security.showPassword")}
                onClick={() => setShowPasswords((current) => ({ ...current, current: !current.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-new-password">{t("settings:security.newPassword")}</Label>
            <div className="relative">
              <Input
                id="settings-new-password"
                type={showPasswords.next ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              />
              <button
                type="button"
                aria-label={showPasswords.next ? t("settings:security.hidePassword") : t("settings:security.showPassword")}
                onClick={() => setShowPasswords((current) => ({ ...current, next: !current.next }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-confirm-password">{t("settings:security.confirmPassword")}</Label>
            <div className="relative">
              <Input
                id="settings-confirm-password"
                type={showPasswords.confirm ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
              <button
                type="button"
                aria-label={showPasswords.confirm ? t("settings:security.hidePassword") : t("settings:security.showPassword")}
                onClick={() => setShowPasswords((current) => ({ ...current, confirm: !current.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-destructive">{t("settings:security.passwordsDoNotMatch")}</p>
            )}
          </div>
        </div>

        {passwordMessage && <div className="mt-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{passwordMessage}</div>}
        {passwordError && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{passwordError}</div>}

        <Button
          type="button"
          className="mt-3"
          onClick={onChangePassword}
          disabled={
            isChangingPassword ||
            !passwordForm.currentPassword ||
            !passwordForm.newPassword ||
            passwordForm.newPassword.length < 8 ||
            passwordForm.newPassword !== passwordForm.confirmPassword
          }
        >
          <KeyRound className="h-4 w-4" />
          {isChangingPassword ? t("settings:security.updatingPassword") : t("settings:security.updatePassword")}
        </Button>
      </Panel>

      <Panel
        title={t("settings:security.signInProtection")}
        description={t("settings:security.signInProtectionDesc")}
        actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        <SettingToggle
          label={user.role === "admin" ? t("settings:security.require2fa") : t("settings:security.twoFactorAuth")}
          detail={t("settings:security.twoFactorDesc")}
          checked={getBoolean(user.role === "admin" ? "privilegedMfa" : "twoFactorRequired")}
          onCheckedChange={(checked) => updateSetting(user.role === "admin" ? "privilegedMfa" : "twoFactorRequired", checked)}
        />
        <SettingSelect
          id="settings-mfa-method"
          label={t("settings:security.preferredVerification")}
          detail={`${t("settings:security.primaryPhone")} ${user.phone}`}
          value={getString("mfaMethod")}
          onValueChange={(value) => updateSetting("mfaMethod", value)}
          options={[
            { value: "sms", label: t("settings:security.smsVerification") },
            { value: "email", label: t("settings:security.emailVerification") },
            { value: "authenticator", label: t("settings:security.authenticatorApp") },
          ]}
        />
        <SettingToggle
          label={t("settings:security.sessionAlerts")}
          detail={t("settings:security.sessionAlertsDesc")}
          checked={getBoolean("sessionAlerts")}
          onCheckedChange={(checked) => updateSetting("sessionAlerts", checked)}
        />
      </Panel>

      <Panel title={t("settings:security.activeSessions")} description={t("settings:security.activeSessionsDesc")} actions={<LockKeyhole className="h-4 w-4 text-muted-foreground" />}>
        <div className="rounded-md border border-border/70 bg-muted/15 p-2.5">
          <p className="text-xs text-muted-foreground">{t("settings:security.currentSession")}</p>
          <p className="mt-1 text-sm font-medium">{t("settings:security.thisDevice")}</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("settings:security.sessionManagementDesc")}
        </p>
        <Button type="button" variant="outline" className="mt-3 text-destructive hover:text-destructive" onClick={async () => { await onLogout(); navigate("/login"); }}>
          {t("settings:security.signOutThisDevice")}
        </Button>
      </Panel>
    </div>
  );
};

export default SecuritySection;
