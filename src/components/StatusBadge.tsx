import type { ElementType } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Pause,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, PenaltyStatus, StallStatus, TicketStatus, UtilityChargeStatus, VendorApprovalStatus } from "@/types";

const statusStyles: Record<string, string> = {
  active: "border-border bg-muted text-muted-foreground",
  inactive: "border-success/20 bg-success/15 text-success",
  maintenance: "border-border bg-muted text-muted-foreground",
  pending: "border-warning/25 bg-warning/15 text-warning",
  pending_payment: "border-warning/25 bg-warning/15 text-warning",
  unpaid: "border-warning/25 bg-warning/15 text-warning",
  approved: "border-success/20 bg-success/15 text-success",
  paid: "border-success/20 bg-success/15 text-success",
  rejected: "border-destructive/20 bg-destructive/15 text-destructive",
  late_payment: "border-warning/25 bg-warning/15 text-warning",
  completed: "border-success/20 bg-success/15 text-success",
  failed: "border-destructive/20 bg-destructive/15 text-destructive",
  overdue: "border-destructive/20 bg-destructive/15 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
  suspended: "border-destructive/20 bg-destructive/15 text-destructive",
  open: "border-info/20 bg-info/15 text-info",
  in_progress: "border-warning/25 bg-warning/15 text-warning",
  resolved: "border-success/20 bg-success/15 text-success",
  closed: "border-border bg-muted text-muted-foreground",
};

const statusIcons: Record<string, ElementType> = {
  active: MoreHorizontal,
  inactive: Pause,
  maintenance: AlertCircle,
  pending: Clock,
  pending_payment: Clock,
  unpaid: AlertCircle,
  approved: CheckCircle2,
  paid: CheckCircle2,
  rejected: XCircle,
  late_payment: AlertCircle,
  completed: CheckCircle2,
  failed: XCircle,
  overdue: AlertCircle,
  cancelled: XCircle,
  suspended: XCircle,
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: MoreHorizontal,
};

const statusLabels: Record<string, string> = {
  active: "Occupied",
  inactive: "Available",
  in_progress: "In Progress",
  late_payment: "Late Payment",
  pending: "Pending Review",
  pending_payment: "Pending Payment",
  unpaid: "Unpaid",
};

type StatusContext = "default" | "booking" | "payment" | "obligation" | "vendor" | "ticket";

const contextLabels: Partial<Record<StatusContext, Record<string, string>>> = {
  payment: {
    pending: "Pending",
    completed: "Verified",
    failed: "Rejected",
    cancelled: "Cancelled",
  },
  obligation: {
    pending: "Pending Payment",
    pending_payment: "Pending Payment",
    unpaid: "Unpaid",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
  },
  booking: {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    paid: "Paid",
  },
};

interface StatusBadgeProps {
  status:
    | BookingStatus
    | PaymentStatus
    | PenaltyStatus
    | StallStatus
    | TicketStatus
    | UtilityChargeStatus
    | VendorApprovalStatus
    | "active"
    | "late_payment"
    | "suspended";
  className?: string;
  label?: string;
  context?: StatusContext;
  showIcon?: boolean;
  compact?: boolean;
}

export const StatusBadge = ({ status, className, label, context = "default", showIcon = true, compact = false }: StatusBadgeProps) => {
  const Icon = showIcon ? statusIcons[status] : null;
  const displayLabel =
    label ||
    contextLabels[context]?.[status] ||
    statusLabels[status] ||
    status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ");

  return (
    <span className={cn('status-badge inline-flex items-center gap-1.5', statusStyles[status], compact && 'px-2 py-0.5 text-xs', className)}>
      {Icon && <Icon className={cn("h-3 w-3 shrink-0", !compact && "h-3.5 w-3.5")} />}
      {displayLabel}
    </span>
  );
};
