import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const Panel = ({ title, description, actions, children, className, contentClassName }: PanelProps) => (
  <section className={cn("overflow-hidden rounded-xl border border-[#F1F3F5] bg-white shadow-sm", className)}>
    {(title || description || actions) && (
      <div className="flex flex-col gap-2 border-b border-[#F1F3F5] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>}
          {description && <div className="mt-0.5 text-xs leading-5 text-[#6B7280]">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn("p-5", contentClassName)}>{children}</div>
  </section>
);
