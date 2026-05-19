import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Grid3X3,
  MessageSquare,
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
import { EmptyState, LoadingState, KpiStrip } from "@/components/console/ConsolePage";
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
  const managersQuery      = useQuery({ queryKey: ["market-managers", user?.marketId], queryFn: () => api.getMarketManagers(user!.marketId!), enabled: Boolean(user?.marketId), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });

  const isPending =
    stallsQuery.isPending ||
    bookingsQuery.isPending ||
    paymentsQuery.isPending ||
    notificationsQuery.isPending ||
    (Boolean(user?.marketId) && managersQuery.isPending);
  const isError = stallsQuery.isError || bookingsQuery.isError || paymentsQuery.isError || notificationsQuery.isError || managersQuery.isError;

  const stallsData = stallsQuery.data;
  const bookingsData = bookingsQuery.data;
  const paymentsData = paymentsQuery.data;
  const notificationsData = notificationsQuery.data;
  const managersData = managersQuery.data;

  const myStalls        = (stallsData?.stalls  || []).filter(s => s.vendorId === user?.id && s.status === "active");
  const myBookings      = bookingsData?.bookings      || [];
  const myPayments      = paymentsData?.payments      || [];
  const myNotifications = notificationsData?.notifications || [];
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

  const kpiItems = [
    { label: "Active Stalls", value: myStalls.length, detail: myStalls.length === 1 ? "1 stall" : `${myStalls.length} stalls`, icon: Store, tone: "success" as const },
    { label: "Pending Applications", value: pendingApplications.length, detail: pendingApplications.length > 0 ? "Under review" : "None pending", icon: Grid3X3, tone: "warning" as const },
    { label: "Awaiting Payment", value: approvedBookings.length, detail: awaitingTotal > 0 ? `${formatCurrency(awaitingTotal)} due` : "Nothing due", icon: ReceiptText, tone: "info" as const },
    { label: "Unread Alerts", value: unreadAlerts.length, detail: unreadAlerts.length > 0 ? "Needs attention" : "All caught up", icon: MessageSquare, tone: unreadAlerts.length > 0 ? "destructive" as const : "default" as const },
  ];

  const quickActions = [
    { label: "Apply for Stall", path: "/vendor/stalls", icon: Store, desc: isPendingVendor ? "Available after manager approval" : "Browse available stalls" },
    { label: "Pay Bills", path: "/vendor/payments", icon: ReceiptText, desc: isPendingVendor ? "Available after manager approval" : "Settle approved charges" },
    { label: "Raise Complaint", path: "/vendor/complaints", icon: MessageSquare, desc: isPendingVendor ? "Available after manager approval" : "Report billing or maintenance issues" },
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
    <div className="space-y-3 lg:min-h-full lg:flex lg:flex-col lg:gap-3 lg:space-y-0">

      {/* Greeting */}
      <div className="flex shrink-0 items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-2.5 shadow-sm">
        <div>
          <h1 className="text-base font-bold font-heading leading-tight">{getTimeAwareGreeting(firstName)} <span className="text-muted-foreground font-normal ml-2 text-xs hidden sm:inline-block">{fmtDate(new Date())}</span></h1>
          <p className="text-xs text-muted-foreground">Overview of your stalls, applications, and payments.</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
          <Store className="h-3 w-3" />
          {user?.marketName || "Assigned market"}
        </span>
      </div>

      {isPendingVendor && (
        <ApprovalProgress steps={approvalSteps} marketName={user?.marketName} />
      )}

      {/* KPI Strip */}
      <KpiStrip items={kpiItems} columns="grid-cols-2 lg:grid-cols-4" />

      {/* Operational status */}
      <div className="grid gap-3 lg:grid-cols-2 shrink-0">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold font-heading text-sm">Payment Obligations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approved charges that need payment before stall access or renewal.
              </p>
            </div>
            <p className="text-sm font-bold font-heading">{formatCurrency(awaitingTotal)}</p>
          </div>
          <div className="mt-3 space-y-2">
            {approvedBookings.length === 0 ? (
              <EmptyState title="No payments due" description="Approved stall charges will appear here." />
            ) : (
              approvedBookings.slice(0, DASHBOARD_CONFIG.DASHBOARD_PREVIEW_LIMIT).map((booking) => (
                <div key={booking.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">Stall {booking.stallName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtRange(booking.startDate, booking.endDate)}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold font-heading">
                      {formatCurrency(booking.amount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button asChild size="sm" className="mt-3 h-8 w-full">
            <Link to="/vendor/payments">Open Payments</Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold font-heading text-sm">Application Status</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recent stall applications and allocation decisions.
              </p>
            </div>
            <p className="text-sm font-bold font-heading">{pendingApplications.length} pending</p>
          </div>
          <div className="mt-3 space-y-2">
            {recentBookings.length === 0 ? (
              <EmptyState title="No applications yet" description="Apply for a stall to start an allocation request." />
            ) : (
              recentBookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">Stall {booking.stallName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtRange(booking.startDate, booking.endDate)}</p>
                    </div>
                    <StatusBadge status={booking.status} context="booking" className="shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Stalls, payments, actions, and contacts */}
      <div className="grid gap-3 lg:grid-cols-3 lg:flex-1 lg:min-h-0">

        {/* My Active Stalls */}
        <div className="rounded-xl border border-border/80 bg-card shadow-sm flex flex-col lg:min-h-0">
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5 shrink-0">
            <p className="font-semibold font-heading text-sm">My Active Stalls</p>
            <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs text-muted-foreground">
              <Link to="/vendor/stalls">View all <ArrowRight className="h-3 w-3 ml-1"/></Link>
            </Button>
          </div>
          <div className="overflow-y-auto max-h-64 lg:max-h-none lg:flex-1 px-3 pb-3 space-y-1.5 lg:min-h-0">
            {myStalls.length === 0 ? (
              <EmptyState title="No active stalls yet" description="Approved stall allocations will appear here after manager review." />
            ) : (
              myStalls.slice(0, DASHBOARD_CONFIG.STALL_PREVIEW_LIMIT).map(stall => {
                const exp = getLeaseExpiry(stall.id);
                return (
                  <div key={stall.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">{stall.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{stall.zone} - {stall.size}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {formatCurrency(stall.pricePerMonth)}/mo
                          {exp ? ` - Exp: ${exp}` : ""}
                        </p>
                      </div>
                      <StatusBadge status="active" label="Active" className="shrink-0 scale-90 origin-top-right" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border/80 bg-card shadow-sm flex flex-col lg:min-h-0">
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5 shrink-0">
            <p className="font-semibold font-heading text-sm">Recent Payments</p>
            <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs text-muted-foreground">
              <Link to="/vendor/payments">View all <ArrowRight className="h-3 w-3 ml-1"/></Link>
            </Button>
          </div>
          <div className="overflow-y-auto max-h-64 lg:max-h-none lg:flex-1 px-3 pb-3 space-y-0.5 lg:min-h-0">
            {recentPayments.length === 0 ? (
              <EmptyState title="No payments found" description="Payment attempts and receipts will appear after checkout starts." />
            ) : (
              recentPayments.map(payment => (
                <div key={payment.id} className="flex items-center gap-2.5 border-b border-border/40 py-2 last:border-0">
                  <StatusBadge status={payment.status} context="payment" className="shrink-0 scale-90" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-tight truncate capitalize">{payment.description || payment.chargeType.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtAlert(payment.createdAt)}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold font-heading">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions + Security stacked */}
        <div className="flex flex-col gap-3 lg:min-h-0">

          {/* Quick Actions */}
          <div className="rounded-xl border border-border/80 bg-card shadow-sm flex-1 flex flex-col lg:min-h-0">
            <p className="font-semibold font-heading text-sm px-3 pt-3 pb-1.5 shrink-0">Quick Actions</p>
            <div className="overflow-y-auto max-h-48 lg:max-h-none lg:flex-1 px-2 pb-2 space-y-0.5 lg:min-h-0">
              {quickActions.map(a => (
                isPendingVendor ? (
                  <div key={a.label} className="flex items-center gap-2.5 rounded-lg px-2 py-2 opacity-60">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <a.icon className="h-3.5 w-3.5"/>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                    </div>
                  </div>
                ) : (
                  <Link key={a.label} to={a.path} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors group">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <a.icon className="h-3.5 w-3.5"/>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5"/>
                  </Link>
                )
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card shadow-sm">
            <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
              <p className="font-semibold font-heading text-sm">Market Managers</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="px-3 pb-3 space-y-2">
              {marketManagers.length === 0 ? (
                <EmptyState title="No manager assigned" description="Manager contacts will appear when your market has assigned staff." />
              ) : (
                marketManagers.map((manager) => (
                  <div key={manager.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                    <p className="text-xs font-semibold">{manager.name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <a href={`tel:${manager.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="h-3 w-3" />
                        {manager.phone}
                      </a>
                      <a href={`mailto:${manager.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Mail className="h-3 w-3" />
                        {manager.email}
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
