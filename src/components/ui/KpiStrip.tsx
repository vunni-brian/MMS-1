/** A horizontal strip of KPI (Key Performance Indicator) cards with sparklines and tone-based styling. */
import type { ElementType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import { getPageType } from "@/config/pageIdentity";
import { Card, CardContent } from "@/components/ui/card";

/** A single KPI item with label, value, optional icon, trend, and sparkline data. */
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

const kpiTrendLabelKeys: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "kpi:stable",
  success: "kpi:onTrack",
  warning: "kpi:watch",
  destructive: "kpi:critical",
  info: "kpi:live",
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
  const { t } = useTranslation();
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
                    {item.trend || t(kpiTrendLabelKeys[tone])}
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
