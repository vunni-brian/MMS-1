/** A form section container with title, description, children, and optional action bar. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const FormSection = ({ title, description, children, actions, className }: FormSectionProps) => (
  <section className={cn("form-section enterprise-panel p-4", className)}>
    <div className="flex flex-col gap-2 border-b border-border/70 pb-2.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold font-heading">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
    <div className="mt-3 space-y-3">{children}</div>
  </section>
);
