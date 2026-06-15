import type { ChangeEvent, ElementType, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
 getPageBreadcrumbs,
 getPageIdentity,
 getPageType,
 type PageAccent,
 type PageKind,
} from "@/config/pageIdentity";

interface ConsolePageProps {
 children: ReactNode;
 className?: string;
 kind?: PageKind;
 accent?: PageAccent;
}

export const ConsolePage = ({ children, className, kind, accent }: ConsolePageProps) => {
 const location = useLocation();
 const identity = getPageIdentity(location.pathname);
 const pageType = getPageType(location.pathname);
 const resolvedKind = kind || identity.kind;
 const resolvedAccent = accent || identity.accent;

 return (
 <div
 className={cn(
 "console-page enterprise-page flex-1 space-y-6 bg-transparent text-slate-950",
 `console-accent-${resolvedAccent}`,
 `console-page-type-${pageType}`,
 `console-page-${resolvedKind}`,
 className,
 )}
 data-page-kind={resolvedKind}
 data-page-accent={resolvedAccent}
 data-page-type={pageType}
 >
 {children}
 </div>
 );
};

interface WorkspacePageProps {
 title: string;
 subtitle?: ReactNode;
 actions?: ReactNode;
 context?: ReactNode;
 filters?: ReactNode;
 children: ReactNode;
 className?: string;
}

export const WorkspacePage = ({
 title,
 subtitle,
 actions,
 context,
 filters,
 children,
 className,
}: WorkspacePageProps) => (
 <div className={cn("workspace-page space-y-6", className)}>
 <div className="workspace-page-hero">
 <div className="min-w-0 space-y-1">
 <h1 className="workspace-page-title">{title}</h1>
 {subtitle && <p className="workspace-page-subtitle">{subtitle}</p>}
 {context && <div className="workspace-page-context">{context}</div>}
 </div>
 {actions && <div className="workspace-page-actions">{actions}</div>}
 </div>
 {filters && <div className="workspace-filter-bar">{filters}</div>}
 <div className="primary-surface">{children}</div>
 </div>
);

interface DataSurfaceProps {
 children: ReactNode;
 className?: string;
}

export const DataSurface = ({ children, className }: DataSurfaceProps) => (
 <div className={cn("data-surface overflow-hidden", className)}>{children}</div>
);

interface DashboardShellProps {
 children: ReactNode;
 className?: string;
}

export const DashboardShell = ({ children, className }: DashboardShellProps) => (
 <div className={cn("enterprise-shell", className)}>{children}</div>
);

export const MainWorkspace = ({ children, className }: DashboardShellProps) => (
 <main className={cn("enterprise-main-workspace", className)}>{children}</main>
);

export const InsightsRail = ({ children, className }: DashboardShellProps) => (
 <aside className={cn("enterprise-insights-rail", className)}>{children}</aside>
);

interface PageHeaderProps {
 eyebrow?: string;
 title: string;
 description?: ReactNode;
 actions?: ReactNode;
 meta?: ReactNode;
 icon?: ElementType;
 kind?: PageKind;
 accent?: PageAccent;
 breadcrumbs?: Array<{ label: string; path?: string }>;
}

export const PageHeader = ({
 eyebrow,
 title,
 description,
 actions,
 meta,
 icon,
 kind,
 accent,
 breadcrumbs,
}: PageHeaderProps) => {
 const location = useLocation();
 const identity = getPageIdentity(location.pathname);
 const pageType = getPageType(location.pathname);
 const resolvedKind = kind || identity.kind;
 const resolvedAccent = accent || identity.accent;
 const trail = breadcrumbs || getPageBreadcrumbs(location.pathname);
 const Icon = icon || identity.icon;

 return (
 <header
 className={cn(
 "page-identity-header",
 `page-header-${resolvedKind}`,
 `console-accent-${resolvedAccent}`,
 `console-page-type-${pageType}`,
 )}
 data-page-kind={resolvedKind}
 data-page-accent={resolvedAccent}
 >
 <div className="page-header-chrome">
 {trail.length > 0 && (
 <nav className="breadcrumb-trail" aria-label="Breadcrumb">
 {trail.map((item) => (
 <span key={`${item.label}-${item.path || "current"}`} className="breadcrumb-item">
 {item.path ? <Link to={item.path}>{item.label}</Link> : <span>{item.label}</span>}
 </span>
 ))}
 </nav>
 )}
 {eyebrow && <p className="page-kicker">{eyebrow}</p>}
 </div>
 <div className="page-header-main">
 <div className="flex min-w-0 gap-3">
 {Icon && (
 <span className="page-header-icon">
 <Icon className="h-5 w-5" />
 </span>
 )}
 <div className="min-w-0">
 <h1 className="page-title">{title}</h1>
 {description && <div className="page-description">{description}</div>}
 {meta && <div className="page-meta">{meta}</div>}
 </div>
 </div>
 {actions && <div className="page-actions">{actions}</div>}
 </div>
 </header>
 );
};

