import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Landmark,
  MessageSquare,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStrip } from "@/components/console/ConsolePage";
import {
  MiniAreaChart,
  MiniBarChart,
} from "@/components/charts/MiniCharts";

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-[250px]" />
      <Skeleton className="h-4 w-[400px]" />
    </div>
    <Skeleton className="h-[200px] w-full rounded-lg" />
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] rounded-lg" />)}
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid gap-6">
        <Skeleton className="h-[350px] rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[250px] rounded-lg" />
          <Skeleton className="h-[250px] rounded-lg" />
        </div>
      </div>
      <div className="grid content-start gap-6">
        <Skeleton className="h-[180px] rounded-lg" />
        <Skeleton className="h-[250px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    </div>
  </div>
);

const OfficialDashboard = () => {
  const { t } = useTranslation();
  const marketsQuery = useQuery({ queryKey: ["markets", "official-dashboard"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "official-dashboard"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const stallsQuery = useQuery({ queryKey: ["stalls", "official-dashboard"], queryFn: () => api.getStalls(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments", "official-dashboard"], queryFn: () => api.getPayments(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "official-dashboard"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "official-dashboard"], queryFn: () => api.getAudit(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const resourcesQuery = useQuery({ queryKey: ["resource-requests", "official-dashboard"], queryFn: () => api.getResourceRequests(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const isLoading =
    marketsQuery.isPending ||
    vendorsQuery.isPending ||
    stallsQuery.isPending ||
    paymentsQuery.isPending ||
    ticketsQuery.isPending ||
    auditQuery.isPending ||
    resourcesQuery.isPending;
  const isError =
    marketsQuery.isError ||
    vendorsQuery.isError ||
    stallsQuery.isError ||
    paymentsQuery.isError ||
    ticketsQuery.isError ||
    auditQuery.isError ||
    resourcesQuery.isError;

  if (isError) {
    return (
      <div className="p-4 sm:p-6">
        <Alert variant="destructive" className="max-w-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("official:dashboard.errorTitle")}</AlertTitle>
          <AlertDescription>{t("official:dashboard.errorDesc")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const markets = marketsQuery.data?.markets || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const stalls = stallsQuery.data?.stalls || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const auditEvents = auditQuery.data?.events || [];
  const resourceRequests = resourcesQuery.data?.requests || [];
  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const activeStalls = stalls.filter((stall) => stall.status === "active");
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 0;
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const resolvedComplaints = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
  const resolutionRate = tickets.length ? Math.round((resolvedComplaints.length / tickets.length) * 100) : 0;
  const breachedSla = tickets.filter((ticket) => ticket.breachedSla || ticket.escalatedAt);
  const pendingResources = resourceRequests.filter((request) => request.status === "pending");
  const complianceScore = tickets.length > 0 || stalls.length > 0 ? Math.round((resolutionRate + occupancyRate) / 2) : null;
  const marketRows = markets.slice(0, 4).map((market) => {
    const marketPayments = completedPayments.filter((payment) => payment.marketId === market.id);
    const marketTickets = tickets.filter((ticket) => ticket.marketId === market.id);
    const marketResolved = marketTickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
    const revenue = marketPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const compliance = marketTickets.length > 0
      ? Math.round((marketResolved.length / marketTickets.length) * 100)
      : 100;
    const risk = compliance >= 90 ? "Low" : compliance >= 70 ? "Medium" : "High";

    return {
      market: market.name,
      vendors: market.vendorCount || 0,
      revenue,
      compliance,
      risk,
      tone: risk === "Low" ? "default" : risk === "High" ? "destructive" : "secondary",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("official:dashboard.eyebrow")}</p>
            <h1 className="text-3xl font-bold font-heading text-foreground">{t("official:dashboard.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t("official:dashboard.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div>
        <section className="rounded-lg border border-primary/20 bg-card p-6 shadow-sm dark:border-primary/10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("official:dashboard.revenueSummary")}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight font-heading text-foreground">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/40 p-4 transition-colors hover:bg-muted/60">
                  <p className="text-xs font-medium text-muted-foreground">{t("official:dashboard.compliance")}</p>
                  <p className="mt-2 text-2xl font-bold">{complianceScore !== null ? `${complianceScore}%` : "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-4 transition-colors hover:bg-muted/60">
                  <p className="text-xs font-medium text-muted-foreground">{t("official:dashboard.occupancy")}</p>
                  <p className="mt-2 text-2xl font-bold">{stalls.length > 0 ? `${occupancyRate}%` : "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-4 transition-colors hover:bg-muted/60">
                  <p className="text-xs font-medium text-muted-foreground">{t("official:dashboard.resolution")}</p>
                  <p className="mt-2 text-2xl font-bold">{tickets.length > 0 ? `${resolutionRate}%` : "—"}</p>
                </div>
              </div>
            </div>
            <MiniAreaChart className="text-primary" />
          </div>
        </section>
      </div>

      <KpiStrip columns="grid-cols-2 xl:grid-cols-4" items={[
        { label: t("official:dashboard.activeMarkets"), value: markets.length, detail: t("official:dashboard.underReview"), tone: "info", icon: Landmark },
        { label: t("official:dashboard.registeredVendors"), value: vendors.length.toLocaleString(), detail: t("official:dashboard.acrossAllMarkets"), tone: "info", icon: BarChart3 },
        { label: t("official:dashboard.openComplaints"), value: openComplaints.length, detail: t("official:dashboard.escalated", { n: breachedSla.length }), tone: openComplaints.length > 0 ? "warning" : "success", icon: MessageSquare },
        { label: t("official:dashboard.complianceAlerts"), value: breachedSla.length + pendingResources.length, detail: t("official:dashboard.needsOversight"), tone: (breachedSla.length + pendingResources.length) > 0 ? "destructive" : "success", icon: AlertTriangle },
      ]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-6 content-start">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t("official:dashboard.marketRankings")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {marketRows.length > 0 ? marketRows.map((row, index) => (
                    <div key={row.market} className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[auto_1fr_auto] md:items-center transition-all hover:bg-muted/30">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.market}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("official:dashboard.vendorsLine", { count: row.vendors, revenue: formatCurrency(row.revenue) })}</p>
                      </div>
                      <div className="flex items-center gap-4 md:justify-end">
                        <div className="w-32">
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${row.compliance}%` }} />
                          </div>
                          <p className="mt-1 text-right text-[11px] text-muted-foreground">{t("official:dashboard.compliantPercent", { n: row.compliance })}</p>
                        </div>
                        <Badge variant={row.tone}>{row.risk}</Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      {t("official:dashboard.noMarketData")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t("official:dashboard.revenueTrends")}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <MiniBarChart className="text-primary" />
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t("official:dashboard.complaintSlaOverview")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-muted-foreground">{t("official:dashboard.resolvedWithinSla")}</span>
                        <span className="font-semibold">{resolutionRate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${resolutionRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-muted-foreground">{t("official:dashboard.escalatedCases")}</span>
                        <span className="font-semibold">{breachedSla.length}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(breachedSla.length * 8, 16), 100)}%` }} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                      {t("official:dashboard.oversightPriority")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t("official:dashboard.complianceAlertsTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { title: t("official:dashboard.slaBreach"), detail: breachedSla.length > 0 ? t("official:dashboard.casesPastTarget", { n: breachedSla.length }) : t("official:dashboard.noSlaBreaches"), tone: breachedSla.length > 0 ? "destructive" as const : "default" as const },
                    { title: t("official:dashboard.occupancyReview"), detail: stalls.length > 0 ? t("official:dashboard.regionalOccupancy", { n: occupancyRate }) : t("official:dashboard.noStallData"), tone: occupancyRate >= 80 || stalls.length === 0 ? ("default" as const) : ("secondary" as const) },
                    { title: t("official:dashboard.revenueAuditSample"), detail: t("official:dashboard.monthlyReconciliationReady"), tone: "default" as const },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <Badge variant={item.tone}>{t("official:dashboard.review")}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t("official:dashboard.auditActivity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="flex gap-4 rounded-lg bg-muted/40 p-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
                        <FileSearch className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold capitalize">{event.action.replace(/_/g, " ")}</p>
                        <p className="truncate text-xs text-muted-foreground">{event.actorName} - {formatHumanDateTime(event.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {!auditEvents.length ? <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">{t("official:dashboard.noAuditEvents")}</div> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t("official:dashboard.resourceRequests")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingResources.slice(0, 3).map((request) => (
                    <div key={request.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
                          <ClipboardList className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{request.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{request.marketName} - {formatCurrency(request.amountRequested)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!pendingResources.length ? (
                    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("official:dashboard.noPendingResourceRequests")}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialDashboard;
