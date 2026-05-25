import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, Search, ShieldAlert } from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ConsolePage,
  EmptyState,
  LoadingState,
  WorkspacePage,
} from "@/components/console/ConsolePage";

type AlertSeverity = "critical" | "warning" | "info";
type AlertStatus = "open" | "watching" | "resolved";
type AlertType = "all" | "payments" | "complaints" | "billing" | "system";

interface AdminAlert {
  id: string;
  title: string;
  detail: string;
  type: Exclude<AlertType, "all">;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  createdAt: string;
  path: string;
}

const severityClassName = (severity: AlertSeverity) => {
  if (severity === "critical") return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
  if (severity === "warning") return "status-badge border-warning/25 bg-warning/15 text-warning";
  return "status-badge border-info/20 bg-info/15 text-info";
};

const statusClassName = (status: AlertStatus) => {
  if (status === "resolved") return "status-badge border-success/20 bg-success/15 text-success";
  if (status === "watching") return "status-badge border-info/20 bg-info/15 text-info";
  return "status-badge border-border bg-muted text-muted-foreground";
};

const AdminAlertsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AlertType>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertSeverity>("all");

  const paymentsQuery = useQuery({
    queryKey: ["payments", "admin-alerts-page"],
    queryFn: () => api.getPayments(),
    refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "admin-alerts-page"],
    queryFn: () => api.getTickets(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const utilityChargesQuery = useQuery({
    queryKey: ["utility-charges", "admin-alerts-page"],
    queryFn: () => api.getUtilityCharges(),
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const penaltiesQuery = useQuery({
    queryKey: ["penalties", "admin-alerts-page"],
    queryFn: () => api.getPenalties(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const chargeTypesQuery = useQuery({
    queryKey: ["charge-types", "admin-alerts-page"],
    queryFn: () => api.getChargeTypes(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const auditQuery = useQuery({
    queryKey: ["audit", "admin-alerts-page"],
    queryFn: () => api.getAudit(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const payments = useMemo(() => paymentsQuery.data?.payments ?? [], [paymentsQuery.data?.payments]);
  const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data?.tickets]);
  const utilityCharges = useMemo(() => utilityChargesQuery.data?.utilityCharges ?? [], [utilityChargesQuery.data?.utilityCharges]);
  const penalties = useMemo(() => penaltiesQuery.data?.penalties ?? [], [penaltiesQuery.data?.penalties]);
  const chargeTypes = useMemo(() => chargeTypesQuery.data?.chargeTypes ?? [], [chargeTypesQuery.data?.chargeTypes]);
  const auditEvents = useMemo(() => auditQuery.data?.events ?? [], [auditQuery.data?.events]);

  const hasLoadedAlertData =
    paymentsQuery.isSuccess ||
    ticketsQuery.isSuccess ||
    utilityChargesQuery.isSuccess ||
    penaltiesQuery.isSuccess ||
    chargeTypesQuery.isSuccess ||
    auditQuery.isSuccess;
  const isLoading =
    !hasLoadedAlertData &&
    (paymentsQuery.isPending ||
      ticketsQuery.isPending ||
      utilityChargesQuery.isPending ||
      penaltiesQuery.isPending ||
      chargeTypesQuery.isPending ||
      auditQuery.isPending);

  const alerts = useMemo<AdminAlert[]>(() => {
    const paymentAlerts = payments
      .filter((payment) => payment.status === "failed")
      .map((payment) => ({
        id: `payment-${payment.id}`,
        title: "Payment failed",
        detail: `${payment.vendorName} - ${formatCurrency(payment.amount)}`,
        type: "payments" as const,
        severity: "warning" as const,
        status: "open" as const,
        source: payment.marketName || "All markets",
        createdAt: payment.updatedAt || payment.createdAt,
        path: "/admin/reports",
      }));

    const complaintAlerts = tickets
      .filter((ticket) => ticket.status !== "resolved" && (ticket.priority === "high" || ticket.priority === "urgent" || ticket.breachedSla))
      .map((ticket) => ({
        id: `ticket-${ticket.id}`,
        title: ticket.breachedSla ? "Complaint SLA missed" : "High priority complaint",
        detail: ticket.subject,
        type: "complaints" as const,
        severity: ticket.priority === "urgent" || ticket.breachedSla ? ("critical" as const) : ("warning" as const),
        status: ticket.status === "in_progress" ? ("watching" as const) : ("open" as const),
        source: ticket.marketName || "Market not set",
        createdAt: ticket.updatedAt || ticket.createdAt,
        path: "/admin/audit",
      }));

    const utilityAlerts = utilityCharges
      .filter((charge) => charge.status === "overdue")
      .map((charge) => ({
        id: `utility-${charge.id}`,
        title: "Payment due is overdue",
        detail: `${charge.vendorName} - ${formatCurrency(charge.amount)}`,
        type: "billing" as const,
        severity: charge.amount > 750_000 ? ("critical" as const) : ("warning" as const),
        status: "open" as const,
        source: charge.marketName || "Market not set",
        createdAt: charge.updatedAt || charge.createdAt,
        path: "/admin/billing",
      }));

    const penaltyAmount = penalties
      .filter((penalty) => ["unpaid", "pending", "pending_payment"].includes(penalty.status))
      .reduce((sum, penalty) => sum + penalty.amount, 0);

    const penaltyAlert =
      penaltyAmount > 0
        ? [
          {
            id: "open-penalties",
            title: "Open penalty exposure",
            detail: `${formatCurrency(penaltyAmount)} still unresolved`,
            type: "billing" as const,
            severity: penaltyAmount > 1_500_000 ? ("critical" as const) : ("warning" as const),
            status: "watching" as const,
            source: "Billing",
            createdAt: new Date().toISOString(),
            path: "/admin/billing",
          },
        ]
        : [];

    const gateway = chargeTypes.find((chargeType) => chargeType.name === "payment_gateway");
    const gatewayAlert =
      gateway && !gateway.isEnabled
        ? [
          {
            id: "payment-gateway",
            title: "Payment service disabled",
            detail: "Online collections are currently unavailable.",
            type: "system" as const,
            severity: "critical" as const,
            status: "open" as const,
            source: "Payment gateway",
            createdAt: gateway.updatedAt,
            path: "/admin/integrations",
          },
        ]
        : [];

    const systemActivityAlerts = auditEvents
      .filter((event) => event.action.toLowerCase().includes("failed") || event.action.toLowerCase().includes("rejected"))
      .slice(0, 4)
      .map((event) => ({
        id: `audit-${event.id}`,
        title: "System activity needs review",
        detail: `${event.actorName} - ${event.action.replace(/_/g, " ")}`,
        type: "system" as const,
        severity: "info" as const,
        status: "watching" as const,
        source: event.marketName || "System",
        createdAt: event.createdAt,
        path: "/admin/audit",
      }));

    return [...gatewayAlert, ...paymentAlerts, ...complaintAlerts, ...utilityAlerts, ...penaltyAlert, ...systemActivityAlerts]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [auditEvents, chargeTypes, payments, penalties, tickets, utilityCharges]);

  const filteredAlerts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return alerts.filter((alert) => {
      const matchesType = typeFilter === "all" || alert.type === typeFilter;
      const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
      const matchesSearch =
        !term ||
        [alert.title, alert.detail, alert.source, alert.type, alert.status]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesType && matchesSeverity && matchesSearch;
    });
  }, [alerts, search, severityFilter, typeFilter]);

  const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
  const context = `${alerts.length} alerts - ${criticalCount} critical - ${filteredAlerts.length} shown`;

  return (
    <ConsolePage>
      <WorkspacePage
        title="Alerts"
        subtitle="Review exceptions, payment failures, and operational warnings."
        context={context}
        actions={
          <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/coordination")}>
            <Bell className="h-4 w-4" />
            Notify Team
          </Button>
        }
        filters={
          <>
            <div className="w-full min-w-[220px] flex-1 lg:max-w-[420px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search source, title, detail..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-[180px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as AlertType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="payments">Payments</SelectItem>
                  <SelectItem value="complaints">Complaints</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[180px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Severity</label>
              <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as "all" | AlertSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        }
      >
        {isLoading ? (
          <div className="p-4">
            <LoadingState rows={6} itemClassName="h-14 rounded-lg" />
          </div>
        ) : (
          <div className="admin-alert-layout">
            <section className="min-w-0">
              {filteredAlerts.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No alerts found"
                    description="There are no current alerts matching these filters."
                    icon={ShieldAlert}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alert</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="min-w-[260px]">
                            <div className="flex items-start gap-3">
                              <span className="admin-alert-dot" data-severity={alert.severity}>
                                <AlertTriangle className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block font-medium">{alert.title}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">{alert.detail}</span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{alert.type}</TableCell>
                          <TableCell>
                            <span className={severityClassName(alert.severity)}>{alert.severity}</span>
                          </TableCell>
                          <TableCell>
                            <span className={statusClassName(alert.status)}>{alert.status}</span>
                          </TableCell>
                          <TableCell>{alert.source}</TableCell>
                          <TableCell>{formatHumanDateTime(alert.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link to={alert.path}>Review</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <aside className="admin-alert-side-panel">
              <div>
                <p className="text-sm font-semibold font-heading">Notification Rules</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Quiet defaults for admin attention routing.</p>
              </div>
              {[
                ["Critical alerts", true],
                ["Payment failures", true],
                ["Daily summary", true],
                ["Low priority updates", false],
              ].map(([label, checked]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2">
                  <span className="text-sm">{label}</span>
                  <Switch defaultChecked={Boolean(checked)} />
                </div>
              ))}
            </aside>
          </div>
        )}
      </WorkspacePage>
    </ConsolePage>
  );
};

export default AdminAlertsPage;
