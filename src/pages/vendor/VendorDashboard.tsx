import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Megaphone,
  ReceiptText,
  Shield,
  Store,
  AlertCircle,
  Mail,
  Phone,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, formatCurrency, getTimeAwareGreeting } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Button } from "@/components/ui/button";
import {
  ConsolePage,
  EmptyState,
  LoadingState,
  Panel,
  RecordCard,
} from "@/components/console/ConsolePage";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const compactFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const alertFmt   = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const parseDate = (v?: string | Date | null) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v?: string | Date | null, fb = "N/A") => {
  const d = parseDate(v); return d ? compactFmt.format(d) : fb;
};
const fmtRange = (s?: string | Date | null, e?: string | Date | null) => {
  const sd = parseDate(s), ed = parseDate(e);
  if (!sd && !ed) return "Dates not set";
  if (!sd) return `Until ${fmtDate(ed)}`;
  if (!ed) return `From ${fmtDate(sd)}`;
  return `${compactFmt.format(sd)} - ${compactFmt.format(ed)}`;
};
const fmtAlert = (v?: string | Date | null) => { const d = parseDate(v); return d ? alertFmt.format(d) : ""; };



interface ApprovalStep {
  label: string;
  detail: string;
  complete: boolean;
  current?: boolean;
}

const ApprovalProgress = ({ steps, marketName }: { steps: ApprovalStep[]; marketName?: string | null }) => (
  <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold font-heading">Approval Progress</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace is open, but operational tools unlock after manager approval{marketName ? ` for ${marketName}` : ""}.
        </p>
      </div>
      <StatusBadge status="pending" context="vendor" />
    </div>
    <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {steps.map((step) => (
        <div key={step.label} className="rounded-lg border border-border/70 bg-background px-3 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                step.complete
                  ? "border-success/30 bg-success/15 text-success"
                  : step.current
                    ? "border-warning/40 bg-warning/15 text-warning"
                    : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {step.complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <p className="text-xs font-semibold">{step.label}</p>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{step.detail}</p>
        </div>
      ))}
    </div>
  </div>
);

const VendorStatusTile = ({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  actionLabel,
  to,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ElementType;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  actionLabel?: string;
  to?: string;
}) => (
  <div className={cn("vendor-status-card", `vendor-status-${tone}`)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-2 truncate text-2xl font-bold leading-none font-heading">{value}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
      <span className="vendor-status-icon" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    {to && actionLabel && (
      <Button asChild variant="ghost" size="sm" className="mt-3 h-auto px-0 text-xs font-semibold">
        <Link to={to}>{actionLabel}</Link>
      </Button>
    )}
  </div>
);

const VendorTaskAction = ({
  label,
  detail,
  icon: Icon,
  to,
  disabled,
}: {
  label: string;
  detail: string;
  icon: ElementType;
  to: string;
  disabled?: boolean;
}) => {
  const content = (
    <>
      <span className="vendor-task-icon" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </>
  );

  if (disabled) {
    return <div className="vendor-task-action is-disabled">{content}</div>;
  }

  return (
    <Link to={to} className="vendor-task-action">
      {content}
    </Link>
  );
};

const VendorDashboard = () => {
  const { user } = useAuth();
  const isPendingVendor = user?.vendorStatus !== "approved";

  const stallsQuery        = useQuery({ queryKey: ["stalls","mine"],    queryFn: () => api.getStalls({ scope: "mine" }), enabled: !isPendingVendor, gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const bookingsQuery      = useQuery({ queryKey: ["bookings"],          queryFn: () => api.getBookings(), enabled: !isPendingVendor, gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const paymentsQuery      = useQuery({ queryKey: ["payments"],          queryFn: () => api.getPayments(), enabled: !isPendingVendor, refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const notificationsQuery = useQuery({ queryKey: ["notifications", 5], queryFn: () => api.getNotifications(5), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const announcementsQuery = useQuery({ queryKey: ["announcements", "vendor-dashboard"], queryFn: () => api.getAnnouncements({ active: true }), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const managersQuery      = useQuery({ queryKey: ["market-managers", user?.marketId], queryFn: () => api.getMarketManagers(user!.marketId!), enabled: Boolean(user?.marketId) && !isPendingVendor, gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const ticketsQuery       = useQuery({ queryKey: ["tickets", "vendor-dashboard"], queryFn: () => api.getTickets(), enabled: !isPendingVendor, gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const isPending =
    (!isPendingVendor && (
      stallsQuery.isPending ||
      bookingsQuery.isPending ||
      paymentsQuery.isPending ||
      ticketsQuery.isPending ||
      (Boolean(user?.marketId) && managersQuery.isPending)
    )) ||
    notificationsQuery.isPending ||
    announcementsQuery.isPending;
  const isError = stallsQuery.isError || bookingsQuery.isError || paymentsQuery.isError || notificationsQuery.isError || announcementsQuery.isError || managersQuery.isError || ticketsQuery.isError;

  const stallsData = stallsQuery.data;
  const bookingsData = bookingsQuery.data;
  const paymentsData = paymentsQuery.data;
  const notificationsData = notificationsQuery.data;
  const announcementsData = announcementsQuery.data;
  const managersData = managersQuery.data;
  const ticketsData = ticketsQuery.data;

  const myStalls        = (stallsData?.stalls  || []).filter(s => s.vendorId === user?.id && s.status === "active");
  const myBookings      = bookingsData?.bookings      || [];
  const myPayments      = paymentsData?.payments      || [];
  const myNotifications = notificationsData?.notifications || [];
  const marketAnnouncements = announcementsData?.announcements || [];
  const marketManagers = managersData?.managers || [];
  const tickets = ticketsData?.tickets || [];

  const approvedBookings   = myBookings.filter(b => b.status === "approved");
  const pendingApplications = myBookings.filter(b => b.status === "pending");
  const unreadAlerts       = myNotifications.filter(n => !n.read);
  const activeComplaints   = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));

  const awaitingTotal      = approvedBookings.reduce((s, b) => s + b.amount, 0);
  const firstName          = user?.name?.split(" ")[0] || "there";
  const recentBookings = [...myBookings]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, DASHBOARD_CONFIG.BOOKING_PREVIEW_LIMIT);
  const recentPayments = [...myPayments]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, DASHBOARD_CONFIG.PAYMENT_PREVIEW_LIMIT);
  const activeStall = myStalls[0] || null;

  const approvalSteps: ApprovalStep[] = [
    {
      label: "Account",
      detail: "Vendor account created.",
      complete: Boolean(user?.id),
    },
    {
      label: "Phone",
      detail: user?.phoneVerifiedAt ? "Phone number verified." : "OTP verification needed.",
      complete: Boolean(user?.phoneVerifiedAt),
      current: !user?.phoneVerifiedAt,
    },
    {
      label: "Documents",
      detail: "National ID and LC Letter submitted.",
      complete: Boolean(user?.vendorStatus),
    },
    {
      label: "Review",
      detail: user?.vendorStatus === "approved" ? "Manager review complete." : "Waiting for manager decision.",
      complete: user?.vendorStatus === "approved",
      current: user?.vendorStatus === "pending",
    },
    {
      label: "Access",
      detail: user?.vendorStatus === "approved" ? "Workspace pages unlocked." : "Stalls and payments are locked.",
      complete: user?.vendorStatus === "approved",
    },
  ];

  const getLeaseExpiry = (stallId: string) => {
    const b = myBookings.find(b => b.stallId === stallId && (b.status === "approved" || b.status === "paid"))
           || myBookings.find(b => b.stallId === stallId);
    return fmtDate(b?.endDate);
  };

  const taskActions = [
    {
      label: "Pay My Dues",
      detail: awaitingTotal > 0 ? "Make a payment for your stall." : "No payments due right now.",
      icon: ReceiptText,
      to: "/vendor/payments",
      disabled: isPendingVendor,
    },
    {
      label: "Track Requests",
      detail: "Review your complaints and follow-ups.",
      icon: ClipboardList,
      to: "/vendor/complaints",
      disabled: isPendingVendor,
    },
    {
      label: "Stall Details",
      detail: "View your stall information.",
      icon: Store,
      to: "/vendor/stalls",
      disabled: isPendingVendor,
    },
  ];

  if (isError) {
    return (
      <div className="p-4 lg:p-6 max-w-xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>
            There was a problem fetching your market data. Please check your connection and refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-3 lg:min-h-full lg:flex lg:flex-col lg:gap-3 lg:space-y-0">
        <LoadingState rows={8} itemClassName="h-28 rounded-xl" />
      </div>
    );
  }

  return (
    <ConsolePage className="lg:min-h-full">
      <section className="vendor-dashboard-hero">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight font-heading lg:text-3xl">{getTimeAwareGreeting(firstName)}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Here&apos;s what&apos;s happening with your stall today.</p>
        </div>
        <div className="vendor-balance-card">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Current Balance</p>
            <p className="mt-1 text-xl font-bold leading-none font-heading">{formatCurrency(awaitingTotal)}</p>
          </div>
          <Button asChild size="sm" disabled={isPendingVendor || awaitingTotal <= 0}>
            <Link to="/vendor/payments">Pay Now</Link>
          </Button>
        </div>
      </section>

      {isPendingVendor && (
        <ApprovalProgress steps={approvalSteps} marketName={user?.marketName} />
      )}

      <section className="vendor-status-grid">
        <VendorStatusTile
          label="Stall Status"
          value={activeStall ? "Active" : "Pending"}
          detail={activeStall ? `${activeStall.name} - ${activeStall.zone || "Section not recorded"}` : `${pendingApplications.length} application pending`}
          icon={Store}
          tone={activeStall ? "success" : "warning"}
          actionLabel="View Details"
          to="/vendor/stalls"
        />
        <VendorStatusTile
          label="Pending Payment"
          value={formatCurrency(awaitingTotal)}
          detail={awaitingTotal > 0 ? `Due ${activeStall ? getLeaseExpiry(activeStall.id) : "after approval"}` : "No payments due"}
          icon={ReceiptText}
          tone={awaitingTotal > 0 ? "warning" : "success"}
          actionLabel="Pay Now"
          to="/vendor/payments"
        />
        <VendorStatusTile
          label="Unread Notices"
          value={marketAnnouncements.length}
          detail={unreadAlerts.length ? `${unreadAlerts.length} unread account alerts` : "New updates from management"}
          icon={Mail}
          tone={marketAnnouncements.length ? "danger" : "info"}
          actionLabel="View Notices"
          to="/vendor/announcements"
        />
        <VendorStatusTile
          label="Open Complaints"
          value={activeComplaints.length}
          detail={activeComplaints.length ? "Needs follow-up" : "You have no open complaints"}
          icon={MessageSquare}
          tone={activeComplaints.length ? "info" : "default"}
          actionLabel="View Complaints"
          to="/vendor/complaints"
        />
      </section>

      <Panel title="Things to do" contentClassName="vendor-task-grid">
        {taskActions.map((action) => (
          <VendorTaskAction key={action.label} {...action} />
        ))}
      </Panel>

      {!activeStall && (
        <Panel
          title="Application Status"
          description="Recent stall applications and allocation decisions."
          contentClassName="space-y-2"
        >
          {recentBookings.length === 0 ? (
            <EmptyState title="No applications yet" description="Apply for a stall to start an allocation request." />
          ) : (
            recentBookings.map((booking) => (
              <RecordCard key={booking.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Stall {booking.stallName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtRange(booking.startDate, booking.endDate)}</p>
                  </div>
                  <StatusBadge status={booking.status} context="booking" className="shrink-0" />
                </div>
              </RecordCard>
            ))
          )}
        </Panel>
      )}

      <div className="vendor-dashboard-grid">
        <Panel
          title="Recent Notices"
          actions={
            <Button asChild variant="ghost" size="sm" className="h-auto px-0">
              <Link to="/vendor/announcements">View all</Link>
            </Button>
          }
          contentClassName="space-y-2"
        >
          {marketAnnouncements.length === 0 ? (
            <EmptyState title="No active notices" description="Inspection notices, deadline updates, and market alerts will appear here." />
          ) : (
            marketAnnouncements.slice(0, 4).map((announcement) => (
              <RecordCard key={announcement.id} className={announcement.priority === "high" ? "border-destructive/25 bg-destructive/5" : undefined}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${announcement.priority === "high" ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-info/20 bg-info/10 text-info"}`}>
                    <Megaphone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{announcement.title}</p>
                      {announcement.priority === "high" && (
                        <span className="status-badge border-destructive/20 bg-destructive/15 text-destructive">High</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{announcement.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtAlert(announcement.createdAt)}</span>
                </div>
              </RecordCard>
            ))
          )}
        </Panel>

        <Panel
          title="Recent Payments"
          actions={
            <Button asChild variant="ghost" size="sm" className="h-auto px-0">
              <Link to="/vendor/payments">View all</Link>
            </Button>
          }
          contentClassName="space-y-2"
        >
          {recentPayments.length === 0 ? (
            <EmptyState title="No payment records" description="Receipt records will appear here after payment activity." />
          ) : (
            recentPayments.slice(0, 4).map((payment) => (
              <RecordCard key={payment.id}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted text-muted-foreground">
                    <ReceiptText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      Receipt {payment.receiptId || payment.providerReference || payment.transactionId || payment.externalReference || payment.id}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{formatCurrency(payment.amount)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={payment.status} context="payment" />
                    <p className="mt-1 text-xs text-muted-foreground">{fmtAlert(payment.createdAt)}</p>
                  </div>
                </div>
              </RecordCard>
            ))
          )}
        </Panel>
      </div>
    </ConsolePage>
  );
};

export default VendorDashboard;
