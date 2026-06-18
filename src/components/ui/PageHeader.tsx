import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export const PageHeader = ({ eyebrow, title, description, actions, meta, className }: PageHeaderProps) => (
  <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between", className)}>
    <div className="min-w-0">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A] mb-1">
          {eyebrow}
        </p>
      )}
      <h1 className="text-xl font-bold text-[#111827] leading-tight">{title}</h1>
      {description && (
        <div className="mt-1 text-sm text-[#6B7280]">{description}</div>
      )}
      {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
    {actions && (
      <div className="flex shrink-0 items-center gap-2 mt-2 sm:mt-0">
        {actions}
      </div>
    )}
  </div>
);
