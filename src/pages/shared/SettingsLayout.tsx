import { createContext, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Flag,
  ListChecks,
  Mail,
  Phone,
  Plug,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
} from "lucide-react";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { ConsolePage, EmptyState, PageHeader } from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatHumanDate, formatHumanDateTime } from "@/lib/utils";
import { SectionCard, useSettings, type SettingsSection } from "@/components/settings";
import type { Role } from "@/types";

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

const roleLabel = (role: Role) => roleLabels[role];

const normalize = (value: string) => value.trim().toLowerCase();

type SettingsData = ReturnType<typeof useSettings>;

const SettingsDataContext = createContext<SettingsData | null>(null);
export { SettingsDataContext };

const SettingsLayout = () => {
  const { user } = useAuth();
  const hook = useSettings(user);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [settingsSearch, setSettingsSearch] = useState("");

  const {
    savedAt,
    unreadNotifications,
    activityRows,
  } = hook;

  const roleSections: SettingsSection[] = useMemo(() => {
    if (!user) return [];
    const account: SettingsSection = {
      id: "account",
      label: "Account",
      summary: "Identity, verification, role scope, and profile shortcut.",
      icon: UserCircle,
      keywords: ["account", "profile", "identity", "phone", "email", "market"],
    };

    const security: SettingsSection = {
      id: "security",
      label: "Security",
      summary: "Password, 2FA, sessions, and sign-in alerts.",
      icon: ShieldCheck,
      keywords: ["security", "password", "2fa", "mfa", "sessions", "login"],
    };

    const notifications: SettingsSection = {
      id: "notifications",
      label: "Notifications",
      summary: "Email, SMS, in-app alerts, and quiet hours.",
      icon: Bell,
      keywords: ["notifications", "sms", "email", "alerts", "quiet hours", "receipts"],
      count: unreadNotifications.length,
    };

    const preferences: SettingsSection = {
      id: "preferences",
      label: "Preferences",
      summary: "Language, time zone, currency, and dashboard behavior.",
      icon: SlidersHorizontal,
      keywords: ["preferences", "language", "time zone", "currency", "date", "dashboard"],
    };

    const data: SettingsSection = {
      id: "data",
      label: user.role === "admin" ? "Data" : "Privacy and Data",
      summary: "Exports, retention, backups, and data access.",
      icon: Database,
      keywords: ["data", "privacy", "exports", "backup", "retention"],
    };

    const activity: SettingsSection = {
      id: "activity",
      label: "Activity",
      summary: "Audit events, profile changes, and recent account activity.",
      icon: Activity,
      keywords: ["activity", "audit", "history", "login", "events"],
      count: activityRows.length,
    };

    if (user.role === "admin") {
      return [
        {
          id: "general",
          label: "General",
          summary: "Platform state, runtime mode, and system scope.",
          icon: Settings,
          keywords: ["general", "runtime", "platform", "mode", "scope"],
        },
        {
          id: "system",
          label: "System",
          summary: "Runtime controls and maintenance behavior.",
          icon: Server,
          keywords: ["system", "maintenance", "runtime", "mode"],
        },
        security,
        {
          id: "integrations",
          label: "Integrations",
          summary: "Payment, SMS, email, and registry connections.",
          icon: Plug,
          keywords: ["integrations", "pesapal", "sms", "email", "registry", "sendgrid"],
        },
        {
          id: "features",
          label: "Feature Management",
          summary: "Enable modules during phased deployment.",
          icon: Flag,
          keywords: ["features", "feature flags", "modules", "rollout"],
        },
        {
          id: "email",
          label: "Email",
          summary: "SMTP provider, sender identity, and templates.",
          icon: Mail,
          keywords: ["email", "smtp", "sendgrid", "templates"],
        },
        {
          id: "sms",
          label: "SMS",
          summary: "SMS provider, sender ID, triggers, and usage.",
          icon: Phone,
          keywords: ["sms", "africa's talking", "sender", "phone"],
        },
        {
          id: "payments",
          label: "Payments",
          summary: "Gateway, payment methods, receipts, and fees.",
          icon: CreditCard,
          keywords: ["payments", "gateway", "pesapal", "fees", "receipts"],
        },
        data,
        {
          id: "logging",
          label: "Logging",
          summary: "Log levels, retention, destinations, and monitoring.",
          icon: ListChecks,
          keywords: ["logging", "monitoring", "retention", "audit"],
        },
        activity,
      ];
    }

    if (user.role === "manager") {
      return [
        account,
        security,
        notifications,
        {
          id: "market-operations",
          label: "Market Operations",
          summary: "Rent cycle, complaint routing, escalation, and report automation.",
          icon: Building2,
          keywords: ["market", "operations", "rent", "complaints", "escalation", "reports"],
        },
        {
          id: "payments",
          label: "Billing",
          summary: "Payment reminders, receipts, and billing shortcuts.",
          icon: CreditCard,
          keywords: ["billing", "payments", "receipts", "fees"],
        },
        preferences,
        data,
        activity,
      ];
    }

    if (user.role === "official") {
      return [
        account,
        security,
        notifications,
        {
          id: "oversight",
          label: "Compliance and Oversight",
          summary: "SLA thresholds, monitoring alerts, and approval thresholds.",
          icon: ShieldCheck,
          keywords: ["oversight", "compliance", "sla", "monitoring", "approvals", "alerts"],
        },
        preferences,
        data,
        activity,
      ];
    }

    return [
      account,
      security,
      notifications,
      {
        id: "payments",
        label: "Payments",
        summary: "Default payment method, receipts, reminders, and billing history.",
        icon: CreditCard,
        keywords: ["payments", "billing", "receipts", "mobile money"],
      },
      preferences,
      data,
      activity,
    ];
  }, [user, unreadNotifications.length, activityRows.length]);

  const activeSection = location.pathname.split("/").pop() || "account";
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

  if (!user) {
    return null;
  }

  const isRootPath = location.pathname.endsWith("/settings");
  const legacySection = searchParams.get("section");
  if (legacySection) {
    return <Navigate to={legacySection} replace />;
  }
  if (isRootPath) {
    return <Navigate to="account" replace />;
  }

  const contextRows = [
    { label: "Current role", value: roleLabel(user.role) },
    { label: "Market context", value: user.marketName || (user.role === "admin" ? "All markets" : "No market assigned") },
    { label: "Account created", value: formatHumanDate(user.createdAt) },
  ];

  const savedLabel = savedAt ? `Saved ${formatHumanDateTime(savedAt)}` : "Ready";
  const showContextPanel = user.role === "manager" || user.role === "official";

  return (
    <SettingsDataContext.Provider value={hook}>
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
                  navigate(section.id);
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
                  onClick={() => navigate(section.id)}
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
                  <Outlet />
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
    </SettingsDataContext.Provider>
  );
};

export default SettingsLayout;
