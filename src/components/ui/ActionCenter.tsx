import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  icon: ElementType;
  title: string;
  detail: string;
  tone: "urgent" | "warning" | "info" | "success";
  action?: ReactNode;
  onClick?: () => void;
}

interface ActionCenterProps {
  title: string;
  items: ActionItem[];
  emptyMessage?: string;
  className?: string;
}

const toneConfig = {
  urgent: { dot: "bg-[#EF476F]", bg: "bg-[#FEE2E2]/50", border: "border-[#FCA5A5]/50", icon: "text-[#EF476F]" },
  warning: { dot: "bg-[#F5A623]", bg: "bg-[#FEF3C7]/50", border: "border-[#FCD34D]/50", icon: "text-[#F5A623]" },
  info: { dot: "bg-[#3B82F6]", bg: "bg-[#DBEAFE]/50", border: "border-[#93C5FD]/50", icon: "text-[#3B82F6]" },
  success: { dot: "bg-[#10B981]", bg: "bg-[#D1FAE5]/50", border: "border-[#6EE7B7]/50", icon: "text-[#10B981]" },
};

export const ActionCenter = ({ title, items, emptyMessage = "No actions required", className }: ActionCenterProps) => (
  <div className={cn("rounded-xl border border-[#F1F3F5] bg-white shadow-sm", className)}>
    <div className="flex items-center justify-between border-b border-[#F1F3F5] px-5 py-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        {items.length > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EF476F] px-1.5 text-[11px] font-semibold text-white">
            {items.length}
          </span>
        )}
      </div>
    </div>
    <div className="divide-y divide-[#F1F3F5]">
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#D1FAE5] text-[#10B981]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#10B981]">{emptyMessage}</p>
        </div>
      ) : (
        items.map((item) => {
          const tone = toneConfig[item.tone];
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-5 py-4 transition-colors",
                item.onClick ? "cursor-pointer hover:bg-[#F8F9FA]" : "",
              )}
              onClick={item.onClick}
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone.bg, tone.border, "border")}>
                <Icon className={cn("h-4 w-4", tone.icon)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111827]">{item.title}</p>
                <p className="truncate text-xs text-[#6B7280]">{item.detail}</p>
              </div>
              {item.action && <div className="shrink-0">{item.action}</div>}
            </div>
          );
        })
      )}
    </div>
  </div>
);
