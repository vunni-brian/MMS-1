import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface SegmentedControlOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
  count?: number;
}

interface SegmentedControlProps<TValue extends string> {
  value: TValue;
  onChange: (value: TValue) => void;
  options: SegmentedControlOption<TValue>[];
  className?: string;
}

export const SegmentedControl = <TValue extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<TValue>) => (
  <div className={cn("inline-flex min-w-0 flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1", className)} role="tablist">
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={active}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors",
            active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
          )}
          onClick={() => onChange(option.value)}
        >
          <span className="truncate">{option.label}</span>
          {typeof option.count === "number" && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] leading-none", active ? "bg-muted text-foreground" : "bg-background/80 text-muted-foreground")}>
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const DetailSheet = ({ open, onOpenChange, title, description, children, className }: DetailSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className={cn("w-full overflow-y-auto sm:max-w-xl", className)}>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
      </SheetHeader>
      <div className="mt-6">{children}</div>
    </SheetContent>
  </Sheet>
);
