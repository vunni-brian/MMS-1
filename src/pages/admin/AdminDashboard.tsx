import { useQuery } from "@tanstack/react-query";

import {
 Activity,
 AlertCircle,
 Landmark,
 ShieldAlert,
 ShieldCheck,
 Terminal,
 Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { api } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniAreaChart } from "@/components/mockup/MockupUI";

interface SystemHealthService {
 service: string;
 status: "Operational" | "Degraded";
 uptime: string;
 latency: string;
}

type StatTone = "default" | "blue" | "green" | "amber" | "red" | "purple";

interface StatCardProps {
 title: string;
 value: string | number;
 subtitle: string;
 icon: LucideIcon;
 tone?: StatTone;
}

const statToneClasses: Record<StatTone, string> = {
 default: "text-muted-foreground bg-muted",
 blue: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
 green: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
 amber: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
 red: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
 purple: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400",
};

const getAuditSeverity = (action: string) =>
 /FAIL|DENIED|REJECT|ERROR|SUSPEND|DELETE/i.test(action) ? "failure" : "success";

const getAuditDetailLabel = (details: Record<string, unknown> | null) => {
 if (!details) return "No details recorded";

 const ipAddress = details.ipAddress ?? details.ip ?? details.clientIp;
 if (typeof ipAddress === "string" && ipAddress.trim()) {
 return ipAddress;
 }

 const status = details.status ?? details.reason ?? details.message;
 if (typeof status === "string" && status.trim()) {
 return status;
 }

 return "Details attached";
};

const DashboardSkeleton = () => (
 <div className="space-y-6">
 <div className="space-y-2">
 <Skeleton className="h-8 w-[250px]" />
 <Skeleton className="h-4 w-[400px]" />
 </div>
 <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
 {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] rounded-sm" />)}
 </div>
 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
 <div className="grid gap-6">
 <Skeleton className="h-[350px] rounded-sm" />
 <Skeleton className="h-[300px] rounded-sm" />
 </div>
 <div className="grid content-start gap-6">
 <Skeleton className="h-[250px] rounded-sm" />
 <Skeleton className="h-[250px] rounded-sm" />
 </div>
 </div>
 </div>
);

