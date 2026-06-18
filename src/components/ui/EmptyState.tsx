import type { ElementType, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ElementType;
  variant?: "default" | "success";
  className?: string;
}

export const EmptyState = ({ title, description, action, icon: Icon = Inbox, variant = "default", className }: EmptyStateProps) => (
  <div className={cn(
    "empty-state rounded-lg border border-dashed px-4 py-5 text-center",
    variant === "success"
      ? "border-[#10B981]/30 bg-[#D1FAE5]/20"
      : "border-border/70 bg-muted/10",
    className,
  )}>
    <div className={cn(
      "empty-state-icon mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full",
      variant === "success" ? "bg-[#D1FAE5] text-[#10B981]" : "bg-muted text-muted-foreground",
    )}>
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-sm font-semibold font-heading">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>}
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </div>
);
