import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bell,
  ClipboardList,
  CreditCard,
  Grid3X3,
  ReceiptText,
  Store,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, getTimeAwareGreeting } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

const dashboardDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const alertDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const parseDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDashboardDate = (
  value?: string | Date | null,
  fallback = "Not available",
) => {
  const date = parseDate(value);
  return date ? dashboardDateFormatter.format(date) : fallback;
};

const formatDashboardDateRange = (
  start?: string | Date | null,
  end?: string | Date | null,
) => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate && !endDate) return "Dates not set";
  if (!startDate) return `Until ${formatDashboardDate(endDate)}`;
  if (!endDate) return `From ${formatDashboardDate(startDate)}`;

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${compactDateFormatter.format(startDate)} - ${formatDashboardDate(endDate)}`;
  }

  return `${formatDashboardDate(startDate)} - ${formatDashboardDate(endDate)}`;
};

const formatAlertDate = (value?: string | Date | null) => {
  const date = parseDate(value);
  return date ? alertDateFormatter.format(date) : "Unknown time";
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
    queryKey: ["notifications", 5],
    queryFn: () => api.getNotifications(5),
  });

  const myStalls = (stallsData?.stalls || []).filter(
    (stall) => stall.vendorId === user?.id && stall.status === "active",
  );
  const myBookings = bookingsData?.bookings || [];
  const myPayments = paymentsData?.payments || [];
  const myNotifications = notificationsData?.notifications || [];

  const pendingApplications = myBookings.filter(
    (booking) => booking.status === "pending",
  );
  const approvedAwaitingPayment = myBookings.filter(
    (booking) => booking.status === "approved",
  );
  const pendingPayments = myPayments.filter(
    (payment) => payment.status === "pending",
  );
  const completedPayments = myPayments.filter(
    (payment) => payment.status === "completed",
  );
  const unreadAlerts = myNotifications.filter((item) => !item.read);

  const totalPaid = completedPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );
  const awaitingPaymentTotal = approvedAwaitingPayment.reduce(
    (sum, booking) => sum + booking.amount,
    0,
  );
  const firstName = user?.name?.split(" ")[0] || "there";

  const stats = [
    {
      label: "Active Stalls",
      value: myStalls.length,
      icon: Grid3X3,
      detail:
        myStalls.length === 1
          ? "1 currently assigned stall"
          : `${myStalls.length} currently assigned stalls`,
    },
    {
      label: "Pending Applications",
      value: pendingApplications.length,
      icon: ClipboardList,
      detail:
        pendingApplications.length > 0 ? "Under review" : "No pending reviews",
    },
    {
      label: "Awaiting Payment",
      value: approvedAwaitingPayment.length,
      icon: CreditCard,
      detail:
        awaitingPaymentTotal > 0
          ? `${formatCurrency(awaitingPaymentTotal)} due`
          : "Nothing due",
    },
    {
      label: "Unread Alerts",
      value: unreadAlerts.length,
      icon: Bell,
      detail: unreadAlerts.length > 0 ? "Needs attention" : "All caught up",
    },
  ];

  const quickActions = [
    {
      label: "View My Stalls",
      path: "/vendor/stalls",
      icon: Grid3X3,
      description: "Check current allocations and lease details.",
      variant: "outline" as const,
    },
    {
      label: "Pay Pending Bills",
      path: "/vendor/payments",
      icon: ReceiptText,
      description: "Settle booking, utility, and penalty payments.",
      variant: "default" as const,
    },
    {
      label: "Apply for Stall",
      path: "/vendor/stalls",
      icon: Store,
      description: "Browse available stalls and submit applications.",
      variant: "outline" as const,
    },
  ];

  const getStallLeaseExpiry = (stallId: string) => {
    const booking =
      myBookings.find(
        (item) =>
          item.stallId === stallId &&
          (item.status === "approved" || item.status === "paid"),
      ) || myBookings.find((item) => item.stallId === stallId);

    return formatDashboardDate(booking?.endDate);
  };

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-3 lg:p-4 shadow-sm">
        <h1 className="text-2xl font-bold font-heading lg:text-[2rem] leading-tight">
          {getTimeAwareGreeting(firstName)} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s a quick overview of your stalls, applications, and
          payments.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="border border-border/80 bg-card shadow-sm"
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg lg:text-xl font-bold font-heading leading-none">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stat.detail}
                  </p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <stat.icon className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border/80 bg-card shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base font-heading">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 pt-0 px-4 pb-4">
          {quickActions.map((action) => (
            <div
              key={action.label}
              className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <action.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-5">
                    {action.description}
                  </p>
                </div>
              </div>
              <Button asChild variant={action.variant} size="sm" className="mt-3 w-full">
                <Link to={action.path}>{action.label}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/80 bg-card shadow-sm h-[300px] flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">
                My Active Stalls
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/vendor/stalls">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3 px-4 pb-4">
            {myStalls.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active stalls yet. Approved applications will appear here.
              </p>
            ) : (
              myStalls.slice(0, 3).map((stall) => (
                <div
                  key={stall.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-base">{stall.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {stall.zone}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {stall.size} • {formatCurrency(stall.pricePerMonth)}/mo
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Lease expiry: {getStallLeaseExpiry(stall.id)}
                      </p>
                    </div>
                    <StatusBadge status={stall.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card shadow-sm h-[300px] flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">
                Booking Applications
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/vendor/stalls">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3 px-4 pb-4">
            {myBookings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No applications submitted yet.
              </p>
            ) : (
              myBookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-base">{booking.stallName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.stallZone}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDashboardDateRange(
                          booking.startDate,
                          booking.endDate,
                        )}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} context="booking" />
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      asChild
                      size="sm"
                      variant={booking.status === "approved" ? "default" : "outline"}
                    >
                      <Link
                        to={
                          booking.status === "approved"
                            ? "/vendor/payments"
                            : "/vendor/stalls"
                        }
                      >
                        {booking.status === "approved" ? "Pay Now" : "View"}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/80 bg-card shadow-sm h-[280px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-heading">
              Payments Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 bg-background p-3">
                <p className="text-xs text-muted-foreground">Total paid</p>
                <p className="mt-1 text-xl font-bold font-heading leading-tight">
                  {formatCurrency(totalPaid)}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3">
                <p className="text-xs text-muted-foreground">Awaiting payment</p>
                <p className="mt-1 text-xl font-bold font-heading leading-tight">
                  {formatCurrency(awaitingPaymentTotal)}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3">
                <p className="text-xs text-muted-foreground">Pending payments</p>
                <p className="mt-1 text-xl font-bold font-heading leading-tight">
                  {pendingPayments.length}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3 flex items-end">
                <Button asChild size="sm" className="w-full">
                  <Link to="/vendor/payments">View Payment History</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card shadow-sm h-[280px] flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">
                Recent Alerts
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/vendor/notifications">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto px-4 pb-4">
            {myNotifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No recent alerts.
              </p>
            ) : (
              myNotifications.slice(0, 3).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <p className="text-sm font-medium leading-5">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatAlertDate(notification.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorDashboard;