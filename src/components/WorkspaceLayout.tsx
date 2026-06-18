import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  left: ReactNode;
  right?: ReactNode;
  variant?: "full" | "with-right-panel";
  className?: string;
}

export const WorkspaceLayout = ({ left, right, variant, className }: WorkspaceLayoutProps) => {
  const layoutVariant = variant ?? (right ? "with-right-panel" : "full");

  if (layoutVariant === "full" || !right) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-6", className)}>
        {left}
      </div>
    );
  }

  return (
    <div className={cn("grid w-full min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start", className)}>
      <div className="flex min-w-0 flex-col gap-6">
        {left}
      </div>
      <aside className="flex min-w-0 flex-col gap-6 xl:w-[340px]">
        {right}
      </aside>
    </div>
  );
};
