import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, StallStatus, TicketStatus, VendorApprovalStatus } from "@/types";

const statusStyles: Record<string, string> = {
  active: 'bg-success/15 text-success',
  available: 'bg-success/15 text-success',
  reserved: 'bg-warning/15 text-warning',
  paid: 'bg-info/15 text-info',
  confirmed: 'bg-success/15 text-success',
  maintenance: 'bg-muted text-muted-foreground',
  late_payment: 'bg-warning/15 text-warning',
  pending: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  failed: 'bg-destructive/15 text-destructive',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  suspended: 'bg-destructive/15 text-destructive',
  open: 'bg-info/15 text-info',
  in_progress: 'bg-warning/15 text-warning',
  resolved: 'bg-success/15 text-success',
  closed: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  in_progress: 'In Progress',
  late_payment: 'Late Payment',
};

interface StatusBadgeProps {
  status: BookingStatus | PaymentStatus | StallStatus | TicketStatus | VendorApprovalStatus | "active" | "late_payment" | "suspended";
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => (
  <span className={cn('status-badge', statusStyles[status], className)}>
    {statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);
