import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserCircle,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { formatHumanDate } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";

type SettingsTab = "general" | "preferences" | "security" | "notifications" | "account" | "billing";

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "general", label: "General Information", icon: Info },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: UserCircle },
  { id: "billing", label: "Billings", icon: CreditCard },
];

const isSettingsTab = (value: string | null): value is SettingsTab =>
  Boolean(value && settingsTabs.some((tab) => tab.id === value));

const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const productSections = ["Fresh Produce", "Textiles", "Cooked Food", "Electronics", "Household Goods", "Crafts", "Services", "Other"];

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
  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background px-4 py-3">
    <div className="min-w-0">
      <p className="font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const ReadOnlyMetric = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-4 py-3">
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  </div>
);

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
  const [preferences, setPreferences] = useState({
    denseTables: true,
    showReceipts: true,
    rememberFilters: true,
  });
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
        <h1 className="text-2xl font-bold font-heading">General Information</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile and organization record.</p>
      </div>
      <div className="border-t border-border/70" />

      <section className="space-y-4">
        <p className="text-sm font-semibold font-heading">Profile picture upload</p>
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
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Upload New Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleAvatarUpload(event.target.files?.[0])}
              />
            </label>
            <Button type="button" variant="outline" onClick={handleAvatarDelete}>
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-sm font-semibold font-heading">Organization Information</p>
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
      </section>

      <section className="space-y-4">
        <p className="text-sm font-semibold font-heading">Address</p>
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
      </section>

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
        <h1 className="text-2xl font-bold font-heading">Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">Workspace behavior and display choices.</p>
      </div>
      <div className="border-t border-border/70" />
      <div className="grid gap-3">
        <SettingToggle
          label="Dense tables"
          detail="Show more market rows in each table view."
          checked={preferences.denseTables}
          onCheckedChange={(checked) => setPreferences((current) => ({ ...current, denseTables: checked }))}
        />
        <SettingToggle
          label="Receipt-first payments"
          detail="Keep receipts visible in payment history."
          checked={preferences.showReceipts}
          onCheckedChange={(checked) => setPreferences((current) => ({ ...current, showReceipts: checked }))}
        />
        <SettingToggle
          label="Remember filters"
          detail="Keep market filters between visits."
          checked={preferences.rememberFilters}
          onCheckedChange={(checked) => setPreferences((current) => ({ ...current, rememberFilters: checked }))}
        />
      </div>
    </div>
  );

  const securityContent = (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">Password and sign-in protection.</p>
      </div>
      <div className="border-t border-border/70" />
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            />
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
      </section>
    </div>
  );

  const notificationsContent = (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Market alerts and delivery channels.</p>
      </div>
      <div className="border-t border-border/70" />
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
        <h1 className="text-2xl font-bold font-heading">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Identity, access, and submitted records.</p>
      </div>
      <div className="border-t border-border/70" />
      <div className="grid gap-3 md:grid-cols-2">
        <ReadOnlyMetric icon={UserCircle} label="Account holder" value={user.name} />
        <ReadOnlyMetric icon={Shield} label="Access role" value={roleLabel(user.role)} />
        <ReadOnlyMetric icon={MapPin} label="Market scope" value={user.marketName || "System-wide"} />
        <ReadOnlyMetric icon={CheckCircle2} label="Phone verification" value={user.phoneVerifiedAt ? "Verified" : "Pending"} />
        <ReadOnlyMetric icon={Building2} label="Created" value={formatHumanDate(user.createdAt)} />
        <ReadOnlyMetric icon={Users} label="Status" value={user.vendorStatus ? <StatusBadge status={user.vendorStatus} /> : "Active"} />
      </div>
      {isVendor && (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyMetric icon={FileText} label="National ID" value={formatAttachmentLabel(vendor?.idDocument || null)} />
          <ReadOnlyMetric icon={FileText} label="LC Letter" value={formatAttachmentLabel(vendor?.lcLetter || null)} />
        </div>
      )}
    </div>
  );

  const billingContent = (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading">Billings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Payments, receipts, and market charges.</p>
      </div>
      <div className="border-t border-border/70" />
      <div className="grid gap-3 md:grid-cols-2">
        <ReadOnlyMetric icon={CreditCard} label="Payment channel" value="Pesapal checkout" />
        <ReadOnlyMetric icon={FileText} label="Receipts" value={user.role === "vendor" || user.role === "manager" ? "Available in payments" : "Available in reports"} />
      </div>
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
    <div className="mx-auto w-full max-w-6xl">
      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading profile</AlertTitle>
          <AlertDescription>We couldn't reach the server. Please check your connection.</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[560px] rounded-xl" />
        </div>
      ) : (
        <div className="grid min-h-[calc(100vh-150px)] gap-6 rounded-xl border border-border/70 bg-card p-4 shadow-sm lg:grid-cols-[240px_1fr] lg:p-6">
          <aside className="border-b border-border/70 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
            <nav className="grid gap-1">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>
          <main className="min-w-0">{tabContent[activeTab]}</main>
        </div>
      )}
    </div>
  );
};

export default ProfileSettingsPage;