interface ScopeBarProps {
 children: ReactNode;
 className?: string;
}

export const ScopeBar = ({ children, className }: ScopeBarProps) => (
 <section className={cn("console-scope-bar enterprise-filter-bar", className)}>{children}</section>
);

interface ScopeItemProps {
 label: string;
 children: ReactNode;
 className?: string;
}

export const ScopeItem = ({ label, children, className }: ScopeItemProps) => (
 <div className={cn("min-w-0 space-y-1.5 md:min-w-[160px]", className)}>
 <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
 {children}
 </div>
);

interface KpiItem {
 label: string;
 value: ReactNode;
 detail?: ReactNode;
 icon?: ElementType;
 tone?: "default" | "success" | "warning" | "destructive" | "info";
 trend?: ReactNode;
 sparkline?: number[];
}

const kpiToneStyles: Record<NonNullable<KpiItem["tone"]>, string> = {
 default: "border-border/70 bg-muted/45 text-muted-foreground",
 success: "border-success/25 bg-success/10 text-success",
 warning: "border-warning/25 bg-warning/10 text-warning",
 destructive: "border-destructive/25 bg-destructive/10 text-destructive",
 info: "border-info/25 bg-info/10 text-info",
};

const kpiTrendLabels: Record<NonNullable<KpiItem["tone"]>, string> = {
 default: "Stable",
 success: "On track",
 warning: "Watch",
 destructive: "Critical",
 info: "Live",
};

const kpiSparklineStyles: Record<NonNullable<KpiItem["tone"]>, string> = {
 default: "text-muted-foreground",
 success: "text-success",
 warning: "text-warning",
 destructive: "text-destructive",
 info: "text-info",
};

const sparklinePresets = [
 [18, 23, 21, 26, 31, 29, 35],
 [30, 28, 32, 31, 37, 35, 39],
 [21, 26, 24, 29, 27, 33, 31],
 [36, 34, 30, 32, 27, 25, 28],
 [19, 22, 25, 24, 28, 31, 34],
];

const getSparklinePoints = (values: number[]) => {
 const width = 74;
 const height = 24;
 const min = Math.min(...values);
 const max = Math.max(...values);
 const range = max - min || 1;

 return values
 .map((value, index) => {
 const x = (index / Math.max(values.length - 1, 1)) * width;
 const y = height - ((value - min) / range) * height;
 return `${x.toFixed(1)},${y.toFixed(1)}`;
 })
 .join(" ");
};

interface MiniSparklineProps {
 values?: number[];
 className?: string;
}

export const MiniSparkline = ({ values = sparklinePresets[0], className }: MiniSparklineProps) => (
 <svg viewBox="0 0 74 24" aria-hidden="true" className={cn("h-6 w-[74px] overflow-visible", className)}>
 <polyline
 points={getSparklinePoints(values)}
 fill="none"
 stroke="currentColor"
 strokeWidth="1.8"
 strokeLinecap="round"
 strokeLinejoin="round"
 opacity="0.82"
 />
 <polyline
 points={getSparklinePoints(values)}
 fill="none"
 stroke="currentColor"
 strokeWidth="5"
 strokeLinecap="round"
 strokeLinejoin="round"
 opacity="0.08"
 />
 </svg>
);

interface KpiStripProps {
 items: KpiItem[];
 columns?: string;
}

