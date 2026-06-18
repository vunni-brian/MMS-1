import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatCardTone = "default" | "red" | "amber" | "green" | "blue";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ReactNode;
  tone?: StatCardTone;
  trend?: { value: string; positive: boolean };
  className?: string;
}

const toneBorder: Record<StatCardTone, string> = {
  default: "border-[#F1F3F5]",
  red: "border-red-200",
  amber: "border-amber-200",
  green: "border-emerald-200",
  blue: "border-blue-200",
};

const toneIcon: Record<StatCardTone, string> = {
  default: "text-[#71717A]",
  red: "text-red-500",
  amber: "text-amber-500",
  green: "text-emerald-500",
  blue: "text-blue-500",
};

const toneBg: Record<StatCardTone, string> = {
  default: "bg-white",
  red: "bg-red-50",
  amber: "bg-amber-50",
  green: "bg-emerald-50",
  blue: "bg-blue-50",
};

export const StatCard = ({ label, value, sublabel, icon, tone = "default", trend, className }: StatCardProps) => (
  <div className={cn(
    "flex flex-col gap-1.5 rounded-xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
    toneBorder[tone],
    toneBg[tone],
    className,
  )}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-[#6B7280]">{label}</p>
      {icon && <span className={toneIcon[tone]}>{icon}</span>}
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-[#111827] tracking-tight">{value}</span>
      {trend && (
        <span className={cn(
          "text-xs font-medium",
          trend.positive ? "text-[#10B981]" : "text-[#EF476F]",
        )}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </span>
      )}
    </div>
    {sublabel && (
      <p className="text-[11px] text-[#71717A]">{sublabel}</p>
    )}
  </div>
);
