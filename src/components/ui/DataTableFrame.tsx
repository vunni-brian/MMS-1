/** A wrapper frame for data tables with optional title, description, and action bar. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTableFrameProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const DataTableFrame = ({ title, description, actions, children, className }: DataTableFrameProps) => (
  <section className={cn("console-table-card enterprise-panel overflow-hidden", className)}>
    {(title || description || actions) && (
      <div className="data-table-header flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-semibold font-heading text-slate-950">{title}</h2>}
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className="overflow-x-auto">{children}</div>
  </section>
);
