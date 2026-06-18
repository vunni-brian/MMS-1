import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyState?: ReactNode;
  className?: string;
  loading?: boolean;
  maxRows?: number;
}

export const DataTable = <T,>({ columns, data, keyExtractor, emptyState, className, loading, maxRows = 5 }: DataTableProps<T>) => {
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-16 text-sm text-[#6B7280]", className)}>
        Loading...
      </div>
    );
  }

  const displayData = maxRows ? data.slice(0, maxRows) : data;

  if (displayData.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-[#F1F3F5] bg-white shadow-sm", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#F1F3F5] bg-[#F8F9FA]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F3F5]">
          {displayData.map((row) => (
            <tr key={keyExtractor(row)} className="transition-colors hover:bg-[#F8F9FA]">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-3 text-sm text-[#374151]", col.className)}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div className="border-t border-[#F1F3F5] px-4 py-2.5 text-center text-xs text-[#71717A]">
          Showing {maxRows} of {data.length} records
        </div>
      )}
    </div>
  );
};
