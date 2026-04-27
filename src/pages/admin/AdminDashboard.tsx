import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Landmark, Store, Users, Wallet } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailSheet, EmptyState, EvidenceField, LoadingState } from "@/components/console/ConsolePage";
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
  central: ["kampala", "central", "wakiso", "mukono", "masaka", "mityana", "mpigi", "luwero", "kayunga", "mubende", "testbed", "demo"],
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

  const { data: financialAuditData, isPending: financialAuditPending } = useQuery({
    queryKey: ["financial-audit", "admin-dashboard"],
    queryFn: () => api.getFinancialAudit(),
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
  const auditSummary = financialAuditData?.summary || {
    variance: 0,
    collectedTotal: 0,
    depositedTotal: 0,
    from: "",
    to: "",
  };

  const isDashboardLoading =
    marketsPending ||
    stallsPending ||
    vendorsPending ||
    paymentsPending ||
    ticketsPending ||
    utilityChargesPending ||
    penaltiesPending ||
    financialAuditPending ||
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
      path: "/admin/reports",
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
    ...(auditSummary.variance !== 0
      ? [
        {
          id: "audit-variance",
          alert: `Financial audit variance is ${formatCurrency(Math.abs(auditSummary.variance))}`,
          type: "Audit",
          severity: "High" as AlertSeverity,
          action: "Reconcile",
          path: "/admin/reports",
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

  return (
    <div className="space-y-4 lg:space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:p-5">
        <h1 className="text-2xl font-bold font-heading lg:text-3xl">
          System Administration
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Monitor users, markets, financial flows, system alerts, and audit activity from one command center.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <Card key={item.label} className="stat-card">
            <CardContent className="p-3.5 lg:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg font-bold font-heading lg:text-xl">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
                </div>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">All Markets Overview</CardTitle>
          </CardHeader>

          <CardContent className="max-h-[290px] overflow-auto">
            {marketRows.length === 0 ? (
              <EmptyState
                title="No markets registered"
                description="Market-level governance and revenue indicators will appear after markets are created."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Market</TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                    <TableHead className="text-right text-xs">Vendors</TableHead>
                    <TableHead className="text-right text-xs">Revenue</TableHead>
                    <TableHead className="text-right text-xs">Utilities Due</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketRows.slice(0, 5).map((market) => (
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
          </CardContent>
        </Card>

        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Revenue Summary</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="mt-1 text-xl font-bold font-heading">
                {formatCurrency(totalRevenue)}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Unpaid Utilities</p>
              <p className="mt-1 text-xl font-bold font-heading">
                {formatCurrency(unpaidUtilityAmount)}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Open Penalties</p>
              <p className="mt-1 text-xl font-bold font-heading">
                {formatCurrency(openPenaltyAmount)}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Failed Payments</p>
              <p className="mt-1 text-xl font-bold font-heading">{failedPayments.length}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Users & Roles</CardTitle>
          </CardHeader>

          <CardContent className="max-h-[290px] overflow-auto">
            {userRows.length === 0 ? (
              <EmptyState
                title="No user activity"
                description="Admins, officials, managers, and vendors will appear after activity is recorded."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Market</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Last Active</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.map((row) => (
                    <TableRow key={row.id} className="text-xs">
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="capitalize">{row.role}</TableCell>
                      <TableCell className="text-muted-foreground">{row.market}</TableCell>
                      <TableCell>
                        <span
                          className={
                            row.status === "Active"
                              ? "status-badge border-success/20 bg-success/15 text-success"
                              : "status-badge border-warning/25 bg-warning/15 text-warning"
                          }
                        >
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.lastActive === "Current session"
                          ? row.lastActive
                          : row.lastActive
                            ? formatHumanDateTime(row.lastActive)
                            : "No recent activity"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedUser(row)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Recent Payments</CardTitle>
          </CardHeader>

          <CardContent className="max-h-[290px] overflow-auto">
            {recentPayments.length === 0 ? (
              <EmptyState
                title="No payment records"
                description="Confirmed and pending payment records will appear when markets start transacting."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Vendor</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Purpose</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id} className="text-xs">
                      <TableCell className="font-medium">{payment.vendorName}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{getPaymentPurpose(payment)}</TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} context="payment" />
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                        {getPaymentReference(payment)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">System Alerts</CardTitle>
          </CardHeader>

          <CardContent className="max-h-[290px] overflow-auto">
            {alerts.length === 0 ? (
              <EmptyState
                title="No system alerts"
                description="Rule violations, failed payments, and audit issues that need action will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Alert</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="text-xs">
                      <TableCell className="font-medium">{alert.alert}</TableCell>
                      <TableCell className="text-muted-foreground">{alert.type}</TableCell>
                      <TableCell>
                        <span className={severityClassName(alert.severity)}>{alert.severity}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          size="sm"
                          variant={alert.severity === "High" ? "default" : "outline"}
                        >
                          <Link to={alert.path}>{alert.action}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">System Activity Logs</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-auto px-0">
                <Link to="/admin/audit">View all</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="max-h-[290px] overflow-auto">
            {recentAuditRows.length === 0 ? (
              <EmptyState
                title="No system activity"
                description="Administrative and governance actions will appear as the audit trail records events."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Actor</TableHead>
                    <TableHead className="text-xs">Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAuditRows.map((event) => (
                    <TableRow key={event.id} className="text-xs">
                      <TableCell className="text-muted-foreground">
                        {formatHumanDateTime(event.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{formatAction(event.action)}</TableCell>
                      <TableCell>{event.actorName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.marketName || "System"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
                Use the audit trail for evidence review and coordination for follow-up. Role changes and deactivation should stay in a dedicated user-management workflow when that surface is enabled.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/admin/audit">Open Audit Trail</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/coordination">Open Coordination</Link>
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