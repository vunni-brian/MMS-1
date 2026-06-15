import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
 Activity,
 AlertTriangle,
 Bell,
 Building2,
 CheckCircle2,
 Clock,
 CreditCard,
 Database,
 Eye,
 EyeOff,
 FileDown,
 Flag,
 Globe2,
 KeyRound,
 ListChecks,
 LockKeyhole,
 Mail,
 MessageSquare,
 MonitorCog,
 Phone,
 Plug,
 ReceiptText,
 Search,
 Server,
 Settings,
 ShieldCheck,
 SlidersHorizontal,
 Smartphone,
 UserCircle,
 WalletCards,
} from "lucide-react";

import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { EmptyState } from "@/components/EmptyState";
import {
  ConsolePage,
  EvidenceField,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/console/ConsolePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, getSessionToken } from "@/lib/api";
import { cn, formatCurrency, formatHumanDate, formatHumanDateTime } from "@/lib/utils";
import {
  AccountSection,
  NotificationsSection,
  PaymentsSection,
  PreferencesSection,
  ReadOnlyRows,
  SectionCard,
  SecuritySection,
  SettingInput,
  SettingSelect,
  SettingToggle,
  type SettingsSection,
} from "@/components/settings";
import type { Role } from "@/types";

type SettingValue = boolean | string;
type SettingsState = Record<string, SettingValue>;

const roleLabels: Record<Role, string> = {
 vendor: "Vendor",
 manager: "Manager",
 official: "Official",
 admin: "Admin",
};

const settingsDescriptions: Record<Role, string> = {
 vendor: "Account, security, payments, notifications, preferences, data, and activity controls.",
 manager: "Market account controls, operations defaults, security, notifications, reports, and activity.",
 official: "Oversight, compliance alerts, security, preferences, data access, and account activity.",
 admin: "Platform configuration, system controls, integrations, feature management, security, and audit policy.",
};

const defaultSettings: SettingsState = {
 language: "English",
 timeZone: "Africa/Kampala",
 dateFormat: "DD/MM/YYYY",
 currency: "UGX",
 denseTables: true,
 rememberFilters: true,
 paymentReminders: true,
 dashboardHints: false,

 inAppNotifications: true,
 smsNotifications: false,
 emailNotifications: true,
 quietHours: false,
 notifyPayments: true,
 notifyReceipts: true,
 notifyComplaints: true,
 notifyAssignments: true,
 notifyNotices: true,

 twoFactorRequired: false,
 privilegedMfa: true,
 sessionAlerts: true,
 securityEmails: true,
 mfaMethod: "sms",

 defaultPaymentMethod: "mobile-money",
 receiptFormat: "pdf",
 autoDownloadReceipts: true,
 paymentReminderWindow: "3",

 defaultRentCycle: "monthly",
 complaintRouting: "market-manager",
 escalationHours: "48",
 reportAutomation: true,
 assistantDelegation: false,

 slaThreshold: "72",
 occupancyAlerts: true,
 revenueAlerts: true,
 approvalThreshold: "500000",

 systemMode: "production",
 maintenanceMode: false,
 backupEnabled: true,
 backupTime: "02:00",
 backupRetention: "30",

 smtpProvider: "sendgrid",
 fromEmail: "noreply@mms.ug",
 fromName: "MMS Platform",
 smsProvider: "africas-talking",
 senderId: "MMS",
 paymentGateway: "pesapal",
 vendorPaysFee: false,
 platformFeePercent: "0",

 featureComplaints: true,
 featurePayments: true,
 featureStallAllocation: true,
 featureInspections: true,
 featureReports: true,
 featureAssetTracking: false,
 featureGisMapping: false,

 logDebug: false,
 logInfo: true,
 logWarning: true,
 logError: true,
 logRetention: "30",
 auditRetention: "365",
};

const loadStoredSettings = () => {
 if (typeof window === "undefined") {
 return defaultSettings;
 }

 try {
 const stored = window.localStorage.getItem("mms.settings");
 if (!stored) return defaultSettings;
 return { ...defaultSettings, ...(JSON.parse(stored) as SettingsState) };
 } catch {
 return defaultSettings;
 }
};

const roleLabel = (role: Role) => roleLabels[role];

const normalize = (value: string) => value.trim().toLowerCase();

