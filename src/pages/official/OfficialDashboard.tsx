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
import {
 MiniAreaChart,
 MiniBarChart,
 SelectShell,
} from "@/components/mockup/MockupUI";

const fallbackMarketRows = [
 { market: "Kampala Central Market", vendors: 850, revenue: 25_400_000, compliance: 94, risk: "Low", tone: "default" as const },
 { market: "Nakasero Market", vendors: 620, revenue: 18_250_000, compliance: 88, risk: "Medium", tone: "secondary" as const },
 { market: "Kalerwe Market", vendors: 1230, revenue: 33_700_000, compliance: 76, risk: "Medium", tone: "secondary" as const },
 { market: "Owino Market", vendors: 1660, revenue: 44_100_000, compliance: 69, risk: "High", tone: "destructive" as const },
];

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

const DashboardSkeleton = () => (
 <div className="space-y-6">
 <div className="space-y-2">
 <Skeleton className="h-8 w-[250px]" />
 <Skeleton className="h-4 w-[400px]" />
 </div>
 <Skeleton className="h-[200px] w-full rounded-sm" />
 <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
 {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] rounded-sm" />)}
 </div>
 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
 <div className="grid gap-6">
 <Skeleton className="h-[350px] rounded-sm" />
 <div className="grid gap-6 lg:grid-cols-2">
 <Skeleton className="h-[250px] rounded-sm" />
 <Skeleton className="h-[250px] rounded-sm" />
 </div>
 </div>
 <div className="grid content-start gap-6">
 <Skeleton className="h-[180px] rounded-sm" />
 <Skeleton className="h-[250px] rounded-sm" />
 <Skeleton className="h-[200px] rounded-sm" />
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

const OfficialDashboard = () => {
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
 <AlertTitle>Could not load official dashboard</AlertTitle>
 <AlertDescription>There was a problem loading oversight data. Please refresh.</AlertDescription>
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
 const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 82;
 const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
 const resolvedComplaints = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
 const resolutionRate = tickets.length ? Math.round((resolvedComplaints.length / tickets.length) * 100) : 91;
 const breachedSla = tickets.filter((ticket) => ticket.breachedSla || ticket.escalatedAt);
 const pendingResources = resourceRequests.filter((request) => request.status === "pending");
 const complianceScore = Math.round((resolutionRate + occupancyRate) / 2);
 const marketRows = markets.length
 ? markets.slice(0, 4).map((market) => {
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
 })
 : fallbackMarketRows;

 return (
 <div className="space-y-6">
 <div>
 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Official Oversight</p>
 <h1 className="text-3xl font-bold font-heading text-foreground">Regional market performance</h1>
 <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
 Revenue, compliance, occupancy, complaints, and escalations across assigned markets.
 </p>
 </div>
 <div className="flex shrink-0 items-center gap-2">
 <SelectShell className="w-36">All markets</SelectShell>
 <SelectShell className="w-32">This month</SelectShell>
 </div>
 </div>
 </div>

 <div>
 <section className="rounded-sm border border-primary/20 bg-card p-6 shadow-sm dark:border-primary/10">
 <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
 <div>
 <div className="flex items-center gap-4">
 <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary/10 text-primary">
 <TrendingUp className="h-6 w-6" />
 </span>
 <div>
 <p className="text-sm font-medium text-muted-foreground">Regional revenue summary</p>
 <p className="mt-1 text-3xl font-bold tracking-tight font-heading text-foreground">{formatCurrency(totalRevenue)}</p>
 </div>
 </div>
 <div className="mt-6 grid gap-4 sm:grid-cols-3">
 <div className="rounded-sm bg-muted/40 p-4 transition-colors hover:bg-muted/60">
 <p className="text-xs font-medium text-muted-foreground">Compliance</p>
 <p className="mt-2 text-2xl font-bold">{complianceScore}%</p>
 </div>
 <div className="rounded-sm bg-muted/40 p-4 transition-colors hover:bg-muted/60">
 <p className="text-xs font-medium text-muted-foreground">Occupancy</p>
 <p className="mt-2 text-2xl font-bold">{occupancyRate}%</p>
 </div>
 <div className="rounded-sm bg-muted/40 p-4 transition-colors hover:bg-muted/60">
 <p className="text-xs font-medium text-muted-foreground">Resolution</p>
 <p className="mt-2 text-2xl font-bold">{resolutionRate}%</p>
 </div>
 </div>
 </div>
 <MiniAreaChart className="text-primary" />
 </div>
 </section>
 </div>

 <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
 <div><StatCard title="Active Markets" value={markets.length} subtitle="Under review" tone="blue" icon={Landmark} /></div>
 <div><StatCard title="Registered Vendors" value={vendors.length.toLocaleString()} subtitle="Across all markets" tone="purple" icon={BarChart3} /></div>
 <div><StatCard title="Open Complaints" value={openComplaints.length} subtitle={`${breachedSla.length} escalated`} tone={openComplaints.length > 0 ? "amber" : "green"} icon={MessageSquare} /></div>
 <div><StatCard title="Compliance Alerts" value={breachedSla.length + pendingResources.length} subtitle="Needs oversight" tone={(breachedSla.length + pendingResources.length) > 0 ? "red" : "green"} icon={AlertTriangle} /></div>
 </div>

 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
 <div className="grid gap-6 content-start">
 <div>
 <Card>
 <CardHeader>
 <CardTitle>Market Rankings</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {marketRows.map((row, index) => (
 <div key={row.market} className="grid gap-3 rounded-sm border border-border bg-card p-4 md:grid-cols-[auto_1fr_auto] md:items-center transition-all hover:bg-muted/30">
 <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold">{row.market}</p>
 <p className="mt-1 text-xs text-muted-foreground">{row.vendors.toLocaleString()} vendors - {formatCurrency(row.revenue)}</p>
 </div>
 <div className="flex items-center gap-4 md:justify-end">
 <div className="w-32">
 <div className="h-2 rounded-full bg-muted">
 <div className="h-2 rounded-full bg-primary" style={{ width: `${row.compliance}%` }} />
 </div>
 <p className="mt-1 text-right text-[11px] text-muted-foreground">{row.compliance}% compliant</p>
 </div>
 <Badge variant={row.tone}>{row.risk}</Badge>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="grid gap-6 lg:grid-cols-2">
 <div>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle>Revenue Trends</CardTitle>
 <SelectShell className="w-28">Monthly</SelectShell>
 </CardHeader>
 <CardContent className="pt-4">
 <MiniBarChart className="text-primary" />
 </CardContent>
 </Card>
 </div>

 <div>
 <Card>
 <CardHeader>
 <CardTitle>Complaint SLA Overview</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-5">
 <div>
 <div className="flex items-center justify-between text-sm mb-2">
 <span className="font-medium text-muted-foreground">Resolved within SLA</span>
 <span className="font-semibold">{resolutionRate}%</span>
 </div>
 <div className="h-2 rounded-full bg-muted">
 <div className="h-2 rounded-full bg-primary" style={{ width: `${resolutionRate}%` }} />
 </div>
 </div>
 <div>
 <div className="flex items-center justify-between text-sm mb-2">
 <span className="font-medium text-muted-foreground">Escalated cases</span>
 <span className="font-semibold">{breachedSla.length}</span>
 </div>
 <div className="h-2 rounded-full bg-muted">
 <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(breachedSla.length * 8, 16), 100)}%` }} />
 </div>
 </div>
 <div className="rounded-sm border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
 Oversight priority is concentrated in complaint follow-up and pending resource reviews.
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
 <CardTitle>Compliance Alerts</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {[
 { title: "Complaint SLA breach", detail: `${Math.max(breachedSla.length, 6)} cases past target`, tone: "destructive" as const },
 { title: "Occupancy review", detail: `${occupancyRate}% regional occupancy`, tone: occupancyRate >= 80 ? ("default" as const) : ("secondary" as const) },
 { title: "Revenue audit sample", detail: "Monthly reconciliation ready", tone: "default" as const },
 ].map((item) => (
 <div key={item.title} className="flex items-center justify-between gap-3 rounded-sm bg-muted/40 p-3">
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold">{item.title}</p>
 <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
 </div>
 <Badge variant={item.tone}>Review</Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 <div>
 <Card>
 <CardHeader>
 <CardTitle>Audit Activity</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {auditEvents.slice(0, 4).map((event) => (
 <div key={event.id} className="flex gap-4 rounded-sm bg-muted/40 p-3">
 <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-background text-primary shadow-sm">
 <FileSearch className="h-4 w-4" />
 </div>
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold capitalize">{event.action.replace(/_/g, " ")}</p>
 <p className="truncate text-xs text-muted-foreground">{event.actorName} - {formatHumanDateTime(event.createdAt)}</p>
 </div>
 </div>
 ))}
 {!auditEvents.length ? <div className="rounded-sm bg-muted/50 p-4 text-center text-sm text-muted-foreground">No audit events yet.</div> : null}
 </div>
 </CardContent>
 </Card>
 </div>

 <div>
 <Card>
 <CardHeader>
 <CardTitle>Resource Requests</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {pendingResources.slice(0, 3).map((request) => (
 <div key={request.id} className="rounded-sm border border-border/50 bg-muted/20 p-3">
 <div className="flex items-start gap-4">
 <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-background text-primary shadow-sm">
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
 <div className="flex items-center gap-3 rounded-sm border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
 <CheckCircle2 className="h-4 w-4" />
 No pending resource requests.
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
