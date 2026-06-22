/**
 * StatusBadge - Displays a colored badge representing the status of an entity
 * (stall, payment, booking, complaint, etc.). Resolves translated labels based
 * on the status value and an optional context.
 */
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, PenaltyStatus, StallStatus, TicketStatus, UtilityChargeStatus, VendorApprovalStatus } from "@/types";

type AllocationStatus = "available" | "allocated" | "reserved";

/** Maps each status value to its Tailwind border/background/text colour classes. */
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
  available: "border-success/20 bg-success/15 text-success",
  allocated: "border-border bg-muted text-muted-foreground",
  reserved: "border-border bg-muted text-muted-foreground",
};

/** Maps each status value to its i18n translation key. */
const statusLabelKeys: Record<string, string> = {
 active: "common:occupied",
 inactive: "common:available",
 in_progress: "common:inProgress",
 late_payment: "common:latePayment",
 pending: "common:pendingReview",
 pending_payment: "common:pendingPayment",
 unpaid: "common:unpaid",
 paid: "common:paid",
 overdue: "common:overdue",
 cancelled: "common:cancelled",
 completed: "common:completed",
 failed: "common:failed",
 approved: "common:approved",
 rejected: "common:rejected",
 open: "common:open",
 closed: "common:closed",
 resolved: "common:resolved",
 maintenance: "common:maintenance",
 allocated: "common:allocated",
 reserved: "common:reserved",
 suspended: "common:suspended",
 available: "common:available",
};

/** Contextual override for label keys (e.g. "payment" shows "Verified" for "completed"). */
type StatusContext = "default" | "booking" | "payment" | "obligation" | "vendor" | "ticket";

const contextLabelKeys: Partial<Record<StatusContext, Record<string, string>>> = {
 payment: {
 pending: "common:pending",
 completed: "common:verified",
 failed: "common:rejected",
 cancelled: "common:cancelled",
 },
 obligation: {
 pending: "common:pendingPayment",
 pending_payment: "common:pendingPayment",
 unpaid: "common:unpaid",
 paid: "common:paid",
 overdue: "common:overdue",
 cancelled: "common:cancelled",
 },
 booking: {
 pending: "common:pendingReview",
 approved: "common:approved",
 rejected: "common:rejected",
 paid: "common:paid",
 },
};

/** Props for the StatusBadge component. */
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
  | "suspended"
  | AllocationStatus;
 className?: string;
 label?: string;
 context?: StatusContext;
}

/**
 * StatusBadge - Renders a span with status-specific styling and a translated label.
 * Falls back to a humanised version of the status key when no translation exists.
 */
export const StatusBadge = ({ status, className, label, context = "default" }: StatusBadgeProps) => {
  const { t } = useTranslation();
  // Resolve the display label with the following priority:
  //   1. explicit `label` prop
  //   2. context-aware translation key (e.g. payment/completed → "Verified")
  //   3. global status translation key
  //   4. humanised fallback from the status string itself
  const contextKey = context !== "default" && contextLabelKeys[context]?.[status];
  const labelKey = statusLabelKeys[status];
  const resolvedLabel = label || (contextKey ? t(contextKey) : undefined) || (labelKey ? t(labelKey) : undefined) || (typeof status === "string" ? status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ") : "Unknown");

  return (
    <span className={cn('status-badge', typeof status === "string" ? statusStyles[status] : undefined, className)}>
      {resolvedLabel}
    </span>
  );
};
