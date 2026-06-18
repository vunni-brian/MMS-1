import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Bell, 
  Search, 
  ShieldAlert, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Activity
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { EmptyState, DataTableFrame } from "@/components/console/ConsolePage";

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

const severityConfig = {
  critical: { label: "admin:alerts.severity.critical", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  warning: { label: "admin:alerts.severity.warning", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle },
  info: { label: "admin:alerts.severity.info", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
};

const statusConfig = {
  open: { label: "admin:alerts.status.open", className: "bg-orange-100 text-orange-700" },
  watching: { label: "admin:alerts.status.watching", className: "bg-purple-100 text-purple-700" },
  resolved: { label: "admin:alerts.status.resolved", className: "bg-emerald-100 text-emerald-700" },
};

const AdminAlertsPage = () => {
  const { t } = useTranslation();
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
    paymentsQuery.isSuccess &&
    ticketsQuery.isSuccess &&
    utilityChargesQuery.isSuccess &&
    penaltiesQuery.isSuccess &&
    chargeTypesQuery.isSuccess &&
    auditQuery.isSuccess;

  const anyError =
    paymentsQuery.isError ||
    ticketsQuery.isError ||
    utilityChargesQuery.isError ||
    penaltiesQuery.isError ||
    chargeTypesQuery.isError ||
    auditQuery.isError;

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
        title: t("admin:alerts.paymentFailed"),
        detail: `${payment.vendorName} - ${formatCurrency(payment.amount)}`,
        type: "payments" as const,
        severity: "warning" as const,
        status: "open" as const,
        source: payment.marketName || t("admin:alerts.allMarkets"),
        createdAt: payment.updatedAt || payment.createdAt,
        path: "/admin/reports",
      }));

    const complaintAlerts = tickets
      .filter((ticket) => ticket.status !== "resolved" && (ticket.priority === "high" || ticket.priority === "urgent" || ticket.breachedSla))
      .map((ticket) => ({
        id: `ticket-${ticket.id}`,
        title: ticket.breachedSla ? t("admin:alerts.complaintSlaMissed") : t("admin:alerts.highPriorityComplaint"),
        detail: ticket.subject,
        type: "complaints" as const,
        severity: ticket.priority === "urgent" || ticket.breachedSla ? ("critical" as const) : ("warning" as const),
        status: ticket.status === "in_progress" ? ("watching" as const) : ("open" as const),
        source: ticket.marketName || t("admin:alerts.marketNotSet"),
        createdAt: ticket.updatedAt || ticket.createdAt,
        path: "/admin/audit",
      }));

    const utilityAlerts = utilityCharges
      .filter((charge) => charge.status === "overdue")
      .map((charge) => ({
        id: `utility-${charge.id}`,
        title: t("admin:alerts.paymentDueOverdue"),
        detail: `${charge.vendorName} - ${formatCurrency(charge.amount)}`,
        type: "billing" as const,
        severity: charge.amount > 750_000 ? ("critical" as const) : ("warning" as const),
        status: "open" as const,
        source: charge.marketName || t("admin:alerts.marketNotSet"),
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
              title: t("admin:alerts.openPenaltyExposure"),
              detail: t("admin:alerts.stillUnresolved", { amount: formatCurrency(penaltyAmount) }),
              type: "billing" as const,
              severity: penaltyAmount > 1_500_000 ? ("critical" as const) : ("warning" as const),
              status: "watching" as const,
              source: t("admin:alerts.billing"),
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
              title: t("admin:alerts.paymentServiceDisabled"),
              detail: t("admin:alerts.onlineCollectionsUnavailable"),
              type: "system" as const,
              severity: "critical" as const,
              status: "open" as const,
              source: t("admin:alerts.paymentGateway"),
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
        title: t("admin:alerts.systemActivityNeedsReview"),
        detail: `${event.actorName} - ${event.action.replace(/_/g, " ")}`,
        type: "system" as const,
        severity: "info" as const,
        status: "watching" as const,
        source: event.marketName || t("admin:alerts.system"),
        createdAt: event.createdAt,
        path: "/admin/audit",
      }));

    return [...gatewayAlert, ...paymentAlerts, ...complaintAlerts, ...utilityAlerts, ...penaltyAlert, ...systemActivityAlerts]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [auditEvents, chargeTypes, payments, penalties, tickets, t, utilityCharges]);

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
  const openCount = alerts.filter((alert) => alert.status === "open").length;

  const errorEntries = useMemo(() => {
    const entries: { label: string; error: Error | null; retry: () => void }[] = [];
    if (paymentsQuery.isError) entries.push({ label: t("admin:alerts.payments"), error: paymentsQuery.error as Error, retry: () => paymentsQuery.refetch() });
    if (ticketsQuery.isError) entries.push({ label: t("admin:alerts.complaints"), error: ticketsQuery.error as Error, retry: () => ticketsQuery.refetch() });
    if (utilityChargesQuery.isError) entries.push({ label: t("admin:alerts.utilityCharges"), error: utilityChargesQuery.error as Error, retry: () => utilityChargesQuery.refetch() });
    if (penaltiesQuery.isError) entries.push({ label: t("admin:alerts.penalties"), error: penaltiesQuery.error as Error, retry: () => penaltiesQuery.refetch() });
    if (chargeTypesQuery.isError) entries.push({ label: t("admin:alerts.chargeTypes"), error: chargeTypesQuery.error as Error, retry: () => chargeTypesQuery.refetch() });
    if (auditQuery.isError) entries.push({ label: t("admin:alerts.auditEvents"), error: auditQuery.error as Error, retry: () => auditQuery.refetch() });
    return entries;
  }, [paymentsQuery, ticketsQuery, utilityChargesQuery, penaltiesQuery, chargeTypesQuery, auditQuery, t]);

  const handleRetryAll = () => {
    errorEntries.forEach((entry) => entry.retry());
  };

  if (anyError) {
    return (
      <Card className="max-w-2xl border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900">{t("admin:alerts.someDataSourcesFailed")}</h3>
                <p className="text-sm text-red-700">{t("admin:alerts.alertsMayBeIncomplete")}</p>
              </div>
            </div>
            <div className="space-y-2">
              {errorEntries.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between rounded-md border border-red-200 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-red-800">{entry.label}</p>
                    <p className="truncate text-xs text-red-600">{entry.error?.message ?? t("common:unknownError")}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3 shrink-0 border-red-200 text-red-700 hover:bg-red-100"
                    onClick={entry.retry}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    {t("common:retry")}
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full border-red-200 text-red-700 hover:bg-red-100"
              onClick={handleRetryAll}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common:retryAll")}
            </Button>
          </CardContent>
        </Card>
    );
  }

  return (<>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{t("admin:alerts.title")}</h1>
            <Badge className="bg-emerald-100 text-emerald-700">
              {t("admin:badge")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("admin:alerts.subtitle")}
          </p>
        </div>
        <Button 
          variant="outline" 
          className="gap-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 shrink-0"
          onClick={() => navigate("/admin/coordination")}
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">{t("admin:alerts.notifyTeam")}</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title={t("admin:alerts.totalAlerts")}
          value={alerts.length}
          icon={Bell}
          tone="default"
        />
        <StatCard
          title={t("admin:alerts.critical")}
          value={criticalCount}
          icon={AlertTriangle}
          tone="red"
        />
        <StatCard
          title={t("admin:alerts.openIssues")}
          value={openCount}
          icon={Activity}
          tone="amber"
        />
        <StatCard
          title={t("admin:alerts.resolutionRate")}
          value={alerts.length ? `${Math.round(((alerts.length - openCount) / alerts.length) * 100)}%` : "100%"}
          icon={CheckCircle}
          tone="green"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 border-slate-200 focus-visible:border-emerald-500"
              placeholder={t("admin:alerts.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as AlertType)}>
          <SelectTrigger className="w-[180px] border-slate-200">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t("admin:alerts.filterByType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:alerts.allTypes")}</SelectItem>
            <SelectItem value="payments">{t("admin:alerts.payments")}</SelectItem>
            <SelectItem value="complaints">{t("admin:alerts.complaints")}</SelectItem>
            <SelectItem value="billing">{t("admin:alerts.billing")}</SelectItem>
            <SelectItem value="system">{t("admin:alerts.system")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as "all" | AlertSeverity)}>
          <SelectTrigger className="w-[180px] border-slate-200">
            <SelectValue placeholder={t("admin:alerts.filterBySeverity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:alerts.allSeverity")}</SelectItem>
            <SelectItem value="critical">{t("admin:alerts.severity.critical")}</SelectItem>
            <SelectItem value="warning">{t("admin:alerts.severity.warning")}</SelectItem>
            <SelectItem value="info">{t("admin:alerts.severity.info")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts Table */}
      <DataTableFrame>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
            <p className="mt-2 text-sm text-slate-500">{t("admin:alerts.loading")}</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState title={t("admin:alerts.noAlertsFound")} description={t("admin:alerts.noAlertsMatchingFilters")} icon={ShieldAlert} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50">
                  <TableHead className="font-semibold">{t("admin:alerts.alert")}</TableHead>
                  <TableHead className="font-semibold">{t("admin:alerts.type")}</TableHead>
                  <TableHead className="font-semibold">{t("admin:alerts.severity")}</TableHead>
                  <TableHead className="font-semibold">{t("common:status")}</TableHead>
                  <TableHead className="font-semibold">{t("admin:alerts.source")}</TableHead>
                  <TableHead className="font-semibold">{t("admin:alerts.time")}</TableHead>
                  <TableHead className="text-right font-semibold">{t("common:actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => {
                  const SeverityIcon = severityConfig[alert.severity].icon;
                  return (
                    <TableRow key={alert.id} className="border-slate-100 hover:bg-slate-50">
                      <TableCell className="min-w-[280px]">
                        <div className="flex items-start gap-3">
                          <SeverityIcon className={`h-4 w-4 mt-0.5 ${
                            alert.severity === "critical" ? "text-red-500" :
                            alert.severity === "warning" ? "text-yellow-500" : "text-blue-500"
                          }`} />
                          <div>
                            <span className="block font-medium text-slate-900">{alert.title}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">{alert.detail}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize border-slate-200">
                          {alert.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={severityConfig[alert.severity].className}>
                          {t(severityConfig[alert.severity].label)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[alert.status].className}>
                          {t(statusConfig[alert.status].label)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{alert.source}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{formatHumanDateTime(alert.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="hover:bg-emerald-50 hover:text-emerald-700">
                          <Link to={alert.path}>{t("admin:alerts.review")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTableFrame>

      {/* Notification Rules */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-900">{t("admin:alerts.notificationRules")}</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {t("admin:alerts.notificationRulesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              [t("admin:alerts.criticalAlerts"), true, "bg-red-50 border-red-200"],
              [t("admin:alerts.paymentFailures"), true, "bg-yellow-50 border-yellow-200"],
              [t("admin:alerts.dailySummary"), true, "bg-blue-50 border-blue-200"],
              [t("admin:alerts.lowPriorityUpdates"), false, "bg-slate-50 border-slate-200"],
            ].map(([label, checked, bgColor]) => (
              <div 
                key={String(label)} 
                className={`flex items-center justify-between rounded-lg border p-3 ${bgColor}`}
              >
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <Switch 
                  checked={Boolean(checked)} 
                  disabled 
                  aria-label={`${String(label)} — ${t("admin:alerts.readOnly")}`}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
  </>);
};

export default AdminAlertsPage;
