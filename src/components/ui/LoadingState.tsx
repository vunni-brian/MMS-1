import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  rows?: number;
  className?: string;
  itemClassName?: string;
}

export const LoadingState = ({ rows = 4, className, itemClassName = "h-20 rounded-lg" }: LoadingStateProps) => (
  <div className={cn("grid gap-4", className)}>
    {Array.from({ length: rows }).map((_, index) => (
      <Skeleton key={index} className={itemClassName} />
    ))}
  </div>
);
