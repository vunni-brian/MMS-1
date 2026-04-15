import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, StallStatus, TicketStatus, UtilityChargeStatus, VendorApprovalStatus } from "@/types";

const statusStyles: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  inactive: "bg-success/15 text-success",
  maintenance: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  unpaid: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  paid: "bg-info/15 text-info",
  rejected: "bg-destructive/15 text-destructive",
  late_payment: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/15 text-destructive",
  open: "bg-info/15 text-info",
  in_progress: "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
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
