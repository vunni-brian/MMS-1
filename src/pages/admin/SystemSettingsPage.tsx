import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Clock,
  CreditCard,
  Database,
  Gauge,
  Server,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import {
  ConsolePage,
  EmptyState,
  EvidenceField,
  LoadingState,
  PageHeader,
  Panel,
  RecordCard,
} from "@/components/console/ConsolePage";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, formatCurrency, formatHumanDateTime } from "@/lib/utils";
import type { ChargeType } from "@/types";

interface SettingRow {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

const numberFormatter = new Intl.NumberFormat("en-US");

const formatMilliseconds = (milliseconds: number) => {
  if (milliseconds === 0) return "Live";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toLocaleString()} sec`;
  const minutes = seconds / 60;
  return `${minutes.toLocaleString()} min`;
};

const formatSettingKey = (key: string) =>
  key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

const toneClasses: Record<NonNullable<SettingRow["tone"]>, string> = {
  default: "border-border/70 bg-muted/35 text-muted-foreground",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/10 text-info",
};

const SettingCard = ({ row }: { row: SettingRow }) => (
  <div className="rounded-md bg-muted/20 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
        <p className="mt-1 break-words text-sm font-semibold">{row.value}</p>
      </div>
      <span
        className={cn(
          "inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          toneClasses[row.tone || "default"],
        )}
      >
        {row.detail}
      </span>
    </div>
  </div>
);

const getChargeTone = (chargeType: ChargeType): SettingRow["tone"] => {
  if (!chargeType.isEnabled) return chargeType.name === "payment_gateway" ? "destructive" : "warning";
  return "success";
};

const SystemSettingsPage = () => {
  const { user } = useAuth();
  const [activeSettingsSection, setActiveSettingsSection] = useState("runtime-settings");

  const marketsQuery = useQuery({
    queryKey: ["markets", "system-settings"],
    queryFn: () => api.getMarkets(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const usersQuery = useQuery({
    queryKey: ["users", "system-settings"],
    queryFn: () => api.getUsers(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "system-settings"],
    queryFn: () => api.getVendors(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const chargeTypesQuery = useQuery({
    queryKey: ["charge-types", "system-settings"],
    queryFn: () => api.getChargeTypes(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "system-settings"],
    queryFn: () => api.getPayments(),
    refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "system-settings"],
    queryFn: () => api.getTickets(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const utilityChargesQuery = useQuery({
    queryKey: ["utility-charges", "system-settings"],
    queryFn: () => api.getUtilityCharges(),
    refetchInterval: DASHBOARD_CONFIG.UTILITIES_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const penaltiesQuery = useQuery({
    queryKey: ["penalties", "system-settings"],
    queryFn: () => api.getPenalties(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const auditQuery = useQuery({
    queryKey: ["audit", "system-settings"],
    queryFn: () => api.getAudit(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const isLoading =
    marketsQuery.isPending ||
    usersQuery.isPending ||
    vendorsQuery.isPending ||
    chargeTypesQuery.isPending ||
    paymentsQuery.isPending ||
    ticketsQuery.isPending ||
    utilityChargesQuery.isPending ||
    penaltiesQuery.isPending ||
    auditQuery.isPending;

  const markets = marketsQuery.data?.markets || [];
  const staffUsers = usersQuery.data?.users || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const chargeTypes = chargeTypesQuery.data?.chargeTypes || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const utilityCharges = utilityChargesQuery.data?.utilityCharges || [];
  const penalties = penaltiesQuery.data?.penalties || [];
  const auditEvents = auditQuery.data?.events || [];

  const pendingVendors = vendors.filter((vendor) => vendor.status === "pending");
  const enabledChargeTypes = chargeTypes.filter((chargeType) => chargeType.isEnabled);
  const disabledChargeTypes = chargeTypes.filter((chargeType) => !chargeType.isEnabled);
  const paymentGateway = chargeTypes.find((chargeType) => chargeType.name === "payment_gateway");
  const failedPayments = payments.filter((payment) => payment.status === "failed");
  const openTickets = tickets.filter((ticket) => ticket.status !== "resolved" && ticket.status !== "closed");
  const overdueUtilities = utilityCharges.filter((charge) => charge.status === "overdue");
  const openPenalties = penalties.filter((penalty) => ["unpaid", "pending", "pending_payment"].includes(penalty.status));
  const openPenaltyAmount = openPenalties.reduce((sum, penalty) => sum + penalty.amount, 0);
  const recentAuditEvents = [...auditEvents]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, DASHBOARD_CONFIG.AUDIT_PREVIEW_LIMIT);

  const riskSignals = failedPayments.length + openTickets.length + overdueUtilities.length + openPenalties.length + pendingVendors.length;

  const runtimeRows: SettingRow[] = [
    {
      label: "Frontend mode",
      value: import.meta.env.MODE,
      detail: import.meta.env.PROD ? "Production" : "Development",
      tone: import.meta.env.PROD ? "success" : "info",
    },
    {
      label: "API base URL",
      value: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001",
      detail: "Client",
      tone: "info",
    },
    {
      label: "Workspace scope",
      value: user?.role === "admin" ? "All markets" : user?.marketName || "Assigned scope",
      detail: user?.role || "Role",
      tone: "success",
    },
    {
      label: "Uploaded file storage",
      value: "Backend controlled local runtime storage with optional Supabase storage",
      detail: "Server",
      tone: "default",
    },
  ];

  const accessRows: SettingRow[] = [
    {
      label: "Vendor approval guard",
      value: "Enabled",
      detail: `${pendingVendors.length} pending`,
      tone: pendingVendors.length ? "warning" : "success",
    },
    {
      label: "Privileged MFA",
      value: "Supported for manager, official, and admin login challenges",
      detail: "Auth",
      tone: "success",
    },
    {
      label: "Staff accounts",
      value: numberFormatter.format(staffUsers.length),
      detail: `${staffUsers.filter((staff) => staff.status === "active").length} active`,
      tone: "info",
    },
    {
      label: "Activity retention",
      value: "Database-backed activity record trail",
      detail: `${auditEvents.length} loaded`,
      tone: auditEvents.length ? "success" : "default",
    },
  ];

  const bookingRows: SettingRow[] = [
    {
      label: "Booking review",
      value: "Manager review is required before stall allocation is finalized",
      detail: "Policy",
      tone: "success",
    },
    {
      label: "Renewal warning window",
      value: `${DASHBOARD_CONFIG.RENEWAL_WARNING_DAYS} days`,
      detail: "Reminder",
      tone: "info",
    },
    {
      label: "Multi-stall threshold",
      value: `${DASHBOARD_CONFIG.MULTI_STALL_LIMIT} active stall per vendor before admin review`,
      detail: "Review",
      tone: "warning",
    },
  ];

  const refreshRows: SettingRow[] = [
    {
      label: "Payment refresh",
      value: formatMilliseconds(DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL),
      detail: "Realtime",
      tone: "info",
    },
    {
      label: "Utility refresh",
      value: formatMilliseconds(DASHBOARD_CONFIG.UTILITIES_REFRESH_INTERVAL),
      detail: "Realtime",
      tone: "info",
    },
    {
      label: "Notification refresh",
      value: formatMilliseconds(DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL),
      detail: "Inbox",
      tone: "info",
    },
    {
      label: "Static cache",
      value: formatMilliseconds(DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME),
      detail: "Reference data",
      tone: "default",
    },
  ];

  const thresholdRows = useMemo(
    () =>
      Object.entries(DASHBOARD_CONFIG.MARKET_RISK_THRESHOLDS).map(([key, value]) => ({
        label: formatSettingKey(key),
        value: typeof value === "number" && key.includes("UTILITIES_DUE") ? formatCurrency(value) : numberFormatter.format(value),
        detail: "Risk",
        tone: "warning" as const,
      })),
    [],
  );

  const settingsNavItems = [
    { label: "Runtime", icon: Server, target: "runtime-settings", count: runtimeRows.length },
    { label: "Access", icon: ShieldCheck, target: "access-settings", count: pendingVendors.length },
    { label: "Billing", icon: CreditCard, target: "billing-settings", count: chargeTypes.length },
    { label: "Rules", icon: Settings, target: "rules-settings", count: bookingRows.length + thresholdRows.length },
    { label: "Integrations", icon: Database, target: "integrations-settings", count: 4 },
  ];

  if (isLoading) {
    return (
      <ConsolePage>
        <LoadingState rows={1} itemClassName="h-28 rounded-xl" />
        <LoadingState rows={4} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" itemClassName="h-28 rounded-xl" />
        <LoadingState rows={4} className="grid gap-3 xl:grid-cols-2" itemClassName="h-72 rounded-xl" />
      </ConsolePage>
    );
  }

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Admin workspace"
        title="System Settings"
        description="Read-only configuration view for runtime, access, billing, refresh intervals, and rules."
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">{markets.length} markets</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{staffUsers.length} staff accounts</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{chargeTypes.length} billing switches</span>
          </>
        }
      />

      <section className="settings-layout">
        <aside className="settings-nav-panel">
          <div className="mb-2 px-2 py-1">
            <p className="text-xs font-semibold text-muted-foreground">Configuration areas</p>
          </div>
          {settingsNavItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setActiveSettingsSection(item.target);
                document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn("settings-nav-button", item.target === activeSettingsSection && "is-active")}
              aria-current={item.target === activeSettingsSection ? "true" : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span className="min-w-0 flex-1">{item.label}</span>
              <span>{numberFormatter.format(item.count)}</span>
            </button>
          ))}
          <div className="mt-3 rounded-md bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">System summary</p>
            <p className="mt-2 text-2xl font-bold leading-none font-heading">{riskSignals}</p>
            <p className="mt-1 text-xs text-muted-foreground">active risk signals</p>
          </div>
        </aside>

        <div className="settings-content">
          <section className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
            <div id="runtime-settings" className="scroll-mt-24">
              <DashboardErrorBoundary>
              <Panel
                title="Runtime Configuration"
                description="Client-visible runtime state and backend-controlled infrastructure switches."
                actions={<Server className="h-4 w-4 text-muted-foreground" />}
                contentClassName="grid gap-3"
              >
                {runtimeRows.map((row) => (
                  <SettingCard key={row.label} row={row} />
                ))}
              </Panel>
              </DashboardErrorBoundary>
            </div>

            <div id="access-settings" className="scroll-mt-24">
              <DashboardErrorBoundary>
              <Panel
                title="Access"
                description="Role controls, approval gates, and activity record availability."
                actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                contentClassName="grid gap-3"
              >
                {accessRows.map((row) => (
                  <SettingCard key={row.label} row={row} />
                ))}
              </Panel>
              </DashboardErrorBoundary>
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
            <div id="billing-settings" className="scroll-mt-24">
              <DashboardErrorBoundary>
              <Panel
                title="Billing Configuration"
                description="Charge availability that controls payments due and receipt workflows."
                actions={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                contentClassName="space-y-3"
              >
            {chargeTypes.length === 0 ? (
              <EmptyState title="No billing switches configured" description="Charge type records will appear here after seed or setup." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {chargeTypes.map((chargeType) => (
                  <SettingCard
                    key={chargeType.id}
                    row={{
                      label: chargeType.displayName,
                      value: `${chargeType.scope === "market" ? "Market" : "Global"} switch`,
                      detail: chargeType.isEnabled ? "Enabled" : "Disabled",
                      tone: getChargeTone(chargeType),
                    }}
                  />
                ))}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <EvidenceField
                label="Payment gateway"
                value={paymentGateway?.isEnabled === false ? "Disabled" : "Enabled"}
              />
            <EvidenceField
              label="Manual receipts"
              value="Supported with staff verification"
            />
          </div>
              </Panel>
              </DashboardErrorBoundary>
            </div>

            <div id="rules-settings" className="scroll-mt-24">
              <DashboardErrorBoundary>
              <Panel
                title="Rules"
                description="Booking and market review settings currently enforced by the app."
                actions={<Settings className="h-4 w-4 text-muted-foreground" />}
                contentClassName="grid gap-3"
              >
            {bookingRows.map((row) => (
              <SettingCard key={row.label} row={row} />
            ))}
              </Panel>
              </DashboardErrorBoundary>
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <DashboardErrorBoundary>
              <Panel
                title="Refresh and Cache Policy"
                description="Frontend data freshness rules used by dashboards and operational pages."
                actions={<Clock className="h-4 w-4 text-muted-foreground" />}
                contentClassName="grid gap-3 md:grid-cols-2"
              >
            {refreshRows.map((row) => (
              <SettingCard key={row.label} row={row} />
            ))}
              </Panel>
            </DashboardErrorBoundary>

            <DashboardErrorBoundary>
              <Panel
                title="Risk Thresholds"
                description="Numeric thresholds used for market health and exception escalation."
                actions={<Gauge className="h-4 w-4 text-muted-foreground" />}
                contentClassName="grid gap-3 md:grid-cols-2"
              >
            {thresholdRows.map((row) => (
              <SettingCard key={row.label} row={row} />
            ))}
              </Panel>
            </DashboardErrorBoundary>
          </section>

          <section className="grid gap-3 xl:grid-cols-[0.9fr_1fr]">
            <div id="integrations-settings" className="scroll-mt-24">
              <DashboardErrorBoundary>
              <Panel
                title="Integration Readiness"
                description="External services and server-side features this system expects."
                actions={<Database className="h-4 w-4 text-muted-foreground" />}
                contentClassName="grid gap-3"
              >
            <SettingCard
              row={{
                label: "Database",
                value: "PostgreSQL via the backend API",
                detail: "Required",
                tone: "success",
              }}
            />
            <SettingCard
              row={{
                label: "Pesapal",
                value: "Gateway checkout and IPN callbacks are configured server-side",
                detail: paymentGateway?.isEnabled === false ? "Paused" : "Ready",
                tone: paymentGateway?.isEnabled === false ? "warning" : "success",
              }}
            />
            <SettingCard
              row={{
                label: "Africa's Talking",
                value: "SMS credentials are loaded by the backend when provided",
                detail: "Optional",
                tone: "default",
              }}
            />
            <SettingCard
              row={{
                label: "Notifications",
                value: "In-app delivery with background retry processing",
                detail: "Active",
                tone: "success",
              }}
            />
              </Panel>
              </DashboardErrorBoundary>
            </div>

            <DashboardErrorBoundary>
              <Panel
                title="Attention Snapshot"
                description="Live records that make configuration risk visible."
                actions={<Bell className="h-4 w-4 text-muted-foreground" />}
                contentClassName="space-y-3"
              >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <EvidenceField label="Failed payments" value={failedPayments.length} />
              <EvidenceField label="Open tickets" value={openTickets.length} />
              <EvidenceField label="Overdue utilities" value={overdueUtilities.length} />
              <EvidenceField label="Open penalties" value={formatCurrency(openPenaltyAmount)} />
            </div>

            <div className="space-y-2">
              <p className="section-eyebrow">Recent activity records</p>
              {recentAuditEvents.length === 0 ? (
                <EmptyState title="No activity records loaded" />
              ) : (
                recentAuditEvents.map((event) => (
                  <RecordCard key={event.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="status-badge border-info/20 bg-info/10 text-info">
                            {event.actorRole.charAt(0).toUpperCase() + event.actorRole.slice(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">{event.entityType}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{event.action.replace(/_/g, " ")}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {event.actorName} - {event.marketName || "System"}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">{formatHumanDateTime(event.createdAt)}</p>
                    </div>
                  </RecordCard>
                ))
              )}
            </div>
              </Panel>
            </DashboardErrorBoundary>
          </section>

          <div className="rounded-lg bg-info/10 px-3 py-2 text-sm text-info">
            This page is intentionally read-only. Change operational controls through the dedicated billing, user management, and backend environment workflows.
          </div>
        </div>
      </section>
    </ConsolePage>
  );
};

export default SystemSettingsPage;
