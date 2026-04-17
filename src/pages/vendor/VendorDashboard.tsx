import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, ClipboardList, CreditCard, Grid3X3, MessageSquare, ReceiptText, TrendingUp } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateRange, getTimeAwareGreeting } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

const isSameMonth = (value: string | null | undefined, monthOffset = 0) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const target = new Date();
  target.setMonth(target.getMonth() - monthOffset);

  return date.getMonth() === target.getMonth() && date.getFullYear() === target.getFullYear();
};

const VendorDashboard = () => {
  const { user } = useAuth();
  const { data: stallsData } = useQuery({
    queryKey: ["stalls", "mine"],
    queryFn: () => api.getStalls({ scope: "mine" }),
  });
  const { data: bookingsData } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    refetchInterval: 10_000,
  });
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", 3],
    queryFn: () => api.getNotifications(3),
  });

  const myStalls = (stallsData?.stalls || []).filter((stall) => stall.vendorId === user?.id && stall.status === "active");
  const myBookings = bookingsData?.bookings || [];
  const myPayments = paymentsData?.payments || [];
  const myNotifications = notificationsData?.notifications || [];
  const pendingApplications = myBookings.filter((booking) => booking.status === "pending");
  const approvedAwaitingPayment = myBookings.filter((booking) => booking.status === "approved");
  const pendingPayments = myPayments.filter((payment) => payment.status === "pending");
  const completedPayments = myPayments.filter((payment) => payment.status === "completed");

  const totalPaid = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const currentMonthPaid = completedPayments
    .filter((payment) => isSameMonth(payment.completedAt || payment.updatedAt || payment.createdAt))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const previousMonthPaid = completedPayments
    .filter((payment) => isSameMonth(payment.completedAt || payment.updatedAt || payment.createdAt, 1))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const trendPercent = previousMonthPaid > 0 ? Math.round(((currentMonthPaid - previousMonthPaid) / previousMonthPaid) * 100) : null;
  const trendText =
    trendPercent === null
      ? totalPaid > 0
        ? "First completed payment period"
        : "No completed payments yet"
      : `${trendPercent >= 0 ? "+" : ""}${trendPercent}% from last month`;
  const firstName = user?.name?.split(" ")[0] || "there";

  const stats = [
    {
      label: "Active Stalls",
      value: myStalls.length,
      icon: Grid3X3,
      color: "text-primary",
      accent: "bg-primary",
      detail: myStalls.length === 1 ? "1 stall currently allocated" : `${myStalls.length} stalls currently allocated`,
    },
    {
      label: "Pending Applications",
      value: pendingApplications.length,
      icon: ClipboardList,
      color: "text-warning",
      accent: "bg-warning",
      detail: pendingApplications.length ? "Awaiting manager review" : "No application waiting",
    },
    {
      label: "Awaiting Payment",
      value: approvedAwaitingPayment.length,
      icon: CreditCard,
      color: "text-info",
      accent: "bg-info",
      detail: approvedAwaitingPayment.length ? "Approved booking(s) need action" : "No approved booking unpaid",
    },
    {
      label: "Unread Alerts",
      value: myNotifications.filter((item) => !item.read).length,
      icon: Bell,
      color: "text-info",
      accent: "bg-accent",
      detail: myNotifications.some((item) => !item.read) ? "New update needs attention" : "All alerts reviewed",
    },
  ];

  const quickActions = [
    {
      label: "Pay Pending Bills",
      description: "Settle approved bookings, utilities, or penalties.",
      path: "/vendor/payments",
      icon: ReceiptText,
    },
    {
      label: "View My Stalls",
      description: "Check current stall allocations and monthly fees.",
      path: "/vendor/stalls",
      icon: Grid3X3,
    },
    {
      label: "Report Issue",
      description: "Raise maintenance, billing, or dispute concerns.",
      path: "/vendor/complaints",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:p-6">
        <p className="page-kicker">Vendor overview</p>
        <h1 className="mt-2 text-2xl font-bold font-heading lg:text-3xl">{getTimeAwareGreeting(firstName)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here is your business overview today: stalls, applications, alerts, and payments in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <Card key={stat.label} className="stat-card animate-fade-in-up" style={{ animationDelay: `${index * 70}ms` }}>
            <div className={`absolute left-0 top-0 h-full w-1 ${stat.accent}`} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold font-heading mt-1">{stat.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{stat.detail}</p>
                </div>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-heading">Quick Actions</CardTitle>
            <span className="insight-chip">Fewer clicks</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.path} className="interactive-row group flex items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">My Active Stalls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myStalls.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active stalls yet. Approved applications will appear here.
              </p>
            ) : (
              myStalls.map((stall) => (
                <div key={stall.id} className="interactive-row flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-sm">
                      {stall.name} - {stall.zone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stall.size} - {formatCurrency(stall.pricePerMonth)}/mo
                    </p>
                  </div>
                  <StatusBadge status={stall.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Booking Applications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No applications submitted yet</p>
            ) : (
              myBookings.slice(0, 5).map((booking) => (
                <div key={booking.id} className="interactive-row flex items-center justify-between p-3 gap-3">
                  <div>
                    <p className="font-medium text-sm">{booking.stallName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatHumanDateRange(booking.startDate, booking.endDate)}
                    </p>
                    {booking.reviewNote && (
                      <p className="text-xs text-muted-foreground mt-1">{booking.reviewNote}</p>
                    )}
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            Payment Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 rounded-xl bg-muted/25 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs text-muted-foreground">Total completed payments</p>
            <p className="text-2xl font-bold font-heading mt-1">{formatCurrency(totalPaid)}</p>
            <p className="insight-chip mt-3">{trendText}</p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground lg:min-w-[260px]">
            <div className="interactive-row flex items-center justify-between px-3 py-2">
              <span>Approved bookings awaiting payment</span>
              <strong className="text-foreground">{approvedAwaitingPayment.length}</strong>
            </div>
            <div className="interactive-row flex items-center justify-between px-3 py-2">
              <span>Payments still processing</span>
              <strong className="text-foreground">{pendingPayments.length}</strong>
            </div>
            <Button asChild size="sm" className="mt-1 justify-self-start lg:justify-self-end">
              <Link to="/vendor/payments">View Payments & Receipts</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;
