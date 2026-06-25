/**
 * Official oversight dashboard with market health KPIs, revenue chart, complaints summary,
 * and compliance insights. Official role only.
 */
import { useMemo } from "react";
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
  ShieldAlert,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime, tSnake } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { MiniAreaChart, MiniBarChart } from "@/components/charts/MiniCharts";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { InsightCard } from "@/components/ui/InsightCard";
import { EmptyState } from "@/components/ui/EmptyState";

/** Loading skeleton placeholder for the official dashboard. */
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-[250px]" />
    <Skeleton className="h-[200px] w-full rounded-lg" />
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[100px] rounded-lg" />)}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-[300px] rounded-lg" />
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  </div>
);

/** OfficialDashboard - renders the oversight overview with KPI cards, market health, revenue chart, and compliance insights. */
const OfficialDashboard = () => {
  const { t } = useTranslation();
  const marketsQuery = useQuery({ queryKey: ["markets", "official-dashboard"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "official-dashboard"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const stallsQuery = useQuery({ queryKey: ["stalls", "official-dashboard"], queryFn: () => api.getStalls(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments", "official-dashboard"], queryFn: () => api.getPayments(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "official-dashboard"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "official-dashboard"], queryFn: () => api.getAudit(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const resourcesQuery = useQuery({ queryKey: ["resource-requests", "official-dashboard"], queryFn: () => api.getResourceRequests(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateFrom = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;
  const dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const revenueQuery = useQuery({
    queryKey: ["reports", "revenue", "official-dashboard", dateFrom, dateTo],
    queryFn: () => api.getRevenueReport(dateFrom, dateTo),
    refetchInterval: 30_000,
  });

  const revenueChartData = useMemo(() => {
    const rows = revenueQuery.data?.rows || [];
    const grouped: Record<string, number> = {};
    rows.forEach((row) => {
      const date = row.createdAt?.slice(0, 10);
      if (date) grouped[date] = (grouped[date] || 0) + row.amount;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([label, value]) => ({ label, value }));
  }, [revenueQuery.data?.rows]);

  const isLoading = marketsQuery.isPending || vendorsQuery.isPending || stallsQuery.isPending ||
    paymentsQuery.isPending || ticketsQuery.isPending || auditQuery.isPending || resourcesQuery.isPending || revenueQuery.isPending;
  const isError = marketsQuery.isError || vendorsQuery.isError || stallsQuery.isError ||
    paymentsQuery.isError || ticketsQuery.isError || auditQuery.isError || resourcesQuery.isError || revenueQuery.isError;

  if (isError) {
    return (
      <div className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] p-5 text-sm text-[#991B1B]">
        {t("official:dashboard.errorTitle")}: {t("official:dashboard.errorDesc")}
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  const markets = marketsQuery.data?.markets || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const stalls = stallsQuery.data?.stalls || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const auditEvents = auditQuery.data?.events || [];
  const resourceRequests = resourcesQuery.data?.requests || [];
  const completedPayments = payments.filter((p) => p.status === "completed");
  const totalRevenue = revenueQuery.data?.summary?.totalRevenue ?? 0;
  const activeStalls = stalls.filter((s) => s.status === "active");
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 0;
  const openComplaints = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const resolvedComplaints = tickets.filter((t) => ["resolved", "closed"].includes(t.status));
  const resolutionRate = tickets.length ? Math.round((resolvedComplaints.length / tickets.length) * 100) : 0;
  const breachedSla = tickets.filter((t) => t.breachedSla || t.escalatedAt);
  const pendingResources = resourceRequests.filter((r) => r.status === "pending");
  const complianceScore = tickets.length > 0 || stalls.length > 0 ? Math.round((resolutionRate + occupancyRate) / 2) : null;

  const lowComplianceMarkets = markets.filter((market) => {
    const marketTickets = tickets.filter((t) => t.marketId === market.id);
    const marketResolved = marketTickets.filter((t) => ["resolved", "closed"].includes(t.status));
    const compliance = marketTickets.length > 0 ? Math.round((marketResolved.length / marketTickets.length) * 100) : 100;
    return compliance < 80;
  });

  const marketRows = markets.slice(0, 5).map((market) => {
    const marketPayments = completedPayments.filter((p) => p.marketId === market.id);
    const marketTickets = tickets.filter((t) => t.marketId === market.id);
    const marketResolved = marketTickets.filter((t) => ["resolved", "closed"].includes(t.status));
    const revenue = marketPayments.reduce((sum, p) => sum + p.amount, 0);
    const compliance = marketTickets.length > 0 ? Math.round((marketResolved.length / marketTickets.length) * 100) : 100;
    const riskLabel = compliance >= 90 ? t("official:dashboard.riskLow") : compliance >= 70 ? t("official:dashboard.riskMedium") : t("official:dashboard.riskHigh");
    return { market: market.name, vendors: market.vendorCount || 0, revenue, compliance, risk: riskLabel, tone: compliance >= 90 ? "default" : compliance >= 70 ? "secondary" : "destructive" as const };
  });

  const riskItems = [
    ...(lowComplianceMarkets.length > 0 ? [{
      id: "low-compliance",
      icon: ShieldAlert,
      label: t("official:dashboard.lowComplianceMarkets"),
      value: lowComplianceMarkets.length,
      detail: `${lowComplianceMarkets.map((m) => m.name).join(", ")}`,
      positive: false,
    }] : []),
    ...(breachedSla.length > 0 ? [{
      id: "sla-breaches",
      icon: AlertTriangle,
      label: t("official:dashboard.slaBreaches"),
      value: breachedSla.length,
      detail: t("official:dashboard.slaBreachesDetail"),
      positive: false,
    }] : []),
    ...(pendingResources.length > 0 ? [{
      id: "pending-resources",
      icon: ClipboardList,
      label: t("official:dashboard.pendingResourceRequestsLabel"),
      value: pendingResources.length,
      detail: t("official:dashboard.pendingResourceRequestsDetail"),
      positive: false,
    }] : []),
  ];

  return (
    <WorkspaceLayout
      variant="full"
      left={
        <>
          <PageHeader
            eyebrow={t("official:dashboard.eyebrow")}
            title={t("official:dashboard.title")}
            description={t("official:dashboard.subtitle")}
          />

          <section className="rounded-xl border border-[#0F5E3F]/20 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
              <div>
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E8F5EE] text-[#0F5E3F]">
                    <TrendingUp className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#6B7280]">{t("official:dashboard.revenueSummary")}</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-[#111827]">{formatCurrency(totalRevenue)}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <p className="text-[11px] font-medium text-[#6B7280]">{t("official:dashboard.complianceLabel")}</p>
                    <p className="mt-1 text-2xl font-bold text-[#111827]">{complianceScore !== null ? `${complianceScore}%` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <p className="text-[11px] font-medium text-[#6B7280]">{t("official:dashboard.occupancyLabel")}</p>
                    <p className="mt-1 text-2xl font-bold text-[#111827]">{stalls.length > 0 ? `${occupancyRate}%` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <p className="text-[11px] font-medium text-[#6B7280]">{t("official:dashboard.resolutionLabel")}</p>
                    <p className="mt-1 text-2xl font-bold text-[#111827]">{tickets.length > 0 ? `${resolutionRate}%` : "—"}</p>
                  </div>
                </div>
              </div>
              <MiniAreaChart className="text-[#0F5E3F]" data={revenueChartData} />
            </div>
          </section>

          {riskItems.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {riskItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-xl border border-[#F1F3F5] bg-white p-4 shadow-sm">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#EF476F]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#6B7280]">{item.label}</p>
                      <p className="text-xl font-bold text-[#111827]">{item.value}</p>
                      <p className="truncate text-[11px] text-[#71717A]">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <InsightCard label={t("official:dashboard.activeMarkets")} value={markets.length} detail={t("official:dashboard.underReview")} icon={<Landmark className="h-5 w-5" />} />
            <InsightCard label={t("official:dashboard.registeredVendors")} value={vendors.length.toLocaleString()} detail={t("official:dashboard.acrossAllMarkets")} icon={<BarChart3 className="h-5 w-5" />} />
            <InsightCard label={t("official:dashboard.openComplaints")} value={openComplaints.length} detail={t("official:dashboard.escalated", { n: breachedSla.length })} icon={<MessageSquare className="h-5 w-5" />} />
            <InsightCard label={t("official:dashboard.complianceAlerts")} value={breachedSla.length + pendingResources.length} detail={t("official:dashboard.needsOversight")} icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t("official:dashboard.marketRankings")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {marketRows.length > 0 ? marketRows.map((row, index) => (
                  <div key={row.market} className="grid gap-3 rounded-lg border border-[#F1F3F5] bg-white p-4 md:grid-cols-[auto_1fr_auto] md:items-center transition-all hover:bg-[#F8F9FA]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5EE] text-xs font-bold text-[#0F5E3F]">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{row.market}</p>
                      <p className="text-[11px] text-[#6B7280]">{t("official:dashboard.vendorsRevenueLine", { count: row.vendors, revenue: formatCurrency(row.revenue) })}</p>
                    </div>
                    <div className="flex items-center gap-4 md:justify-end">
                      <div className="w-24">
                        <div className="h-1.5 rounded-full bg-[#F1F3F5]">
                          <div className="h-1.5 rounded-full bg-[#0F5E3F]" style={{ width: `${row.compliance}%` }} />
                        </div>
                        <p className="mt-1 text-right text-[10px] text-[#6B7280]">{t("official:dashboard.compliantPercent", { n: row.compliance })}</p>
                      </div>
                      <Badge variant={row.tone} className="text-[10px]">{row.risk}</Badge>
                    </div>
                  </div>
                )) : (
                  <EmptyState title={t("official:dashboard.noMarketData")} />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">{t("official:dashboard.revenueTrends")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <MiniBarChart className="text-[#0F5E3F]" data={revenueChartData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">{t("official:dashboard.complaintSlaOverview")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-[#6B7280]">{t("official:dashboard.resolvedWithinSla")}</span>
                      <span className="font-semibold text-[#111827]">{resolutionRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F1F3F5]">
                      <div className="h-2 rounded-full bg-[#0F5E3F]" style={{ width: `${resolutionRate}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-[#6B7280]">{t("official:dashboard.escalatedCases")}</span>
                      <span className="font-semibold text-[#111827]">{breachedSla.length}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F1F3F5]">
                      <div className="h-2 rounded-full bg-[#F5A623]" style={{ width: `${Math.min(Math.max(breachedSla.length * 8, 16), 100)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#0F5E3F]/20 bg-[#E8F5EE]/30 p-3 text-sm font-medium text-[#0F5E3F]">
                    {t("official:dashboard.oversightPriority")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">{t("official:dashboard.auditActivity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex gap-3 rounded-lg bg-[#F8F9FA] p-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#0F5E3F] shadow-sm">
                        <FileSearch className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#111827] capitalize">{tSnake(t, event.action)}</p>
                        <p className="truncate text-[11px] text-[#6B7280]">{event.actorName} — {formatHumanDateTime(event.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {!auditEvents.length && <EmptyState title={t("official:dashboard.noAuditEvents")} />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">{t("official:dashboard.resourceRequests")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingResources.slice(0, 3).map((request) => (
                    <div key={request.id} className="rounded-lg border border-[#F1F3F5] bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F8F9FA] text-[#0F5E3F] shadow-sm">
                          <ClipboardList className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#111827]">{request.title}</p>
                          <p className="truncate text-[11px] text-[#6B7280]">{request.marketName} — {formatCurrency(request.amountRequested)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!pendingResources.length ? (
                    <div className="flex items-center gap-2 rounded-lg border border-[#10B981]/20 bg-[#D1FAE5]/30 p-4 text-sm font-medium text-[#10B981]">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("official:dashboard.noPendingResourceRequests")}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      }
    />
  );
};

export default OfficialDashboard;
