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
    pending: "Pending Confirmation",
    completed: "Completed",
    failed: "Failed",
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
}

export const StatusBadge = ({ status, className, label, context = "default" }: StatusBadgeProps) => (
  <span className={cn('status-badge', statusStyles[status], className)}>
    {label ||
      contextLabels[context]?.[status] ||
      statusLabels[status] ||
      status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ")}
  </span>
);
