import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, PenaltyStatus, StallStatus, TicketStatus, UtilityChargeStatus, VendorApprovalStatus } from "@/types";

const statusStyles: Record<string, string> = {
  active: "border-primary/20 bg-primary/15 text-primary",
  inactive: "border-success/20 bg-success/15 text-success",
  maintenance: "border-border bg-muted text-muted-foreground",
  pending: "border-warning/25 bg-warning/15 text-warning",
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
  unpaid: "Unpaid",
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
}

export const StatusBadge = ({ status, className, label }: StatusBadgeProps) => (
  <span className={cn('status-badge', statusStyles[status], className)}>
    {label || statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);
