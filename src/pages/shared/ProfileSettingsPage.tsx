import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CreditCard,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Mail,
  Phone,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { cn, formatHumanDate, formatHumanDateTime } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConsolePage, EmptyState, FileUploadCard, FormSection, LoadingState, PageHeader } from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";

type SettingsTab = "general" | "preferences" | "security" | "notifications" | "account" | "billing";

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "general", label: "General", icon: Info },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: UserCircle },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const isSettingsTab = (value: string | null): value is SettingsTab =>
  Boolean(value && settingsTabs.some((tab) => tab.id === value));

const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const productSections = ["Fresh Produce", "Textiles", "Cooked Food", "Electronics", "Household Goods", "Crafts", "Services", "Other"];

const formatLocalFileLabel = (file: File | null) => {
  if (!file) {
    return "No file selected";
  }
  return `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
};

const SettingToggle = ({
  label,
  detail,
  checked,
  onCheckedChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-background px-3 py-2.5">
    <div className="min-w-0">
      <p className="font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const ReadOnlyRows = ({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) => (
  <div className="divide-y divide-border/70 rounded-md border border-border/70 bg-background">
    {rows.map((row) => (
      <div key={row.label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr] sm:items-center">
        <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
        <div className="min-w-0 text-sm font-medium">{row.value}</div>
      </div>
    ))}
  </div>
);

const notificationPriorityStyles = {
  high: "border-destructive/20 bg-destructive/10 text-destructive",
  normal: "border-info/20 bg-info/10 text-info",
  low: "border-border bg-muted text-muted-foreground",
};

const notificationTypeLabels: Record<string, string> = {
  otp: "Security",
  payment: "Payment",
  booking: "Stall",
  complaint: "Complaint",
  system: "System",
};

const ProfileSettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    marketId: "",
    productSection: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem("mms.preferences");
      if (stored) return JSON.parse(stored) as { denseTables: boolean; showReceipts: boolean; rememberFilters: boolean };
    } catch { /* ignore */ }
    return { denseTables: true, showReceipts: true, rememberFilters: true };
  });

  const updatePreference = (key: keyof typeof preferences, value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      try { localStorage.setItem("mms.preferences", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [notificationSettings, setNotificationSettings] = useState({
    inApp: true,
    sms: true,
    payments: true,
    complaints: true,
    approvals: true,
  });

  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "general";
  const isVendor = user?.role === "vendor";

  const initials = useMemo(() => {
    if (!user?.name) {
      return "U";
    }

    return (
      user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [user?.name]);

  const { data: vendorData, isPending: isVendorPending, isError: isVendorError } = useQuery({
    queryKey: ["vendor-profile", user?.id],
    queryFn: () => api.getVendor(user!.id),
    enabled: Boolean(user?.id && isVendor),
  });

  const { data: marketsData, isPending: isMarketsPending, isError: isMarketsError } = useQuery({
    queryKey: ["markets", "profile-settings"],
    queryFn: () => api.getMarkets(),
    enabled: Boolean(isVendor),
  });

  const vendor = vendorData?.vendor || null;
  const markets = marketsData?.markets || [];

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      marketId: user.marketId || "",
      productSection: "",
    });
  }, [user]);

  useEffect(() => {
    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [avatarUrl]);

  useEffect(() => {
    if (!vendor) {
      return;
    }

    setProfileForm((current) => ({
      ...current,
      productSection: vendor.productSection || "",
    }));
  }, [vendor]);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;

    if (!user?.profileImage || profileImageFile || removeProfileImage) {
      if (!profileImageFile) {
        setAvatarUrl(null);
      }
      return;
    }

    api
      .getUserProfileImageUrl(user.id)
      .then((url) => {
        objectUrl = url;
        if (isActive) {
          setAvatarUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (isActive) {
          setAvatarUrl(null);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [profileImageFile, removeProfileImage, user?.id, user?.profileImage]);

  const selectedMarket = markets.find((market) => market.id === profileForm.marketId);
  const isPending = isVendor ? isVendorPending || isMarketsPending : false;
  const isError = isVendor ? isVendorError || isMarketsError : false;

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("User session not found.");
      }

      if (user.role === "vendor") {
        const vendorResponse = await api.updateVendorProfile(user.id, {
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
          marketId: profileForm.marketId,
          productSection: profileForm.productSection,
        });
        await api.updateMyProfile({
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
          profileImage: profileImageFile,
          removeProfileImage,
        });
        return vendorResponse;
      }

      return await api.updateMyProfile({
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        profileImage: profileImageFile,
        removeProfileImage,
      });
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["vendor-profile", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await refreshUser();
      setProfileImageFile(null);
      setRemoveProfileImage(false);
      setProfileMessage(response.message);
      setProfileError(null);
    },
    onError: (mutationError) => {
      setProfileMessage(null);
      setProfileError(mutationError instanceof ApiError ? mutationError.message : "Unable to update profile.");
    },
  });

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(passwordForm.currentPassword, passwordForm.newPassword),
    onSuccess: (response) => {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordMessage(response.message);
      setPasswordError(null);
    },
    onError: (mutationError) => {
      setPasswordMessage(null);
      setPasswordError(mutationError instanceof ApiError ? mutationError.message : "Unable to change password.");
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "profile-settings"],
    queryFn: () => api.getNotifications(),
    enabled: Boolean(user),
  });

  const markNotificationRead = useMutation({
    mutationFn: (notificationId: string) => api.markNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllNotificationsRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsQuery.data?.notifications || [];
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  if (!user) {
    return null;
  }

  const setActiveTab = (tab: SettingsTab) => {
    if (tab === "general") {
      setSearchParams({});
      return;
    }

    setSearchParams({ tab });
  };

  const canSaveProfile =
    Boolean(profileForm.name.trim() && profileForm.email.trim() && profileForm.phone.trim()) &&
    (!isVendor || Boolean(profileForm.marketId && profileForm.productSection));

  const handleAvatarUpload = (file: File | null | undefined) => {
    if (!file) {
      return;
    }

    setAvatarUrl(URL.createObjectURL(file));
    setProfileImageFile(file);
    setRemoveProfileImage(false);
  };

  const handleAvatarDelete = () => {
    setProfileImageFile(null);
    setRemoveProfileImage(true);
    setAvatarUrl(null);
  };

  const generalContent = (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold font-heading">General Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">Profile and organization record.</p>
      </div>
      <div className="border-t border-border/70" />

      <FormSection
        title="Profile Picture"
        description="Shown in the workspace header, profile screen, and manager vendor directory."
        className="shadow-none"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-border/70">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name} />}
              <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold font-heading">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{user.marketName || "System access"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleAvatarDelete}>
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
        <FileUploadCard
          id="settings-profile-image"
          label="Upload New Photo"
          description="JPEG, PNG, or WebP up to 5 MB."
          accept="image/*"
          value={profileImageFile ? formatLocalFileLabel(profileImageFile) : formatAttachmentLabel(user.profileImage)}
          onChange={handleAvatarUpload}
        />
      </FormSection>

      <FormSection title="Organization Information" description="Core account details used across the workspace." className="shadow-none">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">Full Name</Label>
            <Input
              id="settings-name"
              value={profileForm.name}
              onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="settings-email"
                type="email"
                className="pl-9"
                value={profileForm.email}
                onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="settings-phone"
                className="pl-9"
                value={profileForm.phone}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-role">Role</Label>
            <Input id="settings-role" value={roleLabel(user.role)} readOnly />
          </div>
          {isVendor && (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="settings-product-section">Product Section</Label>
              <Select
                value={profileForm.productSection}
                onValueChange={(value) => setProfileForm((current) => ({ ...current, productSection: value }))}
              >
                <SelectTrigger id="settings-product-section">
                  <SelectValue placeholder="Select product section" />
                </SelectTrigger>
                <SelectContent>
                  {productSections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Address" description="Market assignment and vendor identity references." className="shadow-none">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="settings-country">Country</Label>
            <Input id="settings-country" value="Uganda" readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-market">Market</Label>
            {isVendor ? (
              <Select value={profileForm.marketId} onValueChange={(value) => setProfileForm((current) => ({ ...current, marketId: value }))}>
                <SelectTrigger id="settings-market">
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((market) => (
                    <SelectItem key={market.id} value={market.id}>
                      {market.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="settings-market" value={user.marketName || "System-wide"} readOnly />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-district">District</Label>
            <Input id="settings-district" value={vendor?.district || selectedMarket?.location || user.marketName || "Not assigned"} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-nin">NIN / ID Number</Label>
            <Input id="settings-nin" value={vendor?.nationalIdNumber || "Not recorded"} readOnly />
          </div>
        </div>
      </FormSection>

      {profileMessage && <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{profileMessage}</div>}
      {profileError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{profileError}</div>}

      <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending || !canSaveProfile}>
        {updateProfile.isPending ? "Saving Changes..." : "Save Changes"}
      </Button>
    </div>
  );

  const preferencesContent = (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold font-heading">Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">Workspace behavior and display choices.</p>
      </div>
      <div className="border-t border-border/70" />
      <div className="grid gap-3">
        <SettingToggle
          label="Dense tables"
          detail="Show more market rows in each table view."
          checked={preferences.denseTables}
          onCheckedChange={(checked) => updatePreference("denseTables", checked)}
        />
        <SettingToggle
          label="Receipt-first payments"
          detail="Keep receipts visible in payment history."
          checked={preferences.showReceipts}
          onCheckedChange={(checked) => updatePreference("showReceipts", checked)}
        />
        <SettingToggle
          label="Remember filters"
          detail="Keep market filters between visits."
          checked={preferences.rememberFilters}
          onCheckedChange={(checked) => updatePreference("rememberFilters", checked)}
        />
      </div>
    </div>
  );

  const securityContent = (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold font-heading">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">Password and sign-in protection.</p>
      </div>
      <div className="border-t border-border/70" />
      <FormSection
        title="Password"
        description="Use a strong password and confirm the new value before saving."
        className="shadow-none"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showPasswords.current ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              />
              <button
                type="button"
                aria-label={showPasswords.current ? "Hide password" : "Show password"}
                onClick={() => setShowPasswords((s) => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none"
              >
                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPasswords.new ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              />
              <button
                type="button"
                aria-label={showPasswords.new ? "Hide password" : "Show password"}
                onClick={() => setShowPasswords((s) => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none"
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showPasswords.confirm ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
              <button
                type="button"
                aria-label={showPasswords.confirm ? "Hide password" : "Show password"}
                onClick={() => setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none"
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
        </div>

        {passwordMessage && <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{passwordMessage}</div>}
        {passwordError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{passwordError}</div>}

        <Button
          onClick={() => changePassword.mutate()}
          disabled={
            changePassword.isPending ||
            !passwordForm.currentPassword ||
            !passwordForm.newPassword ||
            passwordForm.newPassword.length < 8 ||
            passwordForm.newPassword !== passwordForm.confirmPassword
          }
        >
          <KeyRound className="mr-1 h-4 w-4" />
          {changePassword.isPending ? "Updating Password..." : "Update Password"}
        </Button>
      </FormSection>
    </div>
  );

  const notificationsContent = (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold font-heading">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Alerts, approvals, reminders, and delivery channels.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllNotificationsRead.mutate()}
          disabled={markAllNotificationsRead.isPending || unreadNotifications.length === 0}
          className="w-full sm:w-auto"
        >
          <CheckCheck className="mr-1 h-4 w-4" />
          Mark all read
        </Button>
      </div>
      <div className="border-t border-border/70" />
      <ReadOnlyRows
        rows={[
          { label: "Unread alerts", value: unreadNotifications.length },
          {
            label: "High priority",
            value: notifications.filter((notification) => notification.priority === "high" && !notification.read).length,
          },
          { label: "Latest update", value: formatHumanDateTime(notifications[0]?.createdAt) },
        ]}
      />
      <div className="rounded-lg border border-border/70 bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <p className="font-semibold font-heading">Notification Center</p>
            <p className="text-xs text-muted-foreground">Unread items stay prioritized until acknowledged.</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {notifications.length} total
          </span>
        </div>
        <div className="divide-y divide-border/70">
          {notificationsQuery.isPending ? (
            <div className="p-4">
              <LoadingState rows={4} itemClassName="h-16 rounded-lg" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No operational notifications"
                description="Security, payment, approval, and complaint updates will appear here when they require attention."
                icon={Bell}
              />
            </div>
          ) : (
            notifications.slice(0, 12).map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.read && markNotificationRead.mutate(notification.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                  notification.read ? "bg-background" : "bg-primary/5"
                }`}
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    notification.read ? "bg-muted-foreground/30" : "bg-primary"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{notificationTypeLabels[notification.type] || "Alert"}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${notificationPriorityStyles[notification.priority]}`}>
                      {notification.priority}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatHumanDateTime(notification.createdAt)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="grid gap-3">
        <SettingToggle
          label="In-app notifications"
          detail="Show updates inside the dashboard."
          checked={notificationSettings.inApp}
          onCheckedChange={(checked) => setNotificationSettings((current) => ({ ...current, inApp: checked }))}
        />
        <SettingToggle
          label="SMS notifications"
          detail="Send important updates to your phone."
          checked={notificationSettings.sms}
          onCheckedChange={(checked) => setNotificationSettings((current) => ({ ...current, sms: checked }))}
        />
        <SettingToggle
          label="Payment alerts"
          detail="Notify when receipts and payment statuses change."
          checked={notificationSettings.payments}
          onCheckedChange={(checked) => setNotificationSettings((current) => ({ ...current, payments: checked }))}
        />
        <SettingToggle
          label="Complaint updates"
          detail="Notify when complaint progress changes."
          checked={notificationSettings.complaints}
          onCheckedChange={(checked) => setNotificationSettings((current) => ({ ...current, complaints: checked }))}
        />
        <SettingToggle
          label="Approval alerts"
          detail="Notify when approval decisions are recorded."
          checked={notificationSettings.approvals}
          onCheckedChange={(checked) => setNotificationSettings((current) => ({ ...current, approvals: checked }))}
        />
      </div>
    </div>
  );

  const accountContent = (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold font-heading">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Identity, access, and submitted records.</p>
      </div>
      <div className="border-t border-border/70" />
      <ReadOnlyRows
        rows={[
          { label: "Account holder", value: user.name },
          { label: "Access role", value: roleLabel(user.role) },
          { label: "Market scope", value: user.marketName || "System-wide" },
          { label: "Phone verification", value: user.phoneVerifiedAt ? "Verified" : "Pending" },
          { label: "Created", value: formatHumanDate(user.createdAt) },
          { label: "Status", value: user.vendorStatus ? <StatusBadge status={user.vendorStatus} /> : "Active" },
        ]}
      />
      {isVendor && (
        <ReadOnlyRows
          rows={[
            { label: "National ID", value: formatAttachmentLabel(vendor?.idDocument || null) },
            { label: "LC Letter", value: formatAttachmentLabel(vendor?.lcLetter || null) },
          ]}
        />
      )}
    </div>
  );

  const billingContent = (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold font-heading">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Payments, receipts, and market charges.</p>
      </div>
      <div className="border-t border-border/70" />
      <ReadOnlyRows
        rows={[
          { label: "Payment channel", value: "Receipt upload" },
          { label: "Receipts", value: user.role === "vendor" || user.role === "manager" ? "Available in payments" : "Available in reports" },
        ]}
      />
      <Button
        variant="outline"
        onClick={() => navigate(user.role === "vendor" || user.role === "manager" ? `/${user.role}/payments` : `/${user.role}/billing`)}
      >
        <CreditCard className="mr-1 h-4 w-4" />
        Open Billing
      </Button>
    </div>
  );

  const tabContent: Record<SettingsTab, React.ReactNode> = {
    general: generalContent,
    preferences: preferencesContent,
    security: securityContent,
    notifications: notificationsContent,
    account: accountContent,
    billing: billingContent,
  };

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Account workspace"
        title="Profile Settings"
        description="Identity, security, notifications, and billing preferences."
        meta={
          user ? (
            <>
              <span className="rounded-full bg-muted px-2.5 py-1">{roleLabel(user.role)}</span>
              <span className="rounded-full bg-muted px-2.5 py-1">{user.marketName || "No market assigned"}</span>
            </>
          ) : undefined
        }
      />

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading profile</AlertTitle>
          <AlertDescription>We couldn't reach the server. Please check your connection.</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
          <LoadingState rows={6} itemClassName="h-16 rounded-xl" />
          <LoadingState rows={5} itemClassName="h-28 rounded-xl" />
        </div>
      ) : (
        <div className="profile-settings-shell">
          <aside className="profile-rail">
            <div className="profile-summary-card">
              <div className="flex items-start gap-3">
                <Avatar className="profile-summary-avatar">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name} />}
                  <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold font-heading">{user.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{roleLabel(user.role)}</p>
                  <span className="mt-2 inline-flex rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {user.marketName || "System access"}
                  </span>
                </div>
              </div>
              <div className="profile-signal-grid">
                <div className="profile-signal">
                  <p className="text-[11px] text-muted-foreground">Phone</p>
                  <p className="mt-0.5 text-sm font-semibold">{user.phoneVerifiedAt ? "Verified" : "Pending"}</p>
                </div>
                <div className="profile-signal">
                  <p className="text-[11px] text-muted-foreground">Unread alerts</p>
                  <p className="mt-0.5 text-sm font-semibold">{unreadNotifications.length}</p>
                </div>
                <div className="profile-signal">
                  <p className="text-[11px] text-muted-foreground">Created</p>
                  <p className="mt-0.5 text-sm font-semibold">{formatHumanDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
            <nav className="profile-tab-nav" aria-label="Profile settings sections">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn("profile-tab-button", activeTab === tab.id && "is-active")}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>
          <main className="profile-content-surface">{tabContent[activeTab]}</main>
        </div>
      )}
    </ConsolePage>
  );
};

export default ProfileSettingsPage;
