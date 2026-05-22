import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Grid3X3,
  MessageSquare,
  Megaphone,
  ReceiptText,
  Shield,
  Store,
  AlertCircle,
  Mail,
  Phone,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, getTimeAwareGreeting } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Button } from "@/components/ui/button";
import {
  ConsolePage,
  EmptyState,
  LoadingState,
  PageHeader,
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
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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

const VendorDashboard = () => {
  const { user } = useAuth();
  const isPendingVendor = user?.vendorStatus !== "approved";

  const stallsQuery        = useQuery({ queryKey: ["stalls","mine"],    queryFn: () => api.getStalls({ scope: "mine" }), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const bookingsQuery      = useQuery({ queryKey: ["bookings"],          queryFn: () => api.getBookings(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const paymentsQuery      = useQuery({ queryKey: ["payments"],          queryFn: () => api.getPayments(), refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const notificationsQuery = useQuery({ queryKey: ["notifications", 5], queryFn: () => api.getNotifications(5), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const announcementsQuery = useQuery({ queryKey: ["announcements", "vendor-dashboard"], queryFn: () => api.getAnnouncements({ active: true }), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const managersQuery      = useQuery({ queryKey: ["market-managers", user?.marketId], queryFn: () => api.getMarketManagers(user!.marketId!), enabled: Boolean(user?.marketId), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });

  const isPending =
    stallsQuery.isPending ||
    bookingsQuery.isPending ||
    paymentsQuery.isPending ||
    notificationsQuery.isPending ||
    announcementsQuery.isPending ||
    (Boolean(user?.marketId) && managersQuery.isPending);
  const isError = stallsQuery.isError || bookingsQuery.isError || paymentsQuery.isError || notificationsQuery.isError || announcementsQuery.isError || managersQuery.isError;

  const stallsData = stallsQuery.data;
  const bookingsData = bookingsQuery.data;
  const paymentsData = paymentsQuery.data;
  const notificationsData = notificationsQuery.data;
  const announcementsData = announcementsQuery.data;
  const managersData = managersQuery.data;

  const myStalls        = (stallsData?.stalls  || []).filter(s => s.vendorId === user?.id && s.status === "active");
  const myBookings      = bookingsData?.bookings      || [];
  const myPayments      = paymentsData?.payments      || [];
  const myNotifications = notificationsData?.notifications || [];
  const marketAnnouncements = announcementsData?.announcements || [];
  const marketManagers = managersData?.managers || [];

  const approvedBookings   = myBookings.filter(b => b.status === "approved");
  const pendingApplications = myBookings.filter(b => b.status === "pending");
  const unreadAlerts       = myNotifications.filter(n => !n.read);

  const awaitingTotal      = approvedBookings.reduce((s, b) => s + b.amount, 0);
  const firstName          = user?.name?.split(" ")[0] || "there";
  const recentBookings = [...myBookings]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, DASHBOARD_CONFIG.BOOKING_PREVIEW_LIMIT);
  const recentPayments = [...myPayments]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, DASHBOARD_CONFIG.PAYMENT_PREVIEW_LIMIT);
  const activeStall = myStalls[0] || null;
  const activeStallBooking = activeStall
    ? myBookings.find((booking) => booking.stallId === activeStall.id && (booking.status === "approved" || booking.status === "paid"))
    : null;

  const quickActions = [
    { label: "Apply for Stall", path: "/vendor/stalls", icon: Store, desc: isPendingVendor ? "Available after manager approval" : "Browse available stalls" },
    { label: "Upload Receipt", path: "/vendor/payments", icon: ReceiptText, desc: isPendingVendor ? "Available after manager approval" : "Submit proof of payment" },
    { label: "File Complaint", path: "/vendor/complaints", icon: MessageSquare, desc: isPendingVendor ? "Available after manager approval" : "Report a market issue" },
    { label: "View Notices", path: "/vendor/announcements", icon: Mail, desc: "Read market updates", availableWhenPending: true },
  ];

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
      detail: user?.vendorStatus === "approved" ? "Operational routes unlocked." : "Stalls and payments are locked.",
      complete: user?.vendorStatus === "approved",
    },
  ];

  const getLeaseExpiry = (stallId: string) => {
    const b = myBookings.find(b => b.stallId === stallId && (b.status === "approved" || b.status === "paid"))
           || myBookings.find(b => b.stallId === stallId);
    return fmtDate(b?.endDate);
  };

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

      <PageHeader
        eyebrow="Vendor operations"
        title={getTimeAwareGreeting(firstName)}
        description="Overview of stall access, applications, payment obligations, and market contact points."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Store className="h-3 w-3" />
            {user?.marketName || "Assigned market"}
          </span>
        }
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">{fmtDate(new Date())}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{isPendingVendor ? "Approval pending" : "Operational access"}</span>
          </>
        }
      />

      {isPendingVendor && (
        <ApprovalProgress steps={approvalSteps} marketName={user?.marketName} />
      )}

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Stall Information"
          description="Your current market allocation."
          contentClassName="space-y-3"
        >
            {!activeStall ? (
              <EmptyState title="No active stall" description="Approved stall allocation details will appear here." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <RecordCard>
                  <p className="text-xs text-muted-foreground">Stall Number</p>
                  <p className="mt-1 text-sm font-semibold">{activeStall.name}</p>
                </RecordCard>
                <RecordCard>
                  <p className="text-xs text-muted-foreground">Section</p>
                  <p className="mt-1 text-sm font-semibold">{activeStall.zone || "Section not recorded"}</p>
                </RecordCard>
                <RecordCard>
                  <p className="text-xs text-muted-foreground">Allocation Date</p>
                  <p className="mt-1 text-sm font-semibold">{fmtDate(activeStallBooking?.confirmedAt || activeStallBooking?.createdAt)}</p>
                </RecordCard>
                <RecordCard>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status="active" label="Active" />
                  </div>
                </RecordCard>
              </div>
            )}
        </Panel>

        <Panel
          title="Quick Actions"
          description="Common vendor tasks."
          contentClassName="grid gap-2 sm:grid-cols-2"
        >
          {quickActions.map(a => (
            isPendingVendor && !a.availableWhenPending ? (
              <div key={a.label} className="flex items-center gap-2.5 rounded-md border border-border/70 bg-muted/25 px-3 py-2 opacity-60">
                <a.icon className="h-4 w-4 text-muted-foreground"/>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
              </div>
            ) : (
              <Link key={a.label} to={a.path} className="flex items-center gap-2.5 rounded-md border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-muted/50">
                <a.icon className="h-4 w-4 text-muted-foreground"/>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground"/>
              </Link>
            )
          ))}
        </Panel>
      </div>

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

      <Panel
        title="Market Announcements"
        description="Active notices from market operations."
        actions={
          <Button asChild variant="ghost" size="sm" className="h-auto px-0">
            <Link to="/vendor/announcements">View all</Link>
          </Button>
        }
        contentClassName="space-y-2"
      >
        {marketAnnouncements.length === 0 ? (
          <EmptyState title="No active announcements" description="Inspection notices, deadline updates, and market broadcasts will appear here." />
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

      <Panel title="Notifications" description="Recent account and market updates." contentClassName="space-y-2">
        {myNotifications.length === 0 ? (
          <EmptyState title="No notifications" description="Application, receipt, and complaint updates will appear here." />
        ) : (
          myNotifications.slice(0, 6).map((notification) => (
            <RecordCard key={notification.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm">{notification.message}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtAlert(notification.createdAt)}</span>
              </div>
            </RecordCard>
          ))
        )}
      </Panel>
    </ConsolePage>
  );
};

export default VendorDashboard;
