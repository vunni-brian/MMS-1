import type { ChangeEvent, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ConsolePageProps {
  children: ReactNode;
  className?: string;
}

export const ConsolePage = ({ children, className }: ConsolePageProps) => (
  <div className={cn("mx-auto flex w-full max-w-[1500px] flex-col gap-4", className)}>{children}</div>
);

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, description, actions, meta }: PageHeaderProps) => (
  <section className="console-section">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="page-kicker">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold leading-tight font-heading lg:text-[1.7rem]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {meta && <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </section>
);

interface ScopeBarProps {
  children: ReactNode;
  className?: string;
}

export const ScopeBar = ({ children, className }: ScopeBarProps) => (
  <section className={cn("console-scope-bar", className)}>{children}</section>
);

interface ScopeItemProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export const ScopeItem = ({ label, children, className }: ScopeItemProps) => (
  <div className={cn("min-w-[160px] space-y-1.5", className)}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    {children}
  </div>
);

interface KpiItem {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ElementType;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

const kpiToneStyles: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "text-muted-foreground bg-muted/45",
  success: "text-foreground bg-muted/45",
  warning: "text-foreground bg-muted/45",
  destructive: "text-foreground bg-muted/45",
  info: "text-foreground bg-muted/45",
};

interface KpiStripProps {
  items: KpiItem[];
  columns?: string;
}

export const KpiStrip = ({ items, columns = "grid-cols-2 lg:grid-cols-4" }: KpiStripProps) => (
  <section className={cn("grid gap-3", columns)}>
    {items.map((item) => {
      const Icon = item.icon;
      const tone = item.tone || "default";

      return (
        <Card key={item.label} className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 truncate text-xl font-bold font-heading">{item.value}</p>
                {item.detail && <div className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</div>}
              </div>
              {Icon && (
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", kpiToneStyles[tone])}>
                  <Icon className="h-4 w-4" />
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      );
    })}
  </section>
);

interface EvidenceFieldProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export const EvidenceField = ({ label, value, mono = false, className }: EvidenceFieldProps) => (
  <div className={cn("rounded-md border border-border/60 bg-muted/20 p-3", className)}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className={cn("mt-1 break-words text-sm font-medium", mono && "font-mono text-xs")}>{value}</div>
  </div>
);

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-4 py-7 text-center">
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

interface LoadingStateProps {
  rows?: number;
  className?: string;
  itemClassName?: string;
}

export const LoadingState = ({ rows = 4, className, itemClassName = "h-24 rounded-lg" }: LoadingStateProps) => (
  <div className={cn("grid gap-3", className)}>
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
  <section className={cn("console-table-card", className)}>
    {(title || description || actions) && (
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {title && <h2 className="text-base font-semibold font-heading">{title}</h2>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
  <section className={cn("rounded-lg border border-border/70 bg-card p-4 shadow-sm", className)}>
    <div className="flex flex-col gap-3 border-b border-border/70 pb-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-base font-semibold font-heading">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
    <div className="mt-4 space-y-4">{children}</div>
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
      "block rounded-xl border border-dashed border-border/80 bg-muted/10 p-4 transition-colors",
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-border hover:bg-muted/20",
      className,
    )}
  >
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      <span className="inline-flex h-9 items-center justify-center rounded-md border border-border/70 bg-background px-3 text-xs font-semibold text-muted-foreground">
        Choose File
      </span>
    </div>
    <p className="mt-3 truncate rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">{value || "No file selected"}</p>
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
  <section className={cn("dashboard-panel", className)}>
    {(title || description || actions) && (
      <div className="dashboard-panel-header">
        <div className="min-w-0">
          {title && <h2 className="text-base font-semibold leading-tight font-heading">{title}</h2>}
          {description && <div className="mt-1 text-sm leading-5 text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn("dashboard-panel-body", contentClassName)}>{children}</div>
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
  <div className={cn("rounded-md border border-border/70 bg-background/80 p-3", className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 truncate text-lg font-bold leading-tight font-heading">{value}</div>
        {detail && <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>}
      </div>
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
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
  <div className={cn("rounded-md border border-border/70 bg-background/80 p-3", className)}>
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
  <div className={cn("flex flex-wrap gap-1 rounded-md bg-muted p-1", className)}>
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-semibold transition-colors",
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
    <SheetContent className={cn("w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl", className)}>
      <SheetHeader className="pr-6">
        <SheetTitle className="font-heading">{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
      </SheetHeader>
      <div className="mt-6">{children}</div>
    </SheetContent>
  </Sheet>
);
