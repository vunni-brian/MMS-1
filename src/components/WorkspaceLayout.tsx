import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  left: ReactNode;
  right?: ReactNode;
  ratio?: "70-30" | "65-35" | "75-25" | "full";
  className?: string;
}

const ratioClasses = {
  "70-30": { left: "flex-[7]", right: "w-[30%]" },
  "65-35": { left: "flex-[6.5]", right: "w-[35%]" },
  "75-25": { left: "flex-[7.5]", right: "w-[25%]" },
  full: { left: "w-full", right: "" },
};

export const WorkspaceLayout = ({ left, right, ratio = "70-30", className }: WorkspaceLayoutProps) => {
  const r = ratioClasses[ratio];

  if (ratio === "full") {
    return (
      <div className={cn("flex flex-1 overflow-hidden", className)}>
        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto">
          {left}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 flex-col gap-6 xl:flex-row xl:overflow-hidden", className)}>
      <div className={cn("flex min-w-0 flex-col gap-6 overflow-y-auto", r.left)}>
        {left}
      </div>
      {right && (
        <div className={cn("flex shrink-0 flex-col gap-6 xl:overflow-y-auto", r.right)}>
          {right}
        </div>
      )}
    </div>
  );
};
