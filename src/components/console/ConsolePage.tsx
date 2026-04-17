import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ConsolePageProps {
  children: ReactNode;
  className?: string;
}

export const ConsolePage = ({ children, className }: ConsolePageProps) => (
  <div className={cn("space-y-6", className)}>{children}</div>
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="page-kicker">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold font-heading lg:text-3xl">{title}</h1>
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
                {item.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>}
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
  <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
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
