/** A labeled field for displaying evidence values with optional monospace formatting. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EvidenceFieldProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export const EvidenceField = ({ label, value, mono = false, className }: EvidenceFieldProps) => (
  <div className={cn("rounded-lg border border-border/60 bg-muted/15 p-3", className)}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className={cn("mt-1 break-words text-sm font-medium", mono && "font-mono text-xs")}>{value}</div>
  </div>
);
