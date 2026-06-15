import { type Dispatch, type SetStateAction } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/console/ConsolePage";
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
}: SecuritySectionProps) => (
  <div className="space-y-4">
    <Panel
      title="Password"
      description="Use a strong password. Password changes are applied to your account immediately."
      actions={<KeyRound className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="settings-current-password">Current Password</Label>
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
              aria-label={showPasswords.current ? "Hide password" : "Show password"}
              onClick={() => setShowPasswords((current) => ({ ...current, current: !current.current }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-new-password">New Password</Label>
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
              aria-label={showPasswords.next ? "Hide password" : "Show password"}
              onClick={() => setShowPasswords((current) => ({ ...current, next: !current.next }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-confirm-password">Confirm Password</Label>
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
              aria-label={showPasswords.confirm ? "Hide password" : "Show password"}
              onClick={() => setShowPasswords((current) => ({ ...current, confirm: !current.confirm }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
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
        {isChangingPassword ? "Updating Password..." : "Update Password"}
      </Button>
    </Panel>

    <Panel
      title="Sign-in Protection"
      description="Controls for login verification, session alerts, and privileged access."
      actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      <SettingToggle
        label={user.role === "admin" ? "Require 2FA for privileged users" : "Two-factor authentication"}
        detail="Add a verification challenge for sensitive account access."
        checked={getBoolean(user.role === "admin" ? "privilegedMfa" : "twoFactorRequired")}
        onCheckedChange={(checked) => updateSetting(user.role === "admin" ? "privilegedMfa" : "twoFactorRequired", checked)}
      />
      <SettingSelect
        id="settings-mfa-method"
        label="Preferred verification method"
        detail={`Primary phone: ${user.phone}`}
        value={getString("mfaMethod")}
        onValueChange={(value) => updateSetting("mfaMethod", value)}
        options={[
          { value: "sms", label: "SMS verification" },
          { value: "email", label: "Email verification" },
          { value: "authenticator", label: "Authenticator app" },
        ]}
      />
      <SettingToggle
        label="Session alerts"
        detail="Notify when a new browser or device signs in."
        checked={getBoolean("sessionAlerts")}
        onCheckedChange={(checked) => updateSetting("sessionAlerts", checked)}
      />
    </Panel>

    <Panel title="Active Sessions" description="Session management for this workspace." actions={<LockKeyhole className="h-4 w-4 text-muted-foreground" />}>
      <div className="rounded-md border border-border/70 bg-muted/15 p-2.5">
        <p className="text-xs text-muted-foreground">Current session</p>
        <p className="mt-1 text-sm font-medium">This device — signed in now</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Session management is handled server-side. Sign out from this device to invalidate your current token.
      </p>
      <Button type="button" variant="outline" className="mt-3 text-destructive hover:text-destructive" onClick={async () => { await onLogout(); navigate("/login"); }}>
        Sign Out This Device
      </Button>
    </Panel>
  </div>
);

export default SecuritySection;
