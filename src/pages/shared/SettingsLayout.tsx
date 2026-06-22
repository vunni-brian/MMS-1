/**
 * Shared settings layout providing a sidebar navigation and context provider
 * for all settings sub-pages. Accessible to all roles with role-filtered navigation.
 */
import { createContext, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatHumanDate, formatHumanDateTime } from "@/lib/utils";
import { SectionCard, useSettings, type SettingsSection } from "@/components/settings";
import type { Role } from "@/types";

/** Trims and lowercases a string for search/filter normalization. */
const normalize = (value: string) => value.trim().toLowerCase();

type SettingsData = ReturnType<typeof useSettings>;

const SettingsDataContext = createContext<SettingsData | null>(null);
export { SettingsDataContext };

/** SettingsLayout - renders the settings shell with search, sidebar navigation, and content outlet. */
const SettingsLayout = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
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

  const roleLabels: Record<Role, string> = {
    vendor: t("common:roleVendor"),
    manager: t("common:roleManager"),
    official: t("common:roleOfficial"),
    admin: t("common:roleAdmin"),
  };

  const settingsDescriptions: Record<Role, string> = {
    vendor: t("settings:description.vendor"),
    manager: t("settings:description.manager"),
    official: t("settings:description.official"),
    admin: t("settings:description.admin"),
  };

  const roleLabel = (role: Role) => roleLabels[role];

  const roleSections: SettingsSection[] = useMemo(() => {
    if (!user) return [];
    const account: SettingsSection = {
      id: "account",
      label: t("settings:section.account"),
      summary: t("settings:section.accountSummary"),
      icon: UserCircle,
      keywords: ["account", "profile", "identity", "phone", "email", "market"],
    };

    const security: SettingsSection = {
      id: "security",
      label: t("settings:section.security"),
      summary: t("settings:section.securitySummary"),
      icon: ShieldCheck,
      keywords: ["security", "password", "2fa", "mfa", "sessions", "login"],
    };

    const notifications: SettingsSection = {
      id: "notifications",
      label: t("settings:section.notifications"),
      summary: t("settings:section.notificationsSummary"),
      icon: Bell,
      keywords: ["notifications", "sms", "email", "alerts", "quiet hours", "receipts"],
      count: unreadNotifications.length,
    };

    const preferences: SettingsSection = {
      id: "preferences",
      label: t("settings:section.preferences"),
      summary: t("settings:section.preferencesSummary"),
      icon: SlidersHorizontal,
      keywords: ["preferences", "language", "time zone", "currency", "date", "dashboard"],
    };

    const data: SettingsSection = {
      id: "data",
      label: user.role === "admin" ? t("settings:section.data") : t("settings:section.privacyAndData"),
      summary: t("settings:section.dataSummary"),
      icon: Database,
      keywords: ["data", "privacy", "exports", "backup", "retention"],
    };

    const activity: SettingsSection = {
      id: "activity",
      label: t("settings:section.activity"),
      summary: t("settings:section.activitySummary"),
      icon: Activity,
      keywords: ["activity", "audit", "history", "login", "events"],
      count: activityRows.length,
    };

    if (user.role === "admin") {
      return [
        {
          id: "general",
          label: t("settings:section.general"),
          summary: t("settings:section.generalSummary"),
          icon: Settings,
          keywords: ["general", "runtime", "platform", "mode", "scope"],
        },
        {
          id: "system",
          label: t("settings:section.system"),
          summary: t("settings:section.systemSummary"),
          icon: Server,
          keywords: ["system", "maintenance", "runtime", "mode"],
        },
        security,
        {
          id: "integrations",
          label: t("settings:section.integrations"),
          summary: t("settings:section.integrationsSummary"),
          icon: Plug,
          keywords: ["integrations", "pesapal", "sms", "email", "registry", "sendgrid"],
        },
        {
          id: "features",
          label: t("settings:section.featureManagement"),
          summary: t("settings:section.featureManagementSummary"),
          icon: Flag,
          keywords: ["features", "feature flags", "modules", "rollout"],
        },
        {
          id: "email",
          label: t("settings:section.email"),
          summary: t("settings:section.emailSummary"),
          icon: Mail,
          keywords: ["email", "smtp", "sendgrid", "templates"],
        },
        {
          id: "sms",
          label: t("settings:section.sms"),
          summary: t("settings:section.smsSummary"),
          icon: Phone,
          keywords: ["sms", "africa's talking", "sender", "phone"],
        },
        {
          id: "payments",
          label: t("settings:section.payments"),
          summary: t("settings:section.paymentsSummary"),
          icon: CreditCard,
          keywords: ["payments", "gateway", "pesapal", "fees", "receipts"],
        },
        data,
        {
          id: "logging",
          label: t("settings:section.logging"),
          summary: t("settings:section.loggingSummary"),
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
          label: t("settings:section.marketOperations"),
          summary: t("settings:section.marketOperationsSummary"),
          icon: Building2,
          keywords: ["market", "operations", "rent", "complaints", "escalation", "reports"],
        },
        {
          id: "payments",
          label: t("settings:section.billing"),
          summary: t("settings:section.billingSummary"),
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
          label: t("settings:section.complianceAndOversight"),
          summary: t("settings:section.complianceAndOversightSummary"),
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
        label: t("settings:section.payments"),
        summary: t("settings:section.vendorPaymentsSummary"),
        icon: CreditCard,
        keywords: ["payments", "billing", "receipts", "mobile money"],
      },
      preferences,
      data,
      activity,
    ];
  }, [user, unreadNotifications.length, activityRows.length, t]);

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
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-900">Loading settings…</div>
          <div className="mt-2 text-xs text-slate-500">Restoring your session.</div>
        </div>
      </div>
    );
  }


  const isRootPath = location.pathname.replace(/\/+$/, "").endsWith("/settings");
  const legacySection = searchParams.get("section");
  if (legacySection) {
    return <Navigate to={legacySection} replace />;
  }
  if (isRootPath) {
    return <Navigate to="account" replace />;
  }

  const contextRows = [
    { label: t("settings:layout.currentRole"), value: roleLabel(user.role) },
    { label: t("settings:layout.marketContext"), value: user.marketName || (user.role === "admin" ? t("common:allMarkets") : t("common:noMarketAssigned")) },
    { label: t("settings:layout.accountCreated"), value: formatHumanDate(user.createdAt) },
  ];

  const savedLabel = savedAt ? t("settings:layout.saved", { date: formatHumanDateTime(savedAt) }) : t("settings:layout.ready");
  const showContextPanel = user.role === "manager" || user.role === "official";

  return (
    <SettingsDataContext.Provider value={hook}>
      <div>
        <PageHeader
          eyebrow={t("settings:layout.workspace", { role: roleLabel(user.role) })}
          title={user.role === "admin" ? t("settings:layout.platformSettings") : t("settings:layout.title")}
          description={settingsDescriptions[user.role]}
          meta={
            <>
              <span className="rounded-full bg-muted px-2.5 py-1">{roleLabel(user.role)}</span>
              <span className="rounded-full bg-muted px-2.5 py-1">{user.marketName || (user.role === "admin" ? t("common:allMarkets") : t("common:noMarketAssigned"))}</span>
              <span className="rounded-full bg-muted px-2.5 py-1">{savedLabel}</span>
            </>
          }
        />

        <section className="settings-search-panel">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label={t("settings:layout.searchLabel")}
              placeholder={t("settings:layout.searchPlaceholder")}
              value={settingsSearch}
              onChange={(event) => setSettingsSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        </section>


        {settingsSearch && (
          <section className="settings-section-grid" aria-label={t("settings:layout.searchResultsLabel")}>
            {matchingSections.length === 0 ? (
              <div className="col-span-full">
                <EmptyState title={t("settings:layout.noResults")} description={t("settings:layout.searchHint")} icon={<Search className="h-6 w-6" />} />
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
        )}

        <section className="settings-layout">
          <aside className="settings-nav-panel">
            <div className="mb-2 px-2 py-1">
              <p className="text-xs font-semibold text-muted-foreground">{t("settings:layout.menu")}</p>
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
              <p className="text-xs font-semibold text-muted-foreground">{t("settings:layout.currentContext")}</p>
              <p className="mt-2 truncate text-sm font-semibold">{user.marketName || (user.role === "admin" ? t("common:allMarkets") : t("common:noMarketAssigned"))}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("settings:layout.roleAccess", { role: roleLabel(user.role) })}</p>
            </div>
          </aside>

          <div className="settings-content">
            <div className={cn("settings-detail-grid", showContextPanel && "has-context")}>
              <DashboardErrorBoundary>
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <main className="min-w-0 space-y-4 p-5" aria-label={active?.label}>
                    <Outlet />
                  </main>
                </div>
              </DashboardErrorBoundary>


              {showContextPanel && (
                <aside className="settings-context-panel">
                  <div className="flex items-start gap-3">
                    <span className="settings-section-icon">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold font-heading">{t("settings:layout.currentContext")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("settings:layout.contextHint")}</p>
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
                    {t("settings:layout.contextNote")}
                  </div>
                </aside>
              )}
            </div>

            <div className="settings-status-note">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("settings:layout.statusNote")}</span>
            </div>
          </div>
        </section>
      </div>
    </SettingsDataContext.Provider>
  );
};

export default SettingsLayout;