export const KpiStrip = ({ items, columns = "grid-cols-2 lg:grid-cols-4" }: KpiStripProps) => {
 const location = useLocation();
 const pageType = getPageType(location.pathname);

 if (pageType !== "dashboard") {
 return null;
 }

 return (
 <section className={cn("kpi-strip grid gap-4", columns)}>
 {items.map((item, index) => {
 const Icon = item.icon;
 const tone = item.tone || "default";
 const sparkline = item.sparkline || sparklinePresets[index % sparklinePresets.length];

 return (
 <Card key={item.label} className="stat-card min-h-20">
 <CardContent className="p-3">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-medium leading-4 text-muted-foreground">{item.label}</p>
 <p className="mt-1 break-words text-base font-bold leading-none font-heading tabular-nums sm:text-lg">{item.value}</p>
 </div>
 {Icon && (
 <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", kpiToneStyles[tone])}>
 <Icon className="h-3.5 w-3.5" />
 </span>
 )}
 </div>
 <div className="mt-2 flex items-end justify-between gap-2">
 <div className="min-w-0">
 <div className={cn("inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-4", kpiToneStyles[tone])}>
 {item.trend || kpiTrendLabels[tone]}
 </div>
 {item.detail && <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.detail}</div>}
 </div>
 <MiniSparkline values={sparkline} className={kpiSparklineStyles[tone]} />
 </div>
 </CardContent>
 </Card>
 );
 })}
 </section>
 );
};

interface EvidenceFieldProps {
 label: string;
 value: ReactNode;
 mono?: boolean;
 className?: string;
}

export const EvidenceField = ({ label, value, mono = false, className }: EvidenceFieldProps) => (
 <div className={cn("rounded-lg border border-border/60 bg-muted/15 p-3", className)}>
 <p className="text-xs text-muted-foreground">{label}</p>
 <div className={cn("mt-1 break-words text-sm font-medium", mono && "font-mono text-xs")}>{value}</div>
 </div>
);

interface EmptyStateProps {
 title: string;
 description?: string;
 action?: ReactNode;
 icon?: ElementType;
}

export const EmptyState = ({ title, description, action, icon: Icon = Inbox }: EmptyStateProps) => (
 <div className="empty-state rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-center">
 <div className="empty-state-icon mx-auto mb-3">
 <Icon className="h-5 w-5" />
 </div>
 <p className="text-sm font-semibold font-heading">{title}</p>
 {description && <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>}
 {action && <div className="mt-3 flex justify-center">{action}</div>}
 </div>
);

interface LoadingStateProps {
 rows?: number;
 className?: string;
 itemClassName?: string;
}

export const LoadingState = ({ rows = 4, className, itemClassName = "h-20 rounded-lg" }: LoadingStateProps) => (
 <div className={cn("grid gap-4", className)}>
 {Array.from({ length: rows }).map((_, index) => (
 <Skeleton key={index} className={itemClassName} />
 ))}
 </div>
);

interface DataTableFrameProps {
 title?: string;
 description?: string;
 actions?: ReactNode;
 children: ReactNode;
 className?: string;
}

