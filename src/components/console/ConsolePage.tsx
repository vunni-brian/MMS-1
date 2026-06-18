import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import {
  getPageIdentity,
  getPageType,
  type PageAccent,
  type PageKind,
} from "@/config/pageIdentity";

// --- ConsolePage wrapper (used by AdminLayout) ---
interface ConsolePageProps {
  children: ReactNode;
  className?: string;
  kind?: PageKind;
  accent?: PageAccent;
}

export const ConsolePage = ({ children, className, kind, accent }: ConsolePageProps) => {
  const location = useLocation();
  const identity = getPageIdentity(location.pathname);
  const pageType = getPageType(location.pathname);
  const resolvedKind = kind || identity.kind;
  const resolvedAccent = accent || identity.accent;

  return (
    <div
      className={cn(
        "console-page enterprise-page flex-1 space-y-6 bg-transparent text-slate-950",
        `console-accent-${resolvedAccent}`,
        `console-page-type-${pageType}`,
        `console-page-${resolvedKind}`,
        className,
      )}
      data-page-kind={resolvedKind}
      data-page-accent={resolvedAccent}
      data-page-type={pageType}
    >
      {children}
    </div>
  );
};

// --- Re-exports from ui/ for backward compatibility ---
// TODO: Migrate all consumers to import from "@/components/ui/*" directly.
export { PageHeader } from "@/components/ui/PageHeader";
export { KpiStrip, MiniSparkline } from "@/components/ui/KpiStrip";
export { EvidenceField } from "@/components/ui/EvidenceField";
export { FileUploadCard } from "@/components/ui/FileUploadCard";
export { FormSection } from "@/components/ui/FormSection";
export { DataTableFrame } from "@/components/ui/DataTableFrame";
export { EmptyState } from "@/components/ui/EmptyState";
