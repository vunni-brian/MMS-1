import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type StatTone = "default" | "blue" | "green" | "amber" | "red" | "purple";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  tone?: StatTone;
  className?: string;
}

const toneClasses: Record<StatTone, string> = {
  default: "text-muted-foreground bg-muted",
  blue: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  green: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
  amber: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  red: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  purple: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400",
};

export const StatCard = ({ title, value, subtitle, icon: Icon, tone = "default", className }: StatCardProps) => {
  const toneClassName = toneClasses[tone];
  return (
    <Card className={cn("overflow-hidden bg-card transition-all hover:border-primary/40 hover:shadow-sm", className)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg", toneClassName)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="truncate text-2xl font-bold font-heading text-foreground">{value}</p>
            </div>
            {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