const StatCard = ({ title, value, subtitle, icon: Icon, tone = "default" }: StatCardProps) => {
 const toneClassName = statToneClasses[tone];
 return (
 <Card className="overflow-hidden bg-card transition-all hover:border-primary/40 hover:shadow-sm">
 <CardContent className="p-6">
 <div className="flex items-center gap-4">
 <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm ${toneClassName}`}>
 <Icon className="h-5 w-5" />
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium text-muted-foreground">{title}</p>
 <div className="flex items-baseline gap-2">
 <p className="truncate text-2xl font-bold font-heading text-foreground">{value}</p>
 </div>
 <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 );
};

const AdminDashboard = () => {
 const usersQuery = useQuery({ queryKey: ["users", "admin"], queryFn: () => api.getUsers(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
 const marketsQuery = useQuery({ queryKey: ["markets", "admin"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
 const auditQuery = useQuery({ queryKey: ["audit", "admin"], queryFn: () => api.getAudit(), refetchInterval: 30000, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
 const systemHealthQuery = useQuery({ queryKey: ["system-health"], queryFn: () => api.health(), refetchInterval: 60000, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });

 const isLoading = usersQuery.isPending || marketsQuery.isPending || auditQuery.isPending || systemHealthQuery.isPending;
 const isError = usersQuery.isError || marketsQuery.isError || auditQuery.isError || systemHealthQuery.isError;

 if (isError) {
 return (
 <div className="p-4 sm:p-6">
 <Alert variant="destructive" className="max-w-xl">
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>Could not load admin dashboard</AlertTitle>
 <AlertDescription>System data is currently unavailable. Please refresh or check connection.</AlertDescription>
 </Alert>
 </div>
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
 const degradedServices = systemOk ? [] : [{ service: "Platform" }];
 const systemStatus = systemOk ? "healthy" : "degraded";

 return (
 <div className="space-y-6">
 <div>
 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <div className="flex items-center gap-3 mb-1">
 <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Console</p>
 <Badge variant={systemStatus === "healthy" ? "default" : systemStatus === "critical" ? "destructive" : "secondary"}>
 {systemStatus === "healthy" ? "All Systems Go" : systemStatus === "critical" ? "Critical Alert" : "Degraded Performance"}
 </Badge>
 </div>
 <h1 className="text-3xl font-bold font-heading text-foreground">System Overview</h1>
 <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
 Monitor infrastructure health, security events, and platform usage across all regions.
 </p>
 </div>
 </div>
 </div>

 <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
 <div><StatCard title="Total Users" value={users.length.toLocaleString()} subtitle={`${internalUsers.length} staff / ${users.length - internalUsers.length} vendors`} tone="blue" icon={Users} /></div>
 <div><StatCard title="Active Markets" value={activeMarkets.length} subtitle={`${markets.length} registered total`} tone="green" icon={Landmark} /></div>
 <div><StatCard title="Security Events" value={failedEvents.length} subtitle="Failed logins / Denied access" tone={failedEvents.length > 0 ? "amber" : "green"} icon={failedEvents.length > 0 ? ShieldAlert : ShieldCheck} /></div>
 <div><StatCard title="System Health" value={systemStatus === "healthy" ? "100%" : "Degraded"} subtitle={`${degradedServices.length} alerts active`} tone={systemStatus === "healthy" ? "green" : "red"} icon={Activity} /></div>
 </div>

 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
 <div className="grid gap-6 content-start">
 <div>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle>Platform Activity (Last 30 Days)</CardTitle>
 <div className="flex gap-2">
 <Badge variant="secondary" className="bg-primary/10 text-primary">Logins</Badge>
 <Badge variant="outline">API Calls</Badge>
 </div>
 </CardHeader>
 <CardContent className="pt-4">
 <MiniAreaChart className="text-primary" />
 </CardContent>
 </Card>
 </div>

 <div>
 <Card>
 <CardHeader>
 <CardTitle>Security & Audit Log</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {auditEvents.slice(0, 8).map((event) => {
 const severity = getAuditSeverity(event.action);
 const detailLabel = getAuditDetailLabel(event.details);

 return (
 <div key={event.id} className="group flex items-center justify-between rounded-sm border border-transparent p-3 transition-colors hover:bg-muted/40 hover:border-border">
 <div className="flex items-center gap-4">
 <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${severity === "failure" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
 <Terminal className="h-4 w-4" />
 </span>
 <div>
 <p className="text-sm font-semibold capitalize">{event.action.replace(/_/g, " ")}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-xs font-medium text-muted-foreground">{event.actorName}</span>
 <span className="text-[10px] text-muted-foreground/60">•</span>
 <span className="text-xs text-muted-foreground">{detailLabel}</span>
 </div>
 </div>
 </div>
 <div className="text-right">
 <Badge variant={severity === "failure" ? "destructive" : "secondary"} className="text-[10px] uppercase">
 {severity === "failure" ? "Review" : "Recorded"}
 </Badge>
 <p className="mt-1 text-xs text-muted-foreground">{formatHumanDateTime(event.createdAt)}</p>
 </div>
 </div>
 );
 })}
 {!auditEvents.length ? <div className="rounded-sm bg-muted/50 p-4 text-center text-sm text-muted-foreground">No recent audit events.</div> : null}
 </div>
 </CardContent>
 </Card>
 </div>
 </div>

 <div className="grid content-start gap-6">
 <div>
 <Card>
 <CardHeader>
 <CardTitle>Infrastructure Health</CardTitle>
 </CardHeader>
 <CardContent>
 <div className={`flex items-center gap-4 rounded-sm border p-4 ${systemOk ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-900/10" : "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10"}`}>
 <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${systemOk ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"}`}>
 {systemOk ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
 </span>
 <div>
 <p className={`text-sm font-semibold ${systemOk ? "text-emerald-900 dark:text-emerald-200" : "text-red-900 dark:text-red-200"}`}>
 {systemOk ? "All systems operational" : "Platform health check failed"}
 </p>
 <p className={`mt-0.5 text-xs ${systemOk ? "text-emerald-700 dark:text-emerald-400/80" : "text-red-700 dark:text-red-400/80"}`}>
 {systemOk ? "API and services responding normally." : "The health endpoint returned a failure response. Check server logs."}
 </p>
 </div>
 </div>
 {!systemOk && (
 <div className="mt-3 rounded-sm border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
 Service degradation detected. Review infrastructure logs and check connectivity to the API gateway.
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 </div>
 );
};

export default AdminDashboard;
