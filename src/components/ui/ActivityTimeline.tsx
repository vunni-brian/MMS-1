import type { ElementType } from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  icon: ElementType;
  title: string;
  detail: string;
  time: string;
  tone?: "default" | "success" | "warning" | "info";
}

interface ActivityTimelineProps {
  title: string;
  items: TimelineItem[];
  viewAllLink?: string;
  viewAllLabel?: string;
  className?: string;
}

const toneIcon = {
  default: "bg-[#F8F9FA] text-[#6B7280]",
  success: "bg-[#D1FAE5] text-[#10B981]",
  warning: "bg-[#FEF3C7] text-[#F5A623]",
  info: "bg-[#DBEAFE] text-[#3B82F6]",
};

export const ActivityTimeline = ({ title, items, viewAllLink, viewAllLabel = "View all", className }: ActivityTimelineProps) => (
  <div className={cn("rounded-xl border border-[#F1F3F5] bg-white shadow-sm", className)}>
    <div className="flex items-center justify-between border-b border-[#F1F3F5] px-5 py-4">
      <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
      {viewAllLink && (
        <a href={viewAllLink} className="text-xs font-medium text-[#0F5E3F] hover:underline">
          {viewAllLabel}
        </a>
      )}
    </div>
    <div className="divide-y divide-[#F1F3F5]">
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[#71717A]">No recent activity</div>
      ) : (
        items.map((item) => {
          const Icon = item.icon;
          const tone = toneIcon[item.tone || "default"];
          return (
            <div key={item.id} className="flex gap-3 px-5 py-3.5">
              <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111827]">{item.title}</p>
                <p className="truncate text-xs text-[#6B7280]">{item.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] text-[#71717A]">{item.time}</span>
            </div>
          );
        })
      )}
    </div>
  </div>
);
