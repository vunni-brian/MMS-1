import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, FileClock, Mail, Phone, Settings, Trash2, UserCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { cn, formatHumanDate } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
 ConsolePage,
 EvidenceField,
 FileUploadCard,
 FormSection,
 LoadingState,
 PageHeader,
} from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";

const productSections = [
 "Fresh Produce",
 "Textiles",
 "Cooked Food",
 "Electronics",
 "Household Goods",
 "Crafts",
 "Services",
 "Other",
];

const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const formatLocalFileLabel = (file: File | null) => {
 if (!file) {
 return "No file selected";
 }
 return `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
};

const ProfileSettingsPage = () => {
 const { user, refreshUser } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
 const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
 const [removeProfileImage, setRemoveProfileImage] = useState(false);
 const [profileMessage, setProfileMessage] = useState<string | null>(null);
 const [profileError, setProfileError] = useState<string | null>(null);
 const [profileForm, setProfileForm] = useState({
 name: "",
 email: "",
 phone: "",
 marketId: "",
 productSection: "",
 });

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

 const vendorQuery = useQuery({
 queryKey: ["vendor-profile", user?.id],
 queryFn: () => api.getVendor(user!.id),
 enabled: Boolean(user?.id && isVendor),
 });

 const marketsQuery = useQuery({
 queryKey: ["markets", "profile"],
 queryFn: () => api.getMarkets(),
 enabled: Boolean(isVendor),
 });

 const vendor = vendorQuery.data?.vendor || null;
 const markets = marketsQuery.data?.markets || [];

 useEffect(() => {
 if (!user) {
 return;
 }

 setProfileForm({
 name: user.name,
 email: user.email,
 phone: user.phone,
 marketId: user.marketId || "",
 productSection: user.productSection || "",
 });
 }, [user]);

 useEffect(() => {
 if (!vendor) {
 return;
 }

 setProfileForm((current) => ({
 ...current,
 productSection: vendor.productSection || current.productSection,
 marketId: vendor.marketId || current.marketId,
 }));
 }, [vendor]);

 useEffect(() => {
 return () => {
 if (avatarUrl) {
 URL.revokeObjectURL(avatarUrl);
 }
 };
 }, [avatarUrl]);

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

 if (!user) {
 return null;
 }

 const isPending = isVendor ? vendorQuery.isPending || marketsQuery.isPending : false;
 const isError = isVendor ? vendorQuery.isError || marketsQuery.isError : false;
 const selectedMarket = markets.find((market) => market.id === profileForm.marketId);
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

 return (
 <ConsolePage>
 <PageHeader
 eyebrow="Official Identity"
 title="Official Credential"
 description="Personal identity, contact information, profile photo, and market-facing details."
 actions={
 <Button type="button" variant="outline" onClick={() => navigate(`/${user.role}/settings`)}>
 <Settings className="h-4 w-4" />
 Open Settings
 </Button>
 }
 meta={
 <>
 <span className="rounded-full bg-muted px-2.5 py-1">{roleLabel(user.role)}</span>
 <span className="rounded-full bg-muted px-2.5 py-1">{user.marketName || "No market assigned"}</span>
 </>
 }
 />

 {isError ? (
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>Error loading profile</AlertTitle>
 <AlertDescription>We could not reach the profile records. Please check your connection.</AlertDescription>
 </Alert>
 ) : isPending ? (
 <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
 <LoadingState rows={4} itemClassName="h-16 rounded-lg" />
 <LoadingState rows={4} itemClassName="h-28 rounded-lg" />
 </div>
 ) : (
 <div className="profile-settings-shell profile-only-shell">
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
 <p className="text-[11px] text-muted-foreground">Created</p>
 <p className="mt-0.5 text-sm font-semibold">{formatHumanDate(user.createdAt)}</p>
 </div>
 <div className="profile-signal">
 <p className="text-[11px] text-muted-foreground">Status</p>
 <div className="mt-0.5 text-sm font-semibold">
 {user.vendorStatus ? <StatusBadge status={user.vendorStatus} /> : "Active"}
 </div>
 </div>
 </div>
 </div>
 </aside>

 <main className="profile-content-surface">
 <div className="space-y-5">
 <div className="profile-section-heading">
 <div>
 <h2>Profile Information</h2>
 <p>Settings such as password, notifications, billing, preferences, and activity are managed on the dedicated Settings page.</p>
 </div>
 </div>

 <FormSection title="Profile Photo" description="Shown in the workspace header, profile screen, and staff review areas." className="shadow-none">
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
 <Button type="button" variant="outline" onClick={handleAvatarDelete}>
 <Trash2 className="h-4 w-4" />
 Delete
 </Button>
 </div>
 <FileUploadCard
 id="profile-image"
 label="Upload New Photo"
 description="JPEG, PNG, or WebP up to 5 MB."
 accept="image/*"
 value={profileImageFile ? formatLocalFileLabel(profileImageFile) : formatAttachmentLabel(user.profileImage)}
 onChange={handleAvatarUpload}
 />
 </FormSection>

 <FormSection title="Contact Information" description="Core profile details used for authentication, notices, and staff follow-up." className="shadow-none">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-1.5">
 <Label htmlFor="profile-name">Full Name</Label>
 <Input
 id="profile-name"
 value={profileForm.name}
 onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="profile-email">Email Address</Label>
 <div className="relative">
 <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 id="profile-email"
 type="email"
 className="pl-9"
 value={profileForm.email}
 onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="profile-phone">Phone Number</Label>
 <div className="relative">
 <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 id="profile-phone"
 className="pl-9"
 value={profileForm.phone}
 onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="profile-role">Role</Label>
 <Input id="profile-role" value={roleLabel(user.role)} readOnly />
 </div>
 </div>
 </FormSection>

 <FormSection title={isVendor ? "Vendor Details" : "Workspace Scope"} description="Market assignment and organization-facing profile context." className="shadow-none">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-1.5">
 <Label htmlFor="profile-market">Market</Label>
 {isVendor ? (
 <Select value={profileForm.marketId} onValueChange={(value) => setProfileForm((current) => ({ ...current, marketId: value }))}>
 <SelectTrigger id="profile-market">
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
 <Input id="profile-market" value={user.marketName || "System-wide"} readOnly />
 )}
 </div>
 {isVendor ? (
 <div className="space-y-1.5">
 <Label htmlFor="profile-product-section">Product Section</Label>
 <Select
 value={profileForm.productSection}
 onValueChange={(value) => setProfileForm((current) => ({ ...current, productSection: value }))}
 >
 <SelectTrigger id="profile-product-section">
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
 ) : (
 <div className="space-y-1.5">
 <Label htmlFor="profile-scope">Access Scope</Label>
 <Input id="profile-scope" value={user.marketName || "Platform-wide"} readOnly />
 </div>
 )}
 <div className="space-y-1.5">
 <Label htmlFor="profile-district">District</Label>
 <Input id="profile-district" value={vendor?.district || selectedMarket?.location || user.marketName || "Not assigned"} readOnly />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="profile-nin">NIN / ID Number</Label>
 <Input id="profile-nin" value={vendor?.nationalIdNumber || "Not recorded"} readOnly />
 </div>
 </div>
 </FormSection>

 {isVendor && (
 <FormSection title="Verification Records" description="Documents submitted with the vendor profile." className="shadow-none">
 <div className="grid gap-3 md:grid-cols-2">
 <EvidenceField label="National ID" value={formatAttachmentLabel(vendor?.idDocument || null)} />
 <EvidenceField label="LC Letter" value={formatAttachmentLabel(vendor?.lcLetter || null)} />
 </div>
 </FormSection>
 )}

 {isVendor && (
 <FormSection title="Verification Status" description="Checklist of identity and contact verification used for vendor approval." className="shadow-none">
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
 {[
 { label: "National ID", done: Boolean(vendor?.documentValidation.nationalIdPresent) },
 { label: "LC Letter", done: Boolean(vendor?.documentValidation.lcLetterPresent) },
 { label: "Phone Verified", done: Boolean(user.phoneVerifiedAt) },
 { label: "Email on File", done: Boolean(profileForm.email.trim()) },
 ].map((item) => (
 <div
 key={item.label}
 className={cn(
 "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center",
 item.done ? "border-success/25 bg-success/10" : "border-dashed border-border/70 bg-muted/15",
 )}
 >
 {item.done ? (
 <CheckCircle2 className="h-5 w-5 text-success" />
 ) : (
 <FileClock className="h-5 w-5 text-muted-foreground" />
 )}
 <p className="text-xs font-medium">{item.label}</p>
 <p className={cn("text-[11px]", item.done ? "text-success" : "text-muted-foreground")}>
 {item.done ? "Verified" : "Pending"}
 </p>
 </div>
 ))}
 </div>
 </FormSection>
 )}

 {profileMessage && <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{profileMessage}</div>}
 {profileError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{profileError}</div>}

 <div className="flex flex-wrap items-center gap-2">
 <Button type="button" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending || !canSaveProfile}>
 <UserCircle className="h-4 w-4" />
 {updateProfile.isPending ? "Saving Profile..." : "Save Profile"}
 </Button>
 <Button type="button" variant="outline" onClick={() => navigate(`/${user.role}/settings`)}>
 <Settings className="h-4 w-4" />
 Open Settings
 </Button>
 </div>
 </div>
 </main>
 </div>
 )}
 </ConsolePage>
 );
};

export default ProfileSettingsPage;
