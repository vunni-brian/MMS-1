/**
 * Admin dashboard with system overview KPI cards, action center, audit timeline,
 * and system health monitoring. Admin role only.
 */
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import {
  Activity,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users,
  AlertTriangle,
  KeyRound,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatHumanDateTime, tSnake } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniAreaChart } from "@/components/charts/MiniCharts";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { InsightCard } from "@/components/ui/InsightCard";
import { ActionCenter } from "@/components/ui/ActionCenter";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";

/** Determines audit timeline entry severity based on action keywords. */
const getAuditSeverity = (action: string) =>
  /FAIL|DENIED|REJECT|ERROR|SUSPEND|DELETE/i.test(action) ? "failure" : "success";

/** Loading skeleton placeholder for the admin dashboard. */
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-[250px]" />
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[100px]" />)}
    </div>
    <Skeleton className="h-[200px]" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Skeleton className="h-[300px]" />
      <Skeleton className="h-[300px]" />
    </div>
  </div>
);

/** AdminDashboard - renders the system overview with stats, action center, and audit timeline. */
const AdminDashboard = () => {
  const { t } = useTranslation();
  const usersQuery = useQuery({ queryKey: ["users", "admin"], queryFn: () => api.getUsers(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const marketsQuery = useQuery({ queryKey: ["markets", "admin"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "admin"], queryFn: () => api.getAudit(), refetchInterval: 30000, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const systemHealthQuery = useQuery({ queryKey: ["system-health"], queryFn: () => api.health(), refetchInterval: 60000, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });

  const isLoading = usersQuery.isPending || marketsQuery.isPending || auditQuery.isPending || systemHealthQuery.isPending;

  const getAuditDetailLabel = (details: Record<string, unknown> | null) => {
    if (!details) return t("admin:dashboard.auditDetailNone");
    const ipAddress = details.ipAddress ?? details.ip ?? details.clientIp;
    if (typeof ipAddress === "string" && ipAddress.trim()) return ipAddress;
    const status = details.status ?? details.reason ?? details.message;
    if (typeof status === "string" && status.trim()) return status;
    return t("admin:dashboard.auditDetailAttached");
  };

  if (isLoading) return <DashboardSkeleton />;

  const users = usersQuery.data?.users || [];
  const markets = marketsQuery.data?.markets || [];
  const auditEvents = auditQuery.data?.events || [];
  const systemOk = systemHealthQuery.data?.status === "healthy";

  const internalUsers = users.filter((u) => ["admin", "manager", "official"].includes(u.role));
  const activeMarkets = markets.filter((m) => m.stallCount > 0 || m.activeStallCount > 0);
  const failedEvents = auditEvents.filter((e) => getAuditSeverity(e.action) === "failure");
  const computedOccupancy = markets.reduce((sum, m) => sum + (m.activeStallCount || 0), 0);
  const totalStalls = markets.reduce((sum, m) => sum + (m.stallCount || 0), 0);
  const occupancyRate = totalStalls > 0 ? Math.round((computedOccupancy / totalStalls) * 100) : 0;

  const actionItems = [
    ...(!systemOk ? [{
      id: "system-degraded",
      icon: ShieldAlert,
      title: t("admin:dashboard.actionSystemDegradedTitle"),
      detail: t("admin:dashboard.actionSystemDegradedDetail"),
      tone: "urgent" as const,
    }] : []),
    ...failedEvents.slice(0, 3).map((event) => ({
      id: `audit-${event.id}`,
      icon: Terminal,
      title: tSnake(t, event.action),
      detail: `${event.actorName} — ${getAuditDetailLabel(event.details)}`,
      tone: "warning" as const,
    })),
    ...(users.filter((u) => u.vendorStatus === "pending").length > 0 ? [{
      id: "pending-vendors",
      icon: Users,
      title: t("admin:dashboard.actionVendorAppsTitle", { n: users.filter((u) => u.vendorStatus === "pending").length }),
      detail: t("admin:dashboard.actionVendorAppsDetail"),
      tone: "info" as const,
    }] : []),
  ];

  const activityItems = auditEvents.slice(0, 5).map((event) => ({
    id: event.id,
    icon: Terminal,
    title: tSnake(t, event.action),
    detail: event.actorName,
    time: formatHumanDateTime(event.createdAt),
    tone: getAuditSeverity(event.action) === "failure" ? "warning" as const : "success" as const,
  }));

  return (
    <WorkspaceLayout
      variant="with-right-panel"
      left={
        <>
          <PageHeader
            title={t("admin:dashboard.title")}
            description={t("admin:dashboard.subtitle")}
          />

          <div className="grid gap-4 md:grid-cols-4">
            <InsightCard
              label={t("admin:dashboard.totalUsers")}
              value={users.length.toLocaleString()}
              detail={t("admin:dashboard.staffVendorsDetail", { staff: internalUsers.length, vendors: users.length - internalUsers.length })}
              icon={<Users className="h-5 w-5" />}
            />
            <InsightCard
              label={t("admin:dashboard.activeMarkets")}
              value={activeMarkets.length}
              detail={t("admin:dashboard.marketsRegistered", { n: markets.length })}
              icon={<Landmark className="h-5 w-5" />}
            />
            <InsightCard
              label={t("admin:dashboard.securityEvents")}
              value={failedEvents.length}
              detail={t("admin:dashboard.failedLoginsDenied")}
              icon={failedEvents.length > 0 ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            />
            <InsightCard
              label={t("admin:dashboard.systemHealth")}
              value={systemOk ? "100%" : t("admin:dashboard.healthDegraded")}
              detail={systemOk ? t("admin:dashboard.healthAllOperational") : t("admin:dashboard.healthPerformanceDegraded")}
              icon={<Activity className="h-5 w-5" />}
            />
          </div>

          <ActionCenter
            title={t("admin:dashboard.systemAttention")}
            items={actionItems}
            emptyMessage={t("admin:dashboard.allSystemsHealthy")}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold">{t("admin:dashboard.platformActivity")}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-[#D1FAE5] text-[#065F46] text-[10px]">{t("admin:dashboard.loginsBadge")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("admin:dashboard.apiCallsBadge")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <MiniAreaChart className="text-[#0F5E3F]" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t("admin:dashboard.securityAuditLog")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditEvents.slice(0, 6).map((event) => {
                  const severity = getAuditSeverity(event.action);
                  const detailLabel = getAuditDetailLabel(event.details);
                  return (
                    <div key={event.id} className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-all hover:bg-[#F8F9FA] hover:border-[#F1F3F5]">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          severity === "failure" ? "bg-[#FEE2E2] text-[#EF476F]" : "bg-[#D1FAE5] text-[#10B981]"
                        }`}>
                          <Terminal className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#111827] capitalize">{tSnake(t, event.action)}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-medium text-[#6B7280]">{event.actorName}</span>
                            <span className="text-[10px] text-[#71717A]">•</span>
                            <span className="text-[11px] text-[#71717A]">{detailLabel}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={severity === "failure" ? "destructive" : "secondary"} className="text-[9px] uppercase">
                          {severity === "failure" ? t("admin:dashboard.badgeReview") : t("admin:dashboard.badgeRecorded")}
                        </Badge>
                        <p className="mt-0.5 text-[10px] text-[#71717A]">{formatHumanDateTime(event.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                  {!auditEvents.length && (
                    <div className="rounded-lg bg-[#F8F9FA] p-4 text-center text-sm text-[#6B7280]">
                      {t("admin:dashboard.noRecentAuditEvents")}
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </>
      }
      right={
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t("admin:dashboard.platformHealth")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center gap-3 rounded-xl border p-4 ${
                systemOk ? "border-[#6EE7B7] bg-[#D1FAE5]/50" : "border-[#FCA5A5] bg-[#FEE2E2]/50"
              }`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  systemOk ? "bg-[#D1FAE5] text-[#10B981]" : "bg-[#FEE2E2] text-[#EF476F]"
                }`}>
                  {systemOk ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${systemOk ? "text-[#065F46]" : "text-[#991B1B]"}`}>
                    {systemOk ? t("admin:dashboard.allSystemsOperational") : t("admin:dashboard.healthCheckFailed")}
                  </p>
                  <p className={`mt-0.5 text-[11px] ${systemOk ? "text-[#065F46]/70" : "text-[#991B1B]/70"}`}>
                    {systemOk ? t("admin:dashboard.apiRunningNormally") : t("admin:dashboard.degradedPerformanceDetected")}
                  </p>
                </div>
              </div>
              {!systemOk && (
                <div className="mt-3 rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[11px] text-[#991B1B]">
                  {t("admin:dashboard.serviceDegradationDetected")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t("admin:dashboard.quickStats")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#6B7280]">{t("admin:dashboard.totalVendors")}</span>
                <span className="text-sm font-bold text-[#111827]">{users.filter(u => u.role === "vendor").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#6B7280]">{t("admin:dashboard.activeStalls")}</span>
                <span className="text-sm font-bold text-[#111827]">{computedOccupancy}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#6B7280]">{t("admin:dashboard.occupancyRate")}</span>
                <span className="text-sm font-bold text-[#10B981]">{occupancyRate}%</span>
              </div>
            </CardContent>
          </Card>

          <ActivityTimeline
            title={t("admin:dashboard.securityLog")}
            items={activityItems}
            viewAllLink="/admin/audit"
            viewAllLabel={t("admin:dashboard.viewAll")}
          />
        </>
      }
    />
  );
};

export default AdminDashboard;
