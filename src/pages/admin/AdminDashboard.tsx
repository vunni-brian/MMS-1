import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Landmark, Store, Users, Wallet } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailSheet, EmptyState, EvidenceField, KpiStrip, LoadingState, PageHeader, Panel, RecordCard } from "@/components/console/ConsolePage";
import type { AuditEvent, ChargeTypeName, Market, Payment, Role, Ticket } from "@/types";

type RegionId = "central" | "western" | "eastern" | "northern";
type MarketStatus = "Healthy" | "Warning" | "Critical";
type AlertSeverity = "High" | "Medium" | "Low";

interface UserRoleRow {
  id: string;
  name: string;
  role: Role;
  market: string;
  status: string;
  lastActive: string;
}

const regionKeywords: Record<RegionId, string[]> = {
  central: ["kampala", "central", "wakiso", "mukono", "masaka", "mityana", "mpigi", "luwero", "kayunga", "mubende", "kisenyi"],
  western: ["western", "mbarara", "fort portal", "hoima", "kabale", "kasese", "masindi", "bushenyi", "ntungamo", "ibanda"],
  eastern: ["eastern", "jinja", "mbale", "tororo", "soroti", "iganga", "busia", "pallisa", "kapchorwa", "jin"],
  northern: ["northern", "gulu", "lira", "arua", "kitgum", "moroto", "nebbi", "adjumani", "apac"],
};

const regionLabels: Record<RegionId, string> = {
  central: "Central",
  western: "Western",
  eastern: "Eastern",
  northern: "Northern",
};

const chargeTypeLabels: Record<ChargeTypeName, string> = {
  market_dues: "Market dues",
  utilities: "Utilities",
  penalties: "Penalties",
  booking_fee: "Booking fee",
  payment_gateway: "Payment gateway",
};

const riskStatuses = new Set(["unpaid", "pending", "pending_payment", "overdue"]);

const getMarketRegion = (market: Market): RegionId => {
  const value = `${market.name} ${market.code} ${market.location}`.toLowerCase();
  const match = (Object.keys(regionKeywords) as RegionId[]).find((region) =>
    regionKeywords[region].some((keyword) => value.includes(keyword)),
  );
  return match || "central";
};

const getMarketStatus = ({
  utilitiesDue,
  failedPayments,
  complaints,
  penalties,
}: {
  utilitiesDue: number;
  failedPayments: number;
  complaints: number;
  penalties: number;
}): MarketStatus => {
  if (failedPayments >= 3 || complaints >= 5 || penalties >= 3 || utilitiesDue >= 2_000_000) {
    return "Critical";
  }
  if (failedPayments > 0 || complaints > 0 || penalties > 0 || utilitiesDue > 0) {
    return "Warning";
  }
  return "Healthy";
};

const statusClassName = (status: MarketStatus) => {
  if (status === "Healthy") return "status-badge border-success/20 bg-success/15 text-success";
  if (status === "Warning") return "status-badge border-warning/25 bg-warning/15 text-warning";
  return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
};

const severityClassName = (severity: AlertSeverity) => {
  if (severity === "High") return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
  if (severity === "Medium") return "status-badge border-warning/25 bg-warning/15 text-warning";
  return "status-badge border-border bg-muted text-muted-foreground";
};

const formatAction = (action: string) =>
  action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

const getPaymentReference = (payment: Payment) =>
  payment.providerReference || payment.transactionId || payment.externalReference || "Awaiting reference";

const getPaymentPurpose = (payment: Payment) => {
  if (payment.description?.trim()) return payment.description;
  if (payment.stallName) return `Stall ${payment.stallName}`;
  return chargeTypeLabels[payment.chargeType];
};

const getActorLastActive = (auditEvents: AuditEvent[]) =>
  auditEvents.reduce<Record<string, string>>((accumulator, event) => {
    const key = `${event.actorName}-${event.actorRole}`;
    if (
      !accumulator[key] ||
      new Date(event.createdAt).getTime() > new Date(accumulator[key]).getTime()
    ) {
      accumulator[key] = event.createdAt;
    }
    return accumulator;
  }, {});