const SettingsPage = () => {
 const { user, logout } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const [searchParams, setSearchParams] = useSearchParams();
 const [settings, setSettings] = useState<SettingsState>(loadStoredSettings);
 const [settingsSearch, setSettingsSearch] = useState("");
 const [activeSection, setActiveSectionState] = useState(searchParams.get("section") || "account");
 const [savedAt, setSavedAt] = useState<Date | null>(null);
 const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
 const [passwordError, setPasswordError] = useState<string | null>(null);
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

 const canReadAudit = Boolean(user?.permissions.includes("audit:read"));
 const canReadPayments = Boolean(user?.permissions.includes("payment:read"));
 const canReadBilling = Boolean(user?.permissions.includes("billing:read") || user?.permissions.includes("billing:manage"));
 const canReadNotifications = Boolean(user?.permissions.includes("notification:read"));

 const notificationsQuery = useQuery({
 queryKey: ["notifications", "settings"],
 queryFn: () => api.getNotifications(8),
 enabled: canReadNotifications,
 });

 const paymentsQuery = useQuery({
 queryKey: ["payments", "settings", user?.marketId],
 queryFn: () => api.getPayments(user?.role === "admin" ? undefined : user?.marketId || undefined),
 enabled: canReadPayments,
 });

 const chargeTypesQuery = useQuery({
 queryKey: ["charge-types", "settings", user?.marketId],
 queryFn: () => api.getChargeTypes(user?.role === "admin" ? undefined : user?.marketId || undefined),
 enabled: canReadBilling,
 });

 const auditQuery = useQuery({
 queryKey: ["audit", "settings", user?.marketId],
 queryFn: () => api.getAudit(user?.role === "admin" ? undefined : user?.marketId || undefined),
 enabled: canReadAudit,
 });

 const marketsQuery = useQuery({
 queryKey: ["markets", "settings"],
 queryFn: () => api.getMarkets(),
 enabled: user?.role === "admin",
 });

 useEffect(() => {
 const section = searchParams.get("section");
 if (section) {
 setActiveSectionState(section);
 }
 }, [searchParams]);

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

 const [deactivationState, setDeactivationState] = useState<"idle" | "confirm" | "submitting" | "done" | "error">("idle");

 const requestDeactivation = useMutation({
 mutationFn: () => api.createTicket({
 category: "other",
 priority: "high",
 subject: "Account Deactivation Request",
 description: `Vendor ${user.name} (ID: ${user.id}) has requested deactivation of their account. Please review and process stall release.`,
 }),
 onSuccess: () => setDeactivationState("done"),
 onError: () => setDeactivationState("error"),
 });

 const [wipeState, setWipeState] = useState<"idle" | "confirm" | "submitting" | "done" | "error">("idle");

 const wipeTestData = useMutation({
 mutationFn: async () => {
 const token = getSessionToken();
 const res = await fetch("/api/admin/wipe-test-data", {
 method: "POST",
 headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
 });
 if (!res.ok) throw new Error("Wipe failed");
 },
 onSuccess: () => setWipeState("done"),
 onError: () => setWipeState("error"),
 });

 if (!user) {
 return null;
 }

 const updateSetting = (key: string, value: SettingValue) => {
 setSettings((current) => {
 const next = { ...current, [key]: value };
 try {
 window.localStorage.setItem("mms.settings", JSON.stringify(next));
 } catch {
 // Settings remain in memory when local storage is unavailable.
 }
 return next;
 });
 setSavedAt(new Date());
 };

 const getBoolean = (key: string) => Boolean(settings[key]);
 const getString = (key: string) => String(settings[key] ?? defaultSettings[key] ?? "");

 const setActiveSection = (section: string) => {
 setActiveSectionState(section);
 setSearchParams({ section });
 };

 const notifications = notificationsQuery.data?.notifications || [];
 const payments = paymentsQuery.data?.payments || [];
 const chargeTypes = chargeTypesQuery.data?.chargeTypes || [];
 const auditEvents = auditQuery.data?.events || [];
 const markets = marketsQuery.data?.markets || [];
 const completedPayments = payments.filter((payment) => payment.status === "completed");
 const pendingPayments = payments.filter((payment) => payment.status === "pending");
 const completedPaymentTotal = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
 const paymentGateway = chargeTypes.find((chargeType) => chargeType.name === "payment_gateway");
 const unreadNotifications = notifications.filter((notification) => !notification.read);

 const roleHomePath = `/${user.role}`;
 const contextRows = [
 { label: "Current role", value: roleLabel(user.role) },
 { label: "Market context", value: user.marketName || (user.role === "admin" ? "All markets" : "No market assigned") },
 { label: "Account created", value: formatHumanDate(user.createdAt) },
 ];

 const activityRows = auditEvents.length
 ? auditEvents.slice(0, 8).map((event) => ({
 id: event.id,
 title: event.action.replace(/_/g, " "),
 detail: `${event.actorName || "System"} - ${event.marketName || "System scope"}`,
 time: formatHumanDateTime(event.createdAt),
 }))
 : notifications.slice(0, 8).map((notification) => ({
 id: notification.id,
 title: notification.type.charAt(0).toUpperCase() + notification.type.slice(1),
 detail: notification.message,
 time: formatHumanDateTime(notification.createdAt),
 }));

  const accountSection = (
    <AccountSection
      user={user}
      navigate={navigate}
      roleHomePath={roleHomePath}
      setActiveSection={setActiveSection}
      deactivationState={deactivationState}
      setDeactivationState={setDeactivationState}
      onRequestDeactivation={() => requestDeactivation.mutate()}
    />
  );

  const securitySection = (
    <SecuritySection
      user={user}
      settings={settings}
      updateSetting={updateSetting}
      getBoolean={getBoolean}
      getString={getString}
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

  const notificationsSection = (
    <NotificationsSection
      user={user}
      settings={settings}
      updateSetting={updateSetting}
      getBoolean={getBoolean}
      getString={getString}
      notificationsQuery={notificationsQuery}
      notifications={notifications}
      canReadNotifications={canReadNotifications}
    />
  );

  const preferencesSection = (
    <PreferencesSection
      user={user}
      settings={settings}
      updateSetting={updateSetting}
      getBoolean={getBoolean}
      getString={getString}
    />
  );

  const paymentsSection = (
    <PaymentsSection
      user={user}
      settings={settings}
      updateSetting={updateSetting}
      getBoolean={getBoolean}
      getString={getString}
      paymentGateway={paymentGateway}
      completedPayments={completedPayments}
      completedPaymentTotal={completedPaymentTotal}
      pendingPayments={pendingPayments}
      navigate={navigate}
    />
  );

 const managerOperationsSection = (
 <div className="space-y-4">
 <Panel
 title="Market Operations"
 description="Defaults for rent cycles, complaint routing, escalation behavior, report automation, and delegated work."
 actions={<Building2 className="h-4 w-4 text-muted-foreground" />}
 contentClassName="space-y-3"
 >
 <SettingSelect
 id="settings-rent-cycle"
 label="Default rent cycle"
 value={getString("defaultRentCycle")}
 onValueChange={(value) => updateSetting("defaultRentCycle", value)}
 options={[
 { value: "weekly", label: "Weekly" },
 { value: "monthly", label: "Monthly" },
 { value: "quarterly", label: "Quarterly" },
 ]}
 />
 <SettingSelect
 id="settings-complaint-routing"
 label="Complaint routing"
 value={getString("complaintRouting")}
 onValueChange={(value) => updateSetting("complaintRouting", value)}
 options={[
 { value: "market-manager", label: "Market manager first" },
 { value: "operations-team", label: "Operations team" },
 { value: "official-review", label: "Official review queue" },
 ]}
 />
 <SettingInput
 id="settings-escalation-hours"
 label="Escalation timing"
 detail="Hours before unresolved complaints escalate."
 value={getString("escalationHours")}
 onChange={(value) => updateSetting("escalationHours", value)}
 />
 <SettingToggle
 label="Automated weekly reports"
 detail="Prepare summary reports for market leadership."
 checked={getBoolean("reportAutomation")}
 onCheckedChange={(checked) => updateSetting("reportAutomation", checked)}
 />
 <SettingToggle
 label="Assistant delegation"
 detail="Allow assigned assistants to triage routine requests."
 checked={getBoolean("assistantDelegation")}
 onCheckedChange={(checked) => updateSetting("assistantDelegation", checked)}
 />
 </Panel>
 </div>
 );

 const officialOversightSection = (
 <div className="space-y-4">
 <Panel
 title="Compliance and Oversight"
 description="Thresholds and alerts for regional monitoring, inspections, and approval gates."
 actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
 contentClassName="space-y-3"
 >
 <SettingInput
 id="settings-sla-threshold"
 label="Complaint SLA threshold"
 detail="Hours before unresolved items become compliance risks."
 value={getString("slaThreshold")}
 onChange={(value) => updateSetting("slaThreshold", value)}
 />
 <SettingToggle
 label="Occupancy alerts"
 detail="Alert when market occupancy drops below expected levels."
 checked={getBoolean("occupancyAlerts")}
 onCheckedChange={(checked) => updateSetting("occupancyAlerts", checked)}
 />
 <SettingToggle
 label="Revenue variance alerts"
 detail="Alert when collections move outside expected thresholds."
 checked={getBoolean("revenueAlerts")}
 onCheckedChange={(checked) => updateSetting("revenueAlerts", checked)}
 />
 <SettingInput
 id="settings-approval-threshold"
 label="Approval threshold"
 detail="UGX value requiring official review."
 value={getString("approvalThreshold")}
 onChange={(value) => updateSetting("approvalThreshold", value)}
 />
 </Panel>
 </div>
 );

 const dataSection = (
 <div className="space-y-4">
 <Panel
 title={user.role === "admin" ? "Data Management" : "Privacy and Data"}
 description="Exports, retention, backups, and operational data access."
 actions={<Database className="h-4 w-4 text-muted-foreground" />}
 contentClassName="space-y-3"
 >
 {user.role === "admin" && (
 <>
 <SettingToggle
 label="Automatic daily backups"
 detail="Run a database backup on the configured schedule."
 checked={getBoolean("backupEnabled")}
 onCheckedChange={(checked) => updateSetting("backupEnabled", checked)}
 />
 <SettingInput
 id="settings-backup-time"
 label="Backup time"
 value={getString("backupTime")}
 onChange={(value) => updateSetting("backupTime", value)}
 />
 <SettingInput
 id="settings-backup-retention"
 label="Backup retention"
 detail="Number of days to keep automatic backups."
 value={getString("backupRetention")}
 onChange={(value) => updateSetting("backupRetention", value)}
 />
 </>
 )}
 <div className="grid gap-3 sm:grid-cols-3">
 <EvidenceField label="Payments loaded" value={payments.length} />
 <EvidenceField label="Activity records" value={auditEvents.length || "Permission dependent"} />
 <EvidenceField label="Notifications loaded" value={notifications.length} />
 </div>
 <div className="flex flex-wrap gap-2">
 <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/reports`)}>
 <FileDown className="h-4 w-4" />
 Open Exports
 </Button>
 {canReadAudit && (
 <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/audit`)}>
 <Activity className="h-4 w-4" />
 Open Activity Log
 </Button>
 )}
 </div>
 </Panel>

 {user.role === "admin" && (
 <Panel title="Danger Zone" description="Administrative cleanup actions require backend confirmation." actions={<AlertTriangle className="h-4 w-4 text-destructive" />}>
 <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
 <p className="text-sm font-semibold text-destructive">Wipe test data</p>
 <p className="mt-1 text-xs leading-5 text-muted-foreground">Removes demo vendors, sample payments, and generated complaints after confirmation.</p>
 {wipeState === "done" ? (
 <p className="mt-3 text-xs text-success font-medium">Test data wiped successfully.</p>
 ) : wipeState === "error" ? (
 <p className="mt-3 text-xs text-destructive font-medium">Wipe failed. The backend endpoint may not be available yet.</p>
 ) : wipeState === "confirm" ? (
 <div className="mt-3 space-y-2">
 <p className="text-xs font-semibold text-destructive">This cannot be undone. Confirm wipe?</p>
 <div className="flex gap-2">
 <Button
 type="button"
 size="sm"
 variant="destructive"
 disabled={wipeTestData.isPending}
 onClick={() => { setWipeState("submitting"); wipeTestData.mutate(); }}
 >
 {wipeTestData.isPending ? "Wiping…" : "Yes, wipe test data"}
 </Button>
 <Button type="button" size="sm" variant="outline" onClick={() => setWipeState("idle")}>
 Cancel
 </Button>
 </div>
 </div>
 ) : (
 <Button
 type="button"
 variant="outline"
 className="mt-3 text-destructive hover:text-destructive"
 onClick={() => setWipeState("confirm")}
 >
 Wipe Test Data
 </Button>
 )}
 </div>
 </Panel>
 )}
 </div>
 );

 const activitySection = (
 <div className="space-y-4">
 <Panel
 title="Activity Log"
 description="Account and operational activity visible to this role."
 actions={<Activity className="h-4 w-4 text-muted-foreground" />}
 >
 {auditQuery.isPending && canReadAudit ? (
 <LoadingState rows={5} itemClassName="h-14 rounded-lg" />
 ) : activityRows.length === 0 ? (
 <EmptyState title="No activity records loaded" description="Profile changes, password updates, receipts, and operational events will appear here." icon={Activity} />
 ) : (
 <div className="settings-activity-list">
 {activityRows.map((row) => (
 <div key={row.id} className="settings-activity-row">
 <span className="settings-activity-dot" />
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold">{row.title}</p>
 <p className="mt-1 truncate text-xs text-muted-foreground">{row.detail}</p>
 </div>
 <span className="shrink-0 text-xs text-muted-foreground">{row.time}</span>
 </div>
 ))}
 </div>
 )}
 </Panel>
 </div>
 );

 const adminGeneralSection = (
 <div className="space-y-4">
 <Panel title="Platform Overview" description="High-level platform state for municipal administration." actions={<Settings className="h-4 w-4 text-muted-foreground" />}>
 <div className="grid gap-3 sm:grid-cols-3">
 <EvidenceField label="Markets" value={markets.length || "Not loaded"} />
 <EvidenceField label="Billing switches" value={chargeTypes.length || "Not loaded"} />
 <EvidenceField label="Payment records" value={payments.length || "Not loaded"} />
 </div>
 <ReadOnlyRows
 rows={[
 { label: "Runtime mode", value: import.meta.env.MODE },
 { label: "API base URL", value: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001" },
 { label: "Workspace scope", value: "All markets" },
 ]}
 />
 </Panel>
 </div>
 );

 const adminSystemSection = (
 <div className="space-y-4">
 <Panel title="System Controls" description="Operational runtime controls and maintenance behavior." actions={<Server className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
 <SettingSelect
 id="settings-system-mode"
 label="System mode"
 value={getString("systemMode")}
 onValueChange={(value) => updateSetting("systemMode", value)}
 options={[
 { value: "production", label: "Production" },
 { value: "staging", label: "Staging" },
 { value: "maintenance", label: "Maintenance" },
 ]}
 />
 <SettingToggle
 label="Maintenance banner"
 detail="Display a visible maintenance state to users."
 checked={getBoolean("maintenanceMode")}
 onCheckedChange={(checked) => updateSetting("maintenanceMode", checked)}
 />
 </Panel>
 </div>
 );

 const integrationsSection = (
 <div className="space-y-4">
 <Panel title="Integrations" description="External municipal and service-provider connections." actions={<Plug className="h-4 w-4 text-muted-foreground" />}>
 <div className="grid gap-3 md:grid-cols-2">
 <EvidenceField label="Payment gateway" value={`Pesapal - ${paymentGateway?.isEnabled === false ? "Paused" : "Connected"}`} />
 <EvidenceField label="SMS provider" value="Africa's Talking - Configured server-side" />
 <EvidenceField label="Email service" value="SendGrid - Configured server-side" />
 <EvidenceField label="Government registry" value="Not connected" />
 </div>
 <Button type="button" variant="outline" className="mt-3" onClick={() => navigate("/admin/integrations")}>
 <Plug className="h-4 w-4" />
 Open Integrations Workspace
 </Button>
 </Panel>
 </div>
 );

 const featureManagementSection = (
 <div className="space-y-4">
 <Panel title="Feature Management" description="Enable modules during phased municipal rollout." actions={<Flag className="h-4 w-4 text-muted-foreground" />} contentClassName="grid gap-3 md:grid-cols-2">
 <SettingToggle label="Complaints" detail="Vendor complaint intake and resolution." checked={getBoolean("featureComplaints")} onCheckedChange={(checked) => updateSetting("featureComplaints", checked)} />
 <SettingToggle label="Payments" detail="Gateway and receipt payment workflows." checked={getBoolean("featurePayments")} onCheckedChange={(checked) => updateSetting("featurePayments", checked)} />
 <SettingToggle label="Stall Allocation" detail="Stall inventory, booking, and allocation." checked={getBoolean("featureStallAllocation")} onCheckedChange={(checked) => updateSetting("featureStallAllocation", checked)} />
 <SettingToggle label="Inspections" detail="Compliance inspection workflows." checked={getBoolean("featureInspections")} onCheckedChange={(checked) => updateSetting("featureInspections", checked)} />
 <SettingToggle label="Reports" detail="Exports and analytics workspaces." checked={getBoolean("featureReports")} onCheckedChange={(checked) => updateSetting("featureReports", checked)} />
 <SettingToggle label="Asset Tracking" detail="Future fixed asset register." checked={getBoolean("featureAssetTracking")} onCheckedChange={(checked) => updateSetting("featureAssetTracking", checked)} />
 <SettingToggle label="GIS Mapping" detail="Future map-based market planning." checked={getBoolean("featureGisMapping")} onCheckedChange={(checked) => updateSetting("featureGisMapping", checked)} />
 </Panel>
 </div>
 );

 const emailSection = (
 <div className="space-y-4">
 <Panel title="Email Configuration" description="SMTP provider and template controls." actions={<Mail className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
 <SettingSelect
 id="settings-smtp-provider"
 label="SMTP provider"
 value={getString("smtpProvider")}
 onValueChange={(value) => updateSetting("smtpProvider", value)}
 options={[
 { value: "sendgrid", label: "SendGrid" },
 { value: "smtp", label: "Custom SMTP" },
 { value: "disabled", label: "Disabled" },
 ]}
 />
 <SettingInput id="settings-" label="From email" value={getString("fromEmail")} onChange={(value) => updateSetting("fromEmail", value)} />
 <SettingInput id="settings-" label="From name" value={getString("fromName")} onChange={(value) => updateSetting("fromName", value)} />
 <ReadOnlyRows
 rows={[
 { label: "Welcome email", value: "Template available" },
 { label: "Payment receipt", value: "Template available" },
 { label: "Complaint update", value: "Template available" },
 { label: "Password reset", value: "Template available" },
 ]}
 />
 </Panel>
 </div>
 );

 const smsSection = (
 <div className="space-y-4">
 <Panel title="SMS Configuration" description="SMS provider, sender ID, triggers, and usage controls." actions={<Smartphone className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
 <SettingSelect
 id="settings-sms-provider"
 label="SMS provider"
 value={getString("smsProvider")}
 onValueChange={(value) => updateSetting("smsProvider", value)}
 options={[
 { value: "africas-talking", label: "Africa's Talking" },
 { value: "twilio", label: "Twilio" },
 { value: "disabled", label: "Disabled" },
 ]}
 />
 <SettingInput id="settings-sender-id" label="Sender ID" value={getString("senderId")} onChange={(value) => updateSetting("senderId", value)} />
 <SettingToggle label="Payment confirmation SMS" detail="Send SMS after payment confirmation." checked={getBoolean("notifyReceipts")} onCheckedChange={(checked) => updateSetting("notifyReceipts", checked)} />
 <SettingToggle label="Critical market alerts" detail="Send high-priority market notices by SMS." checked={getBoolean("smsNotifications")} onCheckedChange={(checked) => updateSetting("smsNotifications", checked)} />
 <EvidenceField label="SMS sent this month" value="2,450 / 10,000" />
 </Panel>
 </div>
 );

 const loggingSection = (
 <div className="space-y-4">
 <Panel title="Logging and Monitoring" description="Log levels, retention, destinations, and audit storage." actions={<MonitorCog className="h-4 w-4 text-muted-foreground" />} contentClassName="space-y-3">
 <div className="grid gap-3 md:grid-cols-2">
 <SettingToggle label="Debug logs" detail="Verbose troubleshooting output." checked={getBoolean("logDebug")} onCheckedChange={(checked) => updateSetting("logDebug", checked)} />
 <SettingToggle label="Info logs" detail="Standard operational records." checked={getBoolean("logInfo")} onCheckedChange={(checked) => updateSetting("logInfo", checked)} />
 <SettingToggle label="Warning logs" detail="Potential issues and policy exceptions." checked={getBoolean("logWarning")} onCheckedChange={(checked) => updateSetting("logWarning", checked)} />
 <SettingToggle label="Error logs" detail="Failures and request errors." checked={getBoolean("logError")} onCheckedChange={(checked) => updateSetting("logError", checked)} />
 </div>
 <SettingInput id="settings-log-retention" label="Application log retention" value={getString("logRetention")} onChange={(value) => updateSetting("logRetention", value)} />
 <SettingInput id="settings-audit-retention" label="Audit log retention" value={getString("auditRetention")} onChange={(value) => updateSetting("auditRetention", value)} />
 </Panel>
 </div>
 );

 const baseSections: SettingsSection[] = [
 {
 id: "account",
 label: "Account",
 summary: "Identity, verification, role scope, and profile shortcut.",
 icon: UserCircle,
 keywords: ["account", "profile", "identity", "phone", "email", "market"],
 content: accountSection,
 },
 {
 id: "security",
 label: "Security",
 summary: "Password, 2FA, sessions, and sign-in alerts.",
 icon: ShieldCheck,
 keywords: ["security", "password", "2fa", "mfa", "sessions", "login"],
 content: securitySection,
 },
 {
 id: "notifications",
 label: "Notifications",
 summary: "Email, SMS, in-app alerts, and quiet hours.",
 icon: Bell,
 keywords: ["notifications", "sms", "email", "alerts", "quiet hours", "receipts"],
 count: unreadNotifications.length,
 content: notificationsSection,
 },
 {
 id: "preferences",
 label: "Preferences",
 summary: "Language, time zone, currency, and dashboard behavior.",
 icon: SlidersHorizontal,
 keywords: ["preferences", "language", "time zone", "currency", "date", "dashboard"],
 content: preferencesSection,
 },
 {
 id: "data",
 label: user.role === "admin" ? "Data" : "Privacy and Data",
 summary: "Exports, retention, backups, and data access.",
 icon: Database,
 keywords: ["data", "privacy", "exports", "backup", "retention"],
 content: dataSection,
 },
 {
 id: "activity",
 label: "Activity",
 summary: "Audit events, profile changes, and recent account activity.",
 icon: Activity,
 keywords: ["activity", "audit", "history", "login", "events"],
 count: activityRows.length,
 content: activitySection,
 },
 ];

 const roleSections: SettingsSection[] = (() => {
 if (user.role === "admin") {
 return [
 {
 id: "general",
 label: "General",
 summary: "Platform state, runtime mode, and system scope.",
 icon: Settings,
 keywords: ["general", "runtime", "platform", "mode", "scope"],
 content: adminGeneralSection,
 },
 {
 id: "system",
 label: "System",
 summary: "Runtime controls and maintenance behavior.",
 icon: Server,
 keywords: ["system", "maintenance", "runtime", "mode"],
 content: adminSystemSection,
 },
 baseSections[1],
 {
 id: "integrations",
 label: "Integrations",
 summary: "Payment, SMS, email, and registry connections.",
 icon: Plug,
 keywords: ["integrations", "pesapal", "sms", "email", "registry", "sendgrid"],
 content: integrationsSection,
 },
 {
 id: "features",
 label: "Feature Management",
 summary: "Enable modules during phased deployment.",
 icon: Flag,
 keywords: ["features", "feature flags", "modules", "rollout"],
 content: featureManagementSection,
 },
 {
 id: "email",
 label: "Email",
 summary: "SMTP provider, sender identity, and templates.",
 icon: Mail,
 keywords: ["email", "smtp", "sendgrid", "templates"],
 content: emailSection,
 },
 {
 id: "sms",
 label: "SMS",
 summary: "SMS provider, sender ID, triggers, and usage.",
 icon: Phone,
 keywords: ["sms", "africa's talking", "sender", "phone"],
 content: smsSection,
 },
 {
 id: "payments",
 label: "Payments",
 summary: "Gateway, payment methods, receipts, and fees.",
 icon: CreditCard,
 keywords: ["payments", "gateway", "pesapal", "fees", "receipts"],
 content: paymentsSection,
 },
 baseSections[4],
 {
 id: "logging",
 label: "Logging",
 summary: "Log levels, retention, destinations, and monitoring.",
 icon: ListChecks,
 keywords: ["logging", "monitoring", "retention", "audit"],
 content: loggingSection,
 },
 baseSections[5],
 ];
 }

 if (user.role === "manager") {
 return [
 baseSections[0],
 baseSections[1],
 baseSections[2],
 {
 id: "market-operations",
 label: "Market Operations",
 summary: "Rent cycle, complaint routing, escalation, and report automation.",
 icon: Building2,
 keywords: ["market", "operations", "rent", "complaints", "escalation", "reports"],
 content: managerOperationsSection,
 },
 {
 id: "payments",
 label: "Billing",
 summary: "Payment reminders, receipts, and billing shortcuts.",
 icon: CreditCard,
 keywords: ["billing", "payments", "receipts", "fees"],
 content: paymentsSection,
 },
 baseSections[3],
 baseSections[4],
 baseSections[5],
 ];
 }

 if (user.role === "official") {
 return [
 baseSections[0],
 baseSections[1],
 baseSections[2],
 {
 id: "oversight",
 label: "Compliance and Oversight",
 summary: "SLA thresholds, monitoring alerts, and approval thresholds.",
 icon: ShieldCheck,
 keywords: ["oversight", "compliance", "sla", "monitoring", "approvals", "alerts"],
 content: officialOversightSection,
 },
 baseSections[3],
 baseSections[4],
 baseSections[5],
 ];
 }

 return [
 baseSections[0],
 baseSections[1],
 baseSections[2],
 {
 id: "payments",
 label: "Payments",
 summary: "Default payment method, receipts, reminders, and billing history.",
 icon: CreditCard,
 keywords: ["payments", "billing", "receipts", "mobile money"],
 content: paymentsSection,
 },
 baseSections[3],
 baseSections[4],
 baseSections[5],
 ];
 })();

 const effectiveActiveSection = roleSections.some((section) => section.id === activeSection)
 ? activeSection
 : roleSections[0]?.id || "account";
 const active = roleSections.find((section) => section.id === effectiveActiveSection) || roleSections[0];
 const searchValue = normalize(settingsSearch);
 const matchingSections = searchValue
 ? roleSections.filter((section) =>
 normalize([section.label, section.summary, ...section.keywords].join(" ")).includes(searchValue),
 )
 : roleSections;

 const savedLabel = savedAt ? `Saved ${formatHumanDateTime(savedAt)}` : "Ready";
 const showContextPanel = user.role === "manager" || user.role === "official";

 return (
 <ConsolePage>
 <PageHeader
 eyebrow={`${roleLabel(user.role)} workspace`}
 title={user.role === "admin" ? "Platform Settings" : "Settings"}
 description={settingsDescriptions[user.role]}
 meta={
 <>
 <span className="rounded-full bg-muted px-2.5 py-1">{roleLabel(user.role)}</span>
 <span className="rounded-full bg-muted px-2.5 py-1">{user.marketName || (user.role === "admin" ? "All markets" : "No market assigned")}</span>
 <span className="rounded-full bg-muted px-2.5 py-1">{savedLabel}</span>
 </>
 }
 />

 <section className="settings-search-panel">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 type="search"
 aria-label="Search settings"
 placeholder="Search settings..."
 value={settingsSearch}
 onChange={(event) => setSettingsSearch(event.target.value)}
 className="pl-9"
 />
 </section>

 <section className="settings-section-grid" aria-label={settingsSearch ? "Settings search results" : "Settings sections"}>
 {matchingSections.length === 0 ? (
 <div className="col-span-full">
 <EmptyState title="No matching settings" description="Try searching for password, notifications, receipts, exports, SMS, or 2FA." icon={Search} />
 </div>
 ) : (
 matchingSections.map((section) => (
 <SectionCard
 key={section.id}
 section={section}
 active={section.id === effectiveActiveSection}
 onSelect={() => {
 setSettingsSearch("");
 setActiveSection(section.id);
 }}
 />
 ))
 )}
 </section>

 <section className="settings-layout">
 <aside className="settings-nav-panel">
 <div className="mb-2 px-2 py-1">
 <p className="text-xs font-semibold text-muted-foreground">Settings menu</p>
 </div>
 {roleSections.map((section) => {
 const Icon = section.icon;
 return (
 <button
 key={section.id}
 type="button"
 onClick={() => setActiveSection(section.id)}
 className={cn("settings-nav-button", section.id === effectiveActiveSection && "is-active")}
 aria-current={section.id === effectiveActiveSection ? "true" : undefined}
 >
 <Icon className="h-4 w-4" />
 <span className="min-w-0 flex-1 truncate">{section.label}</span>
 {typeof section.count === "number" && <span>{section.count}</span>}
 </button>
 );
 })}

 <div className="mt-3 rounded-lg bg-muted/20 p-3">
 <p className="text-xs font-semibold text-muted-foreground">Current context</p>
 <p className="mt-2 truncate text-sm font-semibold">{user.marketName || (user.role === "admin" ? "All markets" : "No market assigned")}</p>
 <p className="mt-1 text-xs text-muted-foreground">{roleLabel(user.role)} access</p>
 </div>
 </aside>

 <div className="settings-content">
 <div className={cn("settings-detail-grid", showContextPanel && "has-context")}>
 <DashboardErrorBoundary>
 <main className="min-w-0 space-y-4" aria-label={active?.label}>
 {active?.content}
 </main>
 </DashboardErrorBoundary>

 {showContextPanel && (
 <aside className="settings-context-panel">
 <div className="flex items-start gap-3">
 <span className="settings-section-icon">
 <Building2 className="h-4 w-4" />
 </span>
 <div className="min-w-0">
 <p className="text-sm font-semibold font-heading">Current Context</p>
 <p className="mt-1 text-xs leading-5 text-muted-foreground">Visible on every manager and official settings section.</p>
 </div>
 </div>
 <div className="mt-3 space-y-2">
 {contextRows.map((row) => (
 <div key={row.label} className="rounded-lg border border-border/70 bg-background p-3">
 <p className="text-[11px] font-medium text-muted-foreground">{row.label}</p>
 <p className="mt-1 truncate text-sm font-semibold">{row.value}</p>
 </div>
 ))}
 </div>
 <div className="mt-3 rounded-lg border border-info/20 bg-info/10 p-3 text-xs leading-5 text-info">
 Settings apply to the active market context unless a platform-wide permission overrides it.
 </div>
 </aside>
 )}
 </div>

 <div className="settings-status-note">
 <CheckCircle2 className="h-4 w-4" />
 <span>Settings changes on this page are stored locally unless a dedicated backend workflow is available.</span>
 </div>
 </div>
 </section>
 </ConsolePage>
 );
};

export default SettingsPage;
