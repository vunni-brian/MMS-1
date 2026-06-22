/**
 * ReadOnlyRows - Displays a list of label-value pairs in a bordered grid,
 * used for read-only information panels throughout settings.
 */
import type { ReactNode } from "react";

/** Props for the ReadOnlyRows component. */
interface ReadOnlyRowsProps {
  rows: Array<{ label: string; value: ReactNode }>;
}

/**
 * ReadOnlyRows - Renders a vertical list of label-value pairs in a bordered grid.
 */
const ReadOnlyRows = ({ rows }: ReadOnlyRowsProps) => (
  <div className="readonly-rows divide-y divide-border/70 rounded-lg border border-border/70 bg-background">
    {rows.map((row) => (
      <div key={row.label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr] sm:items-center">
        <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
        <div className="min-w-0 text-sm font-medium">{row.value}</div>
      </div>
    ))}
  </div>
);

export default ReadOnlyRows;
export type { ReadOnlyRowsProps };
