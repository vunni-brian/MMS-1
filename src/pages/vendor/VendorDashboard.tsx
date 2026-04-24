import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Grid3X3,
  ReceiptText,
  Shield,
  Store,
  TrendingUp,
  AlertCircle,
  Mail,
  Phone,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, getTimeAwareGreeting } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/console/ConsolePage";
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



const getBalanceTrend = (payments: { createdAt: string; amount: number }[]) => {
  const sorted = [...payments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let runningTotal = 0;
  return sorted.map(p => {
    runningTotal += p.amount;
    return { m: compactFmt.format(new Date(p.createdAt)), v: runningTotal };
  });
};


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

  const stallsQuery        = useQuery({ queryKey: ["stalls","mine"],    queryFn: () => api.getStalls({ scope: "mine" }) });
  const bookingsQuery      = useQuery({ queryKey: ["bookings"],          queryFn: () => api.getBookings() });
  const paymentsQuery      = useQuery({ queryKey: ["payments"],          queryFn: () => api.getPayments(), refetchInterval: 10_000 });
  const notificationsQuery = useQuery({ queryKey: ["notifications", 5], queryFn: () => api.getNotifications(5) });
  const managersQuery      = useQuery({ queryKey: ["market-managers", user?.marketId], queryFn: () => api.getMarketManagers(user!.marketId!), enabled: Boolean(user?.marketId) });

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
  const completedPayments  = myPayments.filter(p => p.status === "completed");
  const unreadAlerts       = myNotifications.filter(n => !n.read);

  const totalPaid          = completedPayments.reduce((s, p) => s + p.amount, 0);
  const awaitingTotal      = approvedBookings.reduce((s, b) => s + b.amount, 0);
  const firstName          = user?.name?.split(" ")[0] || "there";
  const paidPct            = totalPaid + awaitingTotal > 0 ? Math.round((totalPaid / (totalPaid + awaitingTotal)) * 100) : 0;

  /* real balance sparkline mapped from cumulative payments */
  let balanceTrend = getBalanceTrend(completedPayments);
  if (balanceTrend.length === 0) {
    balanceTrend = [{ m: 'Past', v: 0 }, { m: 'Present', v: 0 }];
  } else if (balanceTrend.length === 1) {
    balanceTrend = [{ m: 'Start', v: 0 }, balanceTrend[0]];
  }

  const donutData = [
    { name: "Paid",    value: paidPct },
    { name: "Pending", value: 100 - paidPct },
  ];

  const stats = [
    { label: "Active Stalls",       value: myStalls.length,          detail: myStalls.length === 1 ? "1 stall" : `${myStalls.length} stalls`,            color: "hsl(var(--primary))" },
    { label: "Pending Applications", value: pendingApplications.length, detail: pendingApplications.length > 0 ? "Under review" : "None pending",          color: "hsl(var(--warning))" },
    { label: "Awaiting Payment",    value: approvedBookings.length,  detail: awaitingTotal > 0 ? `${formatCurrency(awaitingTotal)} due` : "Nothing due",  color: "hsl(var(--info))", actionPath: isPendingVendor ? undefined : "/vendor/payments" },
    { label: "Unread Alerts",       value: unreadAlerts.length,      detail: unreadAlerts.length > 0 ? "Needs attention" : "All caught up",               color: "hsl(var(--accent))", highlight: true, actionPath: isPendingVendor ? undefined : "/vendor/notifications" },
  ];

  const quickActions = [
    { label: "My Stalls",   path: "/vendor/stalls",   icon: Grid3X3,   desc: isPendingVendor ? "Available after manager approval" : "View stall allocations" },
    { label: "Pay Bills",   path: "/vendor/payments", icon: ReceiptText, desc: isPendingVendor ? "Available after manager approval" : "Settle pending payments" },
    { label: "Apply",       path: "/vendor/stalls",   icon: Store,      desc: isPendingVendor ? "Available after manager approval" : "Browse & apply for stalls" },
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
          <TrendingUp className="h-3 w-3" />
          {completedPayments.length} completed payment{completedPayments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isPendingVendor && (
        <ApprovalProgress steps={approvalSteps} marketName={user?.marketName} />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`relative overflow-hidden rounded-xl border shadow-sm transition-all group ${
              stat.highlight ? "border-accent/40 bg-accent text-accent-foreground hover:bg-accent/90" : "border-border/80 bg-card hover:border-border hover:shadow"
            }`}
          >
            {stat.actionPath && <Link to={stat.actionPath} className="absolute inset-0 z-10" />}
            <div className="px-3 py-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[11px] font-medium truncate ${stat.highlight ? "text-accent-foreground/70" : "text-muted-foreground"}`}>{stat.label}</p>
                  <p className={`text-xl font-bold font-heading leading-tight mt-0.5 ${stat.highlight ? "text-accent-foreground" : ""}`}>{stat.value}</p>
                </div>
                {stat.actionPath && <ArrowUpRight className={`h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all ${stat.highlight ? "text-accent-foreground" : "text-muted-foreground"}`} />}
              </div>
              <p className={`mt-2 text-[10px] ${stat.highlight ? "text-accent-foreground/80 font-medium" : "text-muted-foreground"}`}>
                {stat.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Balance and earnings */}
      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr] shrink-0">

        {/* Balance area chart */}
        <div className="rounded-xl border border-border/80 bg-card px-4 pt-3 pb-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Balance - Total Paid</p>
              <p className="text-base font-bold font-heading leading-tight">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-600 font-semibold"><ArrowUpRight className="h-3 w-3"/>{paidPct}% paid</span>
              <span className="flex items-center gap-1 text-rose-500 font-semibold"><ArrowDownRight className="h-3 w-3"/>{formatCurrency(awaitingTotal)}</span>
            </div>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceTrend}>
                <defs>
                  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.22}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip formatter={(v: number) => [formatCurrency(v),"Balance"]} contentStyle={{ background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:"8px", fontSize:"11px" }}/>
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#bg)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Earnings donut */}
        <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm flex items-center gap-4">
          <div className="relative shrink-0 flex items-center justify-center w-[90px] h-[90px]">
            {totalPaid + awaitingTotal === 0 ? (
              <div className="h-[84px] w-[84px] rounded-full border-4 border-muted flex items-center justify-center">
                <span className="text-muted-foreground/50 text-[10px] font-medium">-</span>
              </div>
            ) : (
              <>
                <PieChart width={90} height={90}>
                  <Pie data={donutData} cx={45} cy={45} innerRadius={30} outerRadius={42} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                    <Cell fill="hsl(var(--accent))"/>
                    <Cell fill="hsl(var(--muted))"/>
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold font-heading">{paidPct}%</span>
                </div>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Earnings</p>
            <p className="text-xs text-muted-foreground">Total Expense</p>
            <p className="text-base font-bold font-heading mt-0.5">{formatCurrency(totalPaid + awaitingTotal)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{completedPayments.length} completed</p>
            <Button asChild size="sm" className="mt-2 h-7 text-xs w-full">
              <Link to="/vendor/payments">View Payments</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stalls, transfers, actions, and contacts */}
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
              myStalls.slice(0, 5).map(stall => {
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

        {/* Your Transfers */}
        <div className="rounded-xl border border-border/80 bg-card shadow-sm flex flex-col lg:min-h-0">
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5 shrink-0">
            <p className="font-semibold font-heading text-sm">Your Transfers</p>
            <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs text-muted-foreground">
              <Link to="/vendor/payments">View all <ArrowRight className="h-3 w-3 ml-1"/></Link>
            </Button>
          </div>
          <div className="overflow-y-auto max-h-64 lg:max-h-none lg:flex-1 px-3 pb-3 space-y-0.5 lg:min-h-0">
            {myPayments.length === 0 ? (
              <EmptyState title="No payments found" description="Payment attempts and receipts will appear after checkout starts." />
            ) : (
              myPayments.slice(0, 6).map(payment => {
                const ok = payment.status === "completed";
                return (
                  <div key={payment.id} className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${ok ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                      {ok ? <ArrowUpRight className="h-3.5 w-3.5"/> : <ArrowDownRight className="h-3.5 w-3.5"/>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight truncate capitalize">{payment.description || payment.chargeType.replace(/_/g, ' ')}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtAlert(payment.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-bold font-heading shrink-0 ${ok ? "text-emerald-600" : "text-amber-600"}`}>
                      {ok ? "+" : "-"}{formatCurrency(payment.amount)}
                    </span>
                  </div>
                );
              })
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