export const DataTableFrame = ({ title, description, actions, children, className }: DataTableFrameProps) => (
 <section className={cn("console-table-card enterprise-panel overflow-hidden", className)}>
 {(title || description || actions) && (
 <div className="data-table-header flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="min-w-0">
 {title && <h2 className="text-sm font-semibold font-heading text-slate-950">{title}</h2>}
 {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
 </div>
 {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
 </div>
 )}
 <div className="overflow-x-auto">{children}</div>
 </section>
);

interface FormSectionProps {
 title: string;
 description?: string;
 children: ReactNode;
 actions?: ReactNode;
 className?: string;
}

export const FormSection = ({ title, description, children, actions, className }: FormSectionProps) => (
 <section className={cn("form-section enterprise-panel p-4", className)}>
 <div className="flex flex-col gap-2 border-b border-border/70 pb-2.5 sm:flex-row sm:items-start sm:justify-between">
 <div className="min-w-0">
 <h2 className="text-sm font-semibold font-heading">{title}</h2>
 {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
 </div>
 {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
 </div>
 <div className="mt-3 space-y-3">{children}</div>
 </section>
);

interface FileUploadCardProps {
 id: string;
 label: string;
 description?: string;
 value?: string;
 accept?: string;
 capture?: boolean | "user" | "environment";
 disabled?: boolean;
 className?: string;
 onChange: (file: File | null) => void;
}

export const FileUploadCard = ({ id, label, description, value, accept, capture, disabled = false, className, onChange }: FileUploadCardProps) => (
 <label
 htmlFor={id}
 className={cn(
 "group block rounded-lg border border-dashed border-border/80 bg-muted/10 p-3 transition-colors",
 disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/40 hover:bg-muted/20",
 className,
 )}
 >
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-sm font-medium">{label}</p>
 {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
 </div>
 <span className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
 Choose File
 </span>
 </div>
 <p className="mt-2 truncate rounded-lg bg-background px-2.5 py-1.5 text-xs text-muted-foreground">{value || "No file selected"}</p>
 <input
 id={id}
 type="file"
 accept={accept}
 capture={capture}
 disabled={disabled}
 className="sr-only"
 onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0] || null)}
 />
 </label>
);

interface PanelProps {
 title?: string;
 description?: ReactNode;
 actions?: ReactNode;
 children: ReactNode;
 className?: string;
 contentClassName?: string;
}

export const Panel = ({ title, description, actions, children, className, contentClassName }: PanelProps) => (
 <section className={cn("dashboard-panel enterprise-panel overflow-hidden", className)}>
 {(title || description || actions) && (
 <div className="dashboard-panel-header flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="min-w-0">
 {title && <h2 className="text-sm font-semibold font-heading text-slate-950">{title}</h2>}
 {description && <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>}
 </div>
 {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
 </div>
 )}
 <div className={cn("dashboard-panel-body p-4", contentClassName)}>{children}</div>
 </section>
);

interface MetricTileProps {
 label: string;
 value: ReactNode;
 detail?: ReactNode;
 icon?: ElementType;
 className?: string;
}

export const MetricTile = ({ label, value, detail, icon: Icon, className }: MetricTileProps) => (
 <div className={cn("metric-tile rounded-lg border border-border/70 bg-background/80 p-3", className)}>
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate text-xs text-muted-foreground">{label}</p>
 <div className="mt-1 truncate text-lg font-bold leading-tight font-heading">{value}</div>
 {detail && <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>}
 </div>
 {Icon && (
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
 <Icon className="h-4 w-4" />
 </span>
 )}
 </div>
 </div>
);

interface RecordCardProps {
 children: ReactNode;
 className?: string;
}

export const RecordCard = ({ children, className }: RecordCardProps) => (
 <div className={cn("record-card rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50", className)}>
 {children}
 </div>
);

interface SegmentedControlOption<Value extends string> {
 value: Value;
 label: string;
 count?: number;
}

interface SegmentedControlProps<Value extends string> {
 value: Value;
 options: SegmentedControlOption<Value>[];
 onChange: (value: Value) => void;
 className?: string;
}

export const SegmentedControl = <Value extends string,>({
 value,
 options,
 onChange,
 className,
}: SegmentedControlProps<Value>) => (
 <div className={cn("flex flex-wrap gap-1 rounded-lg bg-muted p-1", className)} role="tablist" aria-label="Tab navigation">
 {options.map((option) => {
 const selected = option.value === value;
 return (
 <button
 key={option.value}
 type="button"
 onClick={() => onChange(option.value)}
 role="tab"
 aria-selected={selected}
 aria-controls={`panel-${option.value}`}
 tabIndex={selected ? 0 : -1}
 onKeyDown={(e) => {
 if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
 e.preventDefault();
 const currentIndex = options.findIndex((opt) => opt.value === option.value);
 const direction = e.key === "ArrowRight" ? 1 : -1;
 const nextIndex = (currentIndex + direction + options.length) % options.length;
 onChange(options[nextIndex].value);
 }
 }}
 className={cn(
 "inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
 selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
 )}
 >
 {option.label}
 {typeof option.count === "number" && (
 <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", selected ? "bg-muted" : "bg-background/70")}>
 {option.count}
 </span>
 )}
 </button>
 );
 })}
 </div>
);

interface DetailSheetProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 title: string;
 description?: string;
 children: ReactNode;
 className?: string;
}

export const DetailSheet = ({ open, onOpenChange, title, description, children, className }: DetailSheetProps) => (
 <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent 
 className={cn("w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl", className)}
 aria-describedby={description ? "detail-description" : undefined}
 >
 <SheetHeader className="pr-6">
 <SheetTitle className="font-heading">{title}</SheetTitle>
 {description && <SheetDescription id="detail-description">{description}</SheetDescription>}
 </SheetHeader>
 <div className="mt-4">{children}</div>
 {/* Mobile close action. */}
 <div className="sticky bottom-0 mt-6 border-t border-border/70 bg-background pt-3 sm:hidden">
 <button
 type="button"
 onClick={() => onOpenChange(false)}
 className="flex h-11 w-full items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
 >
 Close
 </button>
 </div>
 </SheetContent>
 </Sheet>
);
