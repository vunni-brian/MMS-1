import { Activity } from "lucide-react";

import { MiniSparkline } from "@/components/console/ConsolePage";
import { useRoleInsights, type InsightAlert, type InsightMetric, type InsightTone } from "@/hooks/useRoleInsights";
import { cn } from "@/lib/utils";
import type { AppNotification, AuthUser } from "@/types";

const toneClassName = (tone: InsightTone = "default") => {
 if (tone === "success") return "border-success/20 bg-success/10 text-success";
 if (tone === "warning") return "border-warning/25 bg-warning/10 text-warning";
 if (tone === "destructive") return "border-destructive/25 bg-destructive/10 text-destructive";
 if (tone === "info") return "border-info/20 bg-info/10 text-info";
 return "border-border/70 bg-muted/35 text-muted-foreground";
};

const InsightRow = ({ item }: { item: InsightMetric }) => (
 <div className="rounded-sm border border-border/70 bg-background/80 p-2.5">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate text-[11px] font-medium text-muted-foreground">{item.label}</p>
 <p className="mt-1 truncate text-base font-bold leading-none font-heading tabular-nums">{item.value}</p>
 </div>
 <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-4", toneClassName(item.tone))}>
 {item.detail}
 </span>
 </div>
 </div>
);

const AlertRow = ({ alert }: { alert: InsightAlert }) => (
 <div className="rounded-sm border border-border/70 bg-background/80 p-2.5">
 <div className="flex items-start gap-2.5">
 <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", alert.tone === "destructive" ? "bg-destructive" : alert.tone === "warning" ? "bg-warning" : alert.tone === "success" ? "bg-success" : "bg-info")} />
 <div className="min-w-0">
 <p className="truncate text-xs font-semibold">{alert.label}</p>
 <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{alert.detail}</p>
 </div>
 </div>
 </div>
);

interface RoleInsightsRailProps {
 user: AuthUser;
 isPendingVendor: boolean;
 notifications: AppNotification[];
}

export const RoleInsightsRail = ({ user, isPendingVendor, notifications }: RoleInsightsRailProps) => {
 const { metrics, alerts, trendValues } = useRoleInsights({ user, isPendingVendor, notifications });

 return (
 <aside className="role-insights-rail hidden w-[280px] shrink-0 flex-col border-l border-border/70 bg-card/85 xl:flex">
 <div className="border-b border-border/70 px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-sm font-semibold font-heading">Attention</p>
 <p className="mt-0.5 text-[11px] text-muted-foreground">Useful live context</p>
 </div>
 <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", isPendingVendor ? toneClassName("warning") : toneClassName("success"))}>
 {isPendingVendor ? "Limited" : "Live"}
 </span>
 </div>
 </div>

 <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
 <div className="space-y-2">
 {metrics.map((metric) => (
 <InsightRow key={metric.label} item={metric} />
 ))}
 </div>

 <div className="mt-4 rounded-sm border border-border/70 bg-background/80 p-3">
 <div className="flex items-center justify-between">
 <p className="section-eyebrow">Activity Trend</p>
 <Activity className="h-3.5 w-3.5 text-muted-foreground" />
 </div>
 <MiniSparkline values={trendValues} className="mt-3 h-10 w-full text-primary" />
 <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] text-muted-foreground">
 <span>Cases</span>
 <span>Cash</span>
 <span>Risk</span>
 </div>
 </div>

 <div className="mt-4">
 <div className="mb-2 flex items-center justify-between">
 <p className="section-eyebrow">Attention</p>
 <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{alerts.length}</span>
 </div>
 <div className="space-y-2">
 {alerts.length ? (
 alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
 ) : (
 <div className="rounded-sm border border-dashed border-border/70 bg-background/80 p-3 text-center">
 <p className="text-xs font-medium">No active attention items</p>
 <p className="mt-1 text-[11px] text-muted-foreground">Exceptions and approvals will appear here.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </aside>
 );
};
