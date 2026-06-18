import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import {
  Activity,
  AlertCircle,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniAreaChart } from "@/components/charts/MiniCharts";
import { KpiStrip } from "@/components/console/ConsolePage";

const getAuditSeverity = (action: string) =>
  /FAIL|DENIED|REJECT|ERROR|SUSPEND|DELETE/i.test(action) ? "failure" : "success";

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-[250px]" />
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px]" />)}
    </div>
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <Skeleton className="h-[350px]" />
      <Skeleton className="h-[350px]" />
    </div>
  </div>
);

const AdminDashboard = () => {
  const { t } = useTranslation();
  const usersQuery = useQuery({ queryKey: ["users", "admin"], queryFn: () => api.getUsers(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const marketsQuery = useQuery({ queryKey: ["markets", "admin"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "admin"], queryFn: () => api.getAudit(), refetchInterval: 30000, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const systemHealthQuery = useQuery({ queryKey: ["system-health"], queryFn: () => api.health(), refetchInterval: 60000, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });

  const isLoading = usersQuery.isPending || marketsQuery.isPending || auditQuery.isPending || systemHealthQuery.isPending;
  const isError = usersQuery.isError || marketsQuery.isError || auditQuery.isError || systemHealthQuery.isError;

  const getAuditDetailLabel = (details: Record<string, unknown> | null) => {
    if (!details) return t("admin:dashboard.noDetailsRecorded");

    const ipAddress = details.ipAddress ?? details.ip ?? details.clientIp;
    if (typeof ipAddress === "string" && ipAddress.trim()) {
      return ipAddress;
    }

    const status = details.status ?? details.reason ?? details.message;
    if (typeof status === "string" && status.trim()) {
      return status;
    }

    return t("admin:dashboard.detailsAttached");
  };

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("admin:dashboard.errorTitle")}</AlertTitle>
        <AlertDescription>{t("admin:dashboard.errorDescription")}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const users = usersQuery.data?.users || [];
  const markets = marketsQuery.data?.markets || [];
  const auditEvents = auditQuery.data?.events || [];
  const systemOk = systemHealthQuery.data?.ok ?? false;

  const internalUsers = users.filter((u) => ["admin", "manager", "official"].includes(u.role));
  const activeMarkets = markets.filter((market) => market.stallCount > 0 || market.activeStallCount > 0);
  const failedEvents = auditEvents.filter((event) => getAuditSeverity(event.action) === "failure");
  const systemStatus = systemOk ? "healthy" : "degraded";

  return (<>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{t("admin:dashboard.title")}</h1>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {t("admin:badge")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {t("admin:dashboard.subtitle")}
        </p>
      </div>

       {/* Stats Grid */}
       <KpiStrip columns="grid-cols-2 xl:grid-cols-4" items={[
         { label: t("admin:dashboard.totalUsers"), value: users.length.toLocaleString(), detail: t("admin:dashboard.staffVendors", { staff: internalUsers.length, vendors: users.length - internalUsers.length }), tone: "info", icon: Users },
         { label: t("admin:dashboard.activeMarkets"), value: activeMarkets.length, detail: t("admin:dashboard.registeredTotal", { count: markets.length }), tone: "success", icon: Landmark },
         { label: t("admin:dashboard.securityEvents"), value: failedEvents.length, detail: t("admin:dashboard.failedLoginsDeniedAccess"), tone: failedEvents.length > 0 ? "warning" : "success", icon: failedEvents.length > 0 ? ShieldAlert : ShieldCheck },
         { label: t("admin:dashboard.systemHealth"), value: systemStatus === "healthy" ? "100%" : t("admin:dashboard.degraded"), detail: systemStatus === "healthy" ? t("admin:dashboard.allSystemsOperational") : t("admin:dashboard.degradedPerformance"), tone: systemStatus === "healthy" ? "success" : "destructive", icon: Activity },
       ]} />

      {/* Charts and Activity */}
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Chart Card */}
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-slate-900">{t("admin:dashboard.platformActivity")}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{t("admin:dashboard.logins")}</Badge>
                <Badge variant="outline" className="border-slate-200">{t("admin:dashboard.apiCalls")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <MiniAreaChart className="text-emerald-600" />
            </CardContent>
          </Card>

          {/* Security & Audit Log */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">{t("admin:dashboard.securityAuditLog")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditEvents.slice(0, 8).map((event) => {
                  const severity = getAuditSeverity(event.action);
                  const detailLabel = getAuditDetailLabel(event.details);

                  return (
                    <div key={event.id} className="group flex items-center justify-between rounded-lg border border-transparent p-3 transition-all hover:bg-slate-50 hover:border-slate-200">
                      <div className="flex items-center gap-4">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          severity === "failure" 
                            ? "bg-red-100 text-red-600" 
                            : "bg-emerald-100 text-emerald-600"
                        }`}>
                          <Terminal className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold capitalize text-slate-900">{event.action.replace(/_/g, " ")}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-slate-500">{event.actorName}</span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{detailLabel}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={severity === "failure" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                          {severity === "failure" ? t("admin:dashboard.review") : t("admin:dashboard.recorded")}
                        </Badge>
                        <p className="mt-1 text-xs text-slate-500">{formatHumanDateTime(event.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                {!auditEvents.length && (
                  <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                    {t("admin:dashboard.noRecentAuditEvents")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Infrastructure Health */}
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">{t("admin:dashboard.infrastructureHealth")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center gap-4 rounded-xl border p-4 ${
                systemOk 
                  ? "border-emerald-200 bg-emerald-50/50" 
                  : "border-red-200 bg-red-50/50"
              }`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  systemOk 
                    ? "bg-emerald-100 text-emerald-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  {systemOk ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${
                    systemOk ? "text-emerald-900" : "text-red-900"
                  }`}>
                    {systemOk ? t("admin:dashboard.allSystemsOperational") : t("admin:dashboard.healthCheckFailed")}
                  </p>
                  <p className={`mt-0.5 text-xs ${
                    systemOk ? "text-emerald-700" : "text-red-700"
                  }`}>
                    {systemOk 
                      ? t("admin:dashboard.apiServicesNormal") 
                      : t("admin:dashboard.healthEndpointFailure")}
                  </p>
                </div>
              </div>
              {!systemOk && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {t("admin:dashboard.serviceDegradation")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">{t("admin:dashboard.quickStats")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t("admin:dashboard.totalVendors")}</span>
                <span className="text-lg font-semibold text-slate-900">{users.filter(u => u.role === "vendor").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t("admin:dashboard.totalMarkets")}</span>
                <span className="text-lg font-semibold text-slate-900">{markets.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t("admin:dashboard.activeStalls")}</span>
                <span className="text-lg font-semibold text-slate-900">
                  {markets.reduce((sum, m) => sum + (m.activeStallCount || 0), 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t("admin:dashboard.occupancyRate")}</span>
                <span className="text-lg font-semibold text-emerald-600">78%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  </>);
};

export default AdminDashboard;
