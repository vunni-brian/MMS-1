import type { ElementType, ReactNode } from "react";
import * as React from "react";
import { Search, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * PriorityIndicator - Visual priority cue for highlighting important items
 * Supports multiple tone levels: danger, warning, success, info, default
 */
interface PriorityIndicatorProps {
  priority: "danger" | "warning" | "success" | "info" | "default";
  label?: string;
  className?: string;
  showIcon?: boolean;
  animated?: boolean;
}

const priorityStyles: Record<string, string> = {
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  warning: "border-warning/25 bg-warning/15 text-warning",
  success: "border-success/20 bg-success/15 text-success",
  info: "border-info/20 bg-info/15 text-info",
  default: "border-border/50 bg-muted/50 text-muted-foreground",
};

const priorityIcons: Record<string, ElementType> = {
  danger: AlertCircle,
  warning: AlertCircle,
  success: CheckCircle2,
  info: AlertCircle,
  default: AlertCircle,
};

export const PriorityIndicator = ({
  priority,
  label,
  className,
  showIcon = true,
  animated = false,
}: PriorityIndicatorProps) => {
  const Icon = priorityIcons[priority];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        priorityStyles[priority],
        animated && "animate-pulse",
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {label && <span className="truncate">{label}</span>}
    </div>
  );
};

/**
 * QuickActionCard - Fast-access action card with icon and description
 */
interface QuickActionCardProps {
  icon: ElementType;
  title: string;
  description: string;
  action?: () => void;
  href?: string;
  disabled?: boolean;
  priority?: "normal" | "high";
  className?: string;
}

export const QuickActionCard = ({
  icon: Icon,
  title,
  description,
  action,
  href,
  disabled = false,
  priority = "normal",
  className,
}: QuickActionCardProps) => {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            priority === "high"
              ? "border-warning/30 bg-warning/15 text-warning"
              : "border-border/70 bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
      </div>
    </>
  );

  if (disabled) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/30 bg-muted/30 p-3 opacity-50",
          className
        )}
      >
        {content}
      </div>
    );
  }

  if (action) {
    return (
      <button
        onClick={action}
        className={cn(
          "flex w-full rounded-lg border border-border/70 bg-card p-3 transition-all hover:border-border hover:bg-accent",
          className
        )}
      >
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "flex w-full rounded-lg border border-border/70 bg-card p-3 transition-all hover:border-border hover:bg-accent",
          className
        )}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border/70 bg-card p-3", className)}>
      {content}
    </div>
  );
};

/**
 * QuickActionsPanel - Container for quick action cards with optional title
 */
interface QuickActionsPanelProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export const QuickActionsPanel = ({
  title,
  description,
  children,
  className,
}: QuickActionsPanelProps) => (
  <div className={cn("space-y-3", className)}>
    {title && (
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
    )}
    <div className="grid gap-2 sm:grid-cols-2">{children}</div>
  </div>
);

/**
 * CompactStatusCard - Status information at a glance with minimal layout
 */
interface CompactStatusCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ElementType;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  action?: ReactNode;
  className?: string;
}

const toneStyles: Record<string, string> = {
  default: "border-border/50 bg-muted/30 text-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/15 text-warning",
  danger: "border-destructive/20 bg-destructive/15 text-destructive",
  info: "border-info/20 bg-info/15 text-info",
};

export const CompactStatusCard = ({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  action,
  className,
}: CompactStatusCardProps) => (
  <div
    className={cn(
      "rounded-lg border p-3 transition-colors hover:bg-accent/50",
      toneStyles[tone],
      className
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-bold leading-none">{value}</p>
        {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      {Icon && <Icon className="mt-1 h-4 w-4 shrink-0 text-current" />}
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/**
 * FilteredRecordList - Searchable, sortable list for quick item location
 */
interface FilteredRecordListProps<T> {
  items: T[];
  searchFields: (keyof T)[];
  renderItem: (item: T, index: number) => ReactNode;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  itemsClassName?: string;
}

export const FilteredRecordList = <T extends object>({
  items,
  searchFields,
  renderItem,
  placeholder = "Search...",
  emptyMessage = "No items found",
  className,
  itemsClassName,
}: FilteredRecordListProps<T>) => {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredItems = items.filter((item) =>
    searchFields.some((field) => {
      const value = item[field];
      return (
        value &&
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className={cn("space-y-2", itemsClassName)}>
          {filteredItems.map((item, index) => (
            <div key={index}>{renderItem(item, index)}</div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ScanOptimizedList - Enhanced list rendering with visual hierarchy
 */
interface ScanOptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  emptyMessage?: string;
  className?: string;
  compact?: boolean;
}

export const ScanOptimizedList = <T extends object>({
  items,
  renderItem,
  emptyMessage = "No items to display",
  className,
  compact = false,
}: ScanOptimizedListProps<T>) => (
  <div className={className}>
    {items.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border/50 bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    ) : (
      <div className={cn("space-y-2", compact && "space-y-1")}>
        {items.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>
    )}
  </div>
);

/**
 * PriorityBadge - Inline priority badge for list items
 */
interface PriorityBadgeProps {
  priority: "urgent" | "high" | "medium" | "low";
  showLabel?: boolean;
  className?: string;
}

const priorityBadgeStyles: Record<string, string> = {
  urgent: "border-destructive/30 bg-destructive/20 text-destructive",
  high: "border-warning/30 bg-warning/20 text-warning",
  medium: "border-info/30 bg-info/20 text-info",
  low: "border-border/30 bg-muted/20 text-muted-foreground",
};

const priorityLabels: Record<string, string> = {
  urgent: "🚨 Urgent",
  high: "⚠️ High",
  medium: "ℹ️ Medium",
  low: "Low",
};

export const PriorityBadge = ({
  priority,
  showLabel = false,
  className,
}: PriorityBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
      priorityBadgeStyles[priority],
      className
    )}
  >
    {showLabel ? priorityLabels[priority] : priority.charAt(0).toUpperCase() + priority.slice(1)}
  </span>
);

/**
 * ScanCounter - Quick counter display for scanning counts
 */
interface ScanCounterProps {
  count: number;
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  showIcon?: boolean;
  className?: string;
}

export const ScanCounter = ({
  count,
  label,
  tone = "default",
  showIcon = true,
  className,
}: ScanCounterProps) => {
  const Icon =
    tone === "danger"
      ? AlertCircle
      : tone === "success"
        ? CheckCircle2
        : AlertCircle;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
        toneStyles[tone],
        className
      )}
    >
      {showIcon && <Icon className="h-4 w-4" />}
      <span className="text-sm font-semibold">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
};