const AdminDashboard = () => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<UserRoleRow | null>(null);

  const { data: marketsData, isPending: marketsPending } = useQuery({
    queryKey: ["markets", "admin-dashboard"],
    queryFn: () => api.getMarkets(),
  });

  const { data: stallsData, isPending: stallsPending } = useQuery({
    queryKey: ["stalls", "admin-dashboard"],
    queryFn: () => api.getStalls(),
  });

  const { data: vendorsData, isPending: vendorsPending } = useQuery({
    queryKey: ["vendors", "admin-dashboard"],
    queryFn: () => api.getVendors(),
  });

  const { data: paymentsData, isPending: paymentsPending } = useQuery({
    queryKey: ["payments", "admin-dashboard"],
    queryFn: () => api.getPayments(),
    refetchInterval: 10_000,
  });

  const { data: ticketsData, isPending: ticketsPending } = useQuery({
    queryKey: ["tickets", "admin-dashboard"],
    queryFn: () => api.getTickets(),
  });

  const { data: utilityChargesData, isPending: utilityChargesPending } = useQuery({
    queryKey: ["utility-charges", "admin-dashboard"],
    queryFn: () => api.getUtilityCharges(),
  });

  const { data: penaltiesData, isPending: penaltiesPending } = useQuery({
    queryKey: ["penalties", "admin-dashboard"],
    queryFn: () => api.getPenalties(),
  });

  const { data: chargeTypesData, isPending: chargeTypesPending } = useQuery({
    queryKey: ["charge-types", "admin-dashboard"],
    queryFn: () => api.getChargeTypes(),
  });

  const { data: auditData, isPending: auditPending } = useQuery({
    queryKey: ["audit", "admin-dashboard"],
    queryFn: () => api.getAudit(),
  });

  const markets = marketsData?.markets || [];
  const stalls = stallsData?.stalls || [];
  const vendors = vendorsData?.vendors || [];
  const payments = paymentsData?.payments || [];
  const tickets = ticketsData?.tickets || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const penalties = penaltiesData?.penalties || [];
  const chargeTypes = chargeTypesData?.chargeTypes || [];
  const auditEvents = auditData?.events || [];

  const isDashboardLoading =
    marketsPending ||
    stallsPending ||
    vendorsPending ||
    paymentsPending ||
    ticketsPending ||
    utilityChargesPending ||
    penaltiesPending ||
    chargeTypesPending ||
    auditPending;

  if (isDashboardLoading) {
    return (
      <div className="space-y-4 lg:space-y-5">
        <LoadingState rows={1} itemClassName="h-28 rounded-xl" />
        <LoadingState
          rows={5}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          itemClassName="h-28 rounded-xl"
        />
        <LoadingState rows={2} itemClassName="h-[360px] rounded-xl" />
        <LoadingState
          rows={2}
          className="grid gap-4 xl:grid-cols-2"
          itemClassName="h-[360px] rounded-xl"
        />
      </div>
    );
  }

  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const failedPayments = payments.filter((payment) => payment.status === "failed");
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const activeStalls = stalls.filter((stall) => stall.status === "active");
  const openTickets = tickets.filter((ticket) => ticket.status !== "resolved");
  const unpaidUtilities = utilityCharges.filter((charge) => riskStatuses.has(charge.status));
  const unpaidUtilityAmount = unpaidUtilities.reduce((sum, charge) => sum + charge.amount, 0);
  const openPenalties = penalties.filter(
    (penalty) =>
      penalty.status === "unpaid" ||
      penalty.status === "pending" ||
      penalty.status === "pending_payment",
  );
  const openPenaltyAmount = openPenalties.reduce((sum, penalty) => sum + penalty.amount, 0);
  const paymentGateway = chargeTypes.find((chargeType) => chargeType.name === "payment_gateway");
  const actorLastActive = getActorLastActive(auditEvents);

  const managerRows: UserRoleRow[] = markets
    .filter((market) => market.managerName)
    .map((market) => ({
      id: `manager-${market.id}`,
      name: market.managerName || "Unassigned manager",
      role: "manager" as Role,
      market: market.name,
      status: "Active",
      lastActive: actorLastActive[`${market.managerName}-manager`] || "",
    }));

  const actorRows: UserRoleRow[] = auditEvents
    .filter((event) => event.actorRole === "official" || event.actorRole === "admin")
    .map((event) => ({
      id: `actor-${event.actorName}-${event.actorRole}`,
      name: event.actorName,
      role: event.actorRole,
      market: event.actorRole === "admin" ? "System" : "All markets",
      status: "Active",
      lastActive: actorLastActive[`${event.actorName}-${event.actorRole}`] || event.createdAt,
    }));

  const currentAdminRow: UserRoleRow[] = user
    ? [
      {
        id: user.id,
        name: user.name,
        role: user.role,
        market: "System",
        status: "Active",
        lastActive: "Current session",
      },
    ]
    : [];

  const vendorRows: UserRoleRow[] = vendors.slice(0, 8).map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    role: "vendor" as Role,
    market: vendor.marketName || "Unassigned",
    status:
      vendor.status === "approved"
        ? "Active"
        : vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1),
    lastActive: vendor.createdAt,
  }));

  const allUserRows = [...currentAdminRow, ...actorRows, ...managerRows, ...vendorRows].filter(
    (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index,
  );

  const userRows = allUserRows.slice(0, 5);

  const totalUserCount = new Set([
    ...allUserRows.map((row) => row.id),
    ...vendors.map((vendor) => vendor.id),
  ]).size;

  const activeStallCountsByVendor = activeStalls.reduce<
    Record<string, { vendor: string; count: number; market: string }>
  >((accumulator, stall) => {
    if (!stall.vendorId) return accumulator;

    const current = accumulator[stall.vendorId] || {
      vendor: stall.vendorName || "Unknown vendor",
      count: 0,
      market: stall.marketName || "Assigned market",
    };

    current.count += 1;
    accumulator[stall.vendorId] = current;
    return accumulator;
  }, {});

  const alerts = [
    ...Object.entries(activeStallCountsByVendor)
      .filter(([, item]) => item.count > 1)
      .map(([, item]) => ({
        id: `multi-stall-${item.vendor}`,
        alert: `${item.vendor} has ${item.count} active stalls`,
        type: "Rule violation",
        severity: "High" as AlertSeverity,
        action: "Review",
        path: "/admin/audit",
      })),
    ...failedPayments.slice(0, 3).map((payment) => ({
      id: `failed-payment-${payment.id}`,
      alert: `${payment.vendorName} payment failed`,
      type: "Financial",
      severity: "Medium" as AlertSeverity,
      action: "Investigate",
      path: "/admin/audit",
    })),
    ...(unpaidUtilityAmount > 0
      ? [
        {
          id: "unpaid-utilities",
          alert: `${formatCurrency(unpaidUtilityAmount)} utilities remain unpaid`,
          type: "Billing",
          severity:
            unpaidUtilityAmount >= 2_000_000
              ? ("High" as AlertSeverity)
              : ("Medium" as AlertSeverity),
          action: "Review",
          path: "/admin/billing",
        },
      ]
      : []),
    ...(openPenaltyAmount > 0
      ? [
        {
          id: "open-penalties",
          alert: `${formatCurrency(openPenaltyAmount)} penalties remain unresolved`,
          type: "Audit",
          severity: openPenaltyAmount >= 1_000_000 ? ("High" as AlertSeverity) : ("Medium" as AlertSeverity),
          action: "Review",
          path: "/admin/billing",
        },
      ]
      : []),
    ...(paymentGateway && !paymentGateway.isEnabled
      ? [
        {
          id: "gateway-disabled",
          alert: "Payment gateway is disabled",
          type: "Infrastructure",
          severity: "High" as AlertSeverity,
          action: "Enable",
          path: "/admin/billing",
        },
      ]
      : []),
    ...openTickets
      .filter((ticket) => ticket.category === "billing" || ticket.category === "dispute")
      .slice(0, 2)
      .map((ticket: Ticket) => ({
        id: `ticket-${ticket.id}`,
        alert: ticket.subject,
        type: "Complaint",
        severity: ticket.category === "dispute" ? ("High" as AlertSeverity) : ("Medium" as AlertSeverity),
        action: "Review",
        path: "/admin/audit",
      })),
  ].slice(0, 5);

  const marketRows = markets.map((market) => {
    const marketPayments = payments.filter((payment) => payment.marketId === market.id);
    const marketUtilities = utilityCharges.filter((charge) => charge.marketId === market.id);
    const marketTickets = tickets.filter(
      (ticket) => ticket.marketId === market.id && ticket.status !== "resolved",
    );
    const marketPenalties = penalties.filter(
      (penalty) =>
        penalty.marketId === market.id &&
        ["unpaid", "pending", "pending_payment"].includes(penalty.status),
    );

    const revenue = marketPayments
      .filter((payment) => payment.status === "completed")
      .reduce((sum, payment) => sum + payment.amount, 0);

    const utilitiesDue = marketUtilities
      .filter((charge) => riskStatuses.has(charge.status))
      .reduce((sum, charge) => sum + charge.amount, 0);

    const failed = marketPayments.filter((payment) => payment.status === "failed").length;

    return {
      id: market.id,
      market: market.name,
      region: regionLabels[getMarketRegion(market)],
      vendors: market.vendorCount,
      revenue,
      utilitiesDue,
      status: getMarketStatus({
        utilitiesDue,
        failedPayments: failed,
        complaints: marketTickets.length,
        penalties: marketPenalties.length,
      }),
    };
  });

  const recentPayments = [...payments]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 3);

  const recentAuditRows = [...auditEvents]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5);

  const kpis = [
    {
      label: "Total Users",
      value: totalUserCount.toLocaleString(),
      detail: "Known platform users and actors",
      icon: Users,
    },
    {
      label: "Total Markets",
      value: markets.length.toLocaleString(),
      detail: "Across all regions",
      icon: Store,
    },
    {
      label: "Total Active Stalls",
      value: activeStalls.length.toLocaleString(),
      detail: `${stalls.length.toLocaleString()} total registered stalls`,
      icon: Landmark,
    },
    {
      label: "Total Revenue",
      value: formatCurrency(totalRevenue),
      detail: "Confirmed payments across all markets",
      icon: Wallet,
    },
    {
      label: "System Alerts",
      value: alerts.length.toLocaleString(),
      detail: "Require attention",
      icon: AlertTriangle,
    },
  ];

  const systemHealth = [
    {
      label: "Payment gateway",
      value: paymentGateway?.isEnabled === false ? "Disabled" : "Online",
      detail: paymentGateway?.isEnabled === false ? "Collections paused" : "Collections available",
      tone: paymentGateway?.isEnabled === false ? "destructive" : "success",
    },
    {
      label: "Penalty exposure",
      value: formatCurrency(openPenaltyAmount),
      detail: openPenaltyAmount === 0 ? "Clear" : `${openPenalties.length} open`,
      tone: openPenaltyAmount === 0 ? "success" : "warning",
    },
    {
      label: "Failed payments",
      value: failedPayments.length.toLocaleString(),
      detail: "Recent failed transactions",
      tone: failedPayments.length ? "warning" : "success",
    },
    {
      label: "Open cases",
      value: openTickets.length.toLocaleString(),
      detail: "Unresolved complaints",
      tone: openTickets.length ? "warning" : "success",
    },
  ];

  const quickActions = [
    { label: "Audit trail", path: "/admin/audit" },
    { label: "Billing controls", path: "/admin/billing" },
    { label: "Reports", path: "/admin/reports" },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Admin workspace"
        title="System Administration"
        description="Compact control center for markets, users, financial exceptions, and audit activity."
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">{markets.length} markets</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{alerts.length} alerts</span>
          </>
        }
      />

      <KpiStrip items={kpis} columns="grid-cols-2 md:grid-cols-3 xl:grid-cols-5" />

      <section className="grid gap-3 xl:grid-cols-[1.45fr_0.75fr]">
        <Panel
          title="Attention Queue"
          description="Critical exceptions and the latest governance actions."
          actions={
            <Button asChild variant="ghost" size="sm" className="h-auto px-0">
              <Link to="/admin/audit">Audit trail</Link>
            </Button>
          }
          contentClassName="grid gap-3 lg:grid-cols-2"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Flagged issues</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{alerts.length}</span>
            </div>
            {alerts.length === 0 ? (
              <EmptyState title="No system alerts" description="Exceptions will appear here when they need action." />
            ) : (
              alerts.slice(0, 4).map((alert) => (
                <RecordCard key={alert.id} className="p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={severityClassName(alert.severity)}>{alert.severity}</span>
                        <span className="text-xs text-muted-foreground">{alert.type}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">{alert.alert}</p>
                    </div>
                    <Button asChild size="sm" variant={alert.severity === "High" ? "default" : "outline"} className="h-7 shrink-0 px-2 text-xs">
                      <Link to={alert.path}>{alert.action}</Link>
                    </Button>
                  </div>
                </RecordCard>
              ))
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent activity</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{recentAuditRows.length}</span>
            </div>
            {recentAuditRows.length === 0 ? (
              <EmptyState title="No activity yet" description="Audit events will appear as staff use the system." />
            ) : (
              recentAuditRows.slice(0, 5).map((event) => (
                <RecordCard key={event.id} className="p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{formatAction(event.action)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {event.actorName} - {event.marketName || "System"}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-muted-foreground">
                      {formatHumanDateTime(event.createdAt)}
                    </p>
                  </div>
                </RecordCard>
              ))
            )}
          </div>
        </Panel>

        <Panel title="System Health" description="Controls and signals administrators check first." contentClassName="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {systemHealth.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{item.value}</p>
                </div>
                <span
                  className={
                    item.tone === "success"
                      ? "status-badge border-success/20 bg-success/15 text-success"
                      : item.tone === "destructive"
                        ? "status-badge border-destructive/20 bg-destructive/15 text-destructive"
                        : "status-badge border-warning/25 bg-warning/15 text-warning"
                  }
                >
                  {item.detail}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            {quickActions.map((action) => (
              <Button key={action.path} asChild variant="outline" size="sm" className="justify-start">
                <Link to={action.path}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Market Operating Snapshot" description="Compact market status for quick regional triage." contentClassName="max-h-[310px] overflow-auto p-0">
          {marketRows.length === 0 ? (
            <div className="p-3">
              <EmptyState title="No markets registered" description="Market governance indicators will appear after setup." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Market</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Vendors</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Utilities</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketRows.map((market) => (
                  <TableRow key={market.id} className="text-xs">
                    <TableCell className="font-medium">{market.market}</TableCell>
                    <TableCell className="text-muted-foreground">{market.region}</TableCell>
                    <TableCell className="text-right">{market.vendors}</TableCell>
                    <TableCell className="text-right">{formatCurrency(market.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(market.utilitiesDue)}</TableCell>
                    <TableCell>
                      <span className={statusClassName(market.status)}>{market.status}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title="People & Payments" description="Recent access actors and collection movement." contentClassName="grid gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Users</p>
              <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs">
                <Link to="/admin/audit">Review</Link>
              </Button>
            </div>
            {userRows.length === 0 ? (
              <EmptyState title="No user activity" />
            ) : (
              userRows.slice(0, 3).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedUser(row)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-background p-2.5 text-left hover:bg-muted/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.role} - {row.market}</span>
                  </span>
                  <span className={row.status === "Active" ? "status-badge border-success/20 bg-success/15 text-success" : "status-badge border-warning/25 bg-warning/15 text-warning"}>
                    {row.status}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent payments</p>
            {recentPayments.length === 0 ? (
              <EmptyState title="No payment records" />
            ) : (
              recentPayments.map((payment) => (
                <RecordCard key={payment.id} className="p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{payment.vendorName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{getPaymentPurpose(payment)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatCurrency(payment.amount)}</p>
                      <StatusBadge status={payment.status} context="payment" />
                    </div>
                  </div>
                </RecordCard>
              ))
            )}
          </div>
        </Panel>
      </section>

      <DetailSheet
        open={Boolean(selectedUser)}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
        title={selectedUser?.name || "User record"}
        description="Role, scope, and recent activity evidence for governance review."
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceField
                label="Role"
                value={<span className="capitalize">{selectedUser.role}</span>}
              />
              <EvidenceField label="Assigned Scope" value={selectedUser.market} />
              <EvidenceField label="Status" value={selectedUser.status} />
              <EvidenceField
                label="Last Active"
                value={
                  selectedUser.lastActive === "Current session"
                    ? selectedUser.lastActive
                    : formatHumanDateTime(selectedUser.lastActive)
                }
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium">Governance actions</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use the audit trail for evidence review. Role changes and deactivation should stay in a dedicated user-management workflow when that surface is enabled.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/admin/audit">Open Audit Trail</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </DetailSheet>
    </div>
  );
};

export default AdminDashboard;
