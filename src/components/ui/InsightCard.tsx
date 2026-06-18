import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  label: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  detail?: string;
  icon?: ReactNode;
  className?: string;
}

export const InsightCard = ({ label, value, change, detail, icon, className }: InsightCardProps) => (
  <div className={cn(
    "flex items-center gap-4 rounded-xl border border-[#F1F3F5] bg-white p-4 shadow-sm transition-all hover:shadow-md",
    className,
  )}>
    {icon && (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8F5EE] text-[#0F5E3F]">
        {icon}
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-[#6B7280]">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-[#111827] tracking-tight">{value}</span>
        {change && (
          <span className={cn(
            "text-xs font-semibold",
            change.positive ? "text-[#10B981]" : "text-[#EF476F]",
          )}>
            {change.positive ? "↑" : "↓"} {change.value}
          </span>
        )}
      </div>
      {detail && <p className="mt-0.5 text-[11px] text-[#71717A]">{detail}</p>}
    </div>
  </div>
);
