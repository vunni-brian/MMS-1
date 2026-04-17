import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ClipboardList, CreditCard, Grid3X3, ReceiptText, Store } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, getTimeAwareGreeting } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const dashboardDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const parseDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDashboardDate = (value?: string | Date | null, fallback = "Not available") => {
  const date = parseDate(value);
  return date ? dashboardDateFormatter.format(date) : fallback;
};

const formatDashboardDateRange = (start?: string | Date | null, end?: string | Date | null) => {
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
  const myStalls = (stallsData?.stalls || []).filter((stall) => stall.vendorId === user?.id && stall.status === "active");
  const myBookings = bookingsData?.bookings || [];
  const myPayments = paymentsData?.payments || [];
  const pendingApplications = myBookings.filter((booking) => booking.status === "pending");
  const approvedAwaitingPayment = myBookings.filter((booking) => booking.status === "approved");
  const pendingPayments = myPayments.filter((payment) => payment.status === "pending");
  const completedPayments = myPayments.filter((payment) => payment.status === "completed");

  const totalPaid = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const awaitingPaymentTotal = approvedAwaitingPayment.reduce((sum, booking) => sum + booking.amount, 0);
  const firstName = user?.name?.split(" ")[0] || "there";

  const stats = [
    {
      label: "Active Stalls",
      value: myStalls.length,
      icon: Grid3X3,
      detail: "Currently occupied",
    },
    {
      label: "Pending Applications",
      value: pendingApplications.length,
      icon: ClipboardList,
      detail: "Under review",
    },
    {
      label: "Awaiting Payment",
      value: approvedAwaitingPayment.length,
      icon: CreditCard,
      detail: awaitingPaymentTotal > 0 ? `${formatCurrency(awaitingPaymentTotal)} due` : "Nothing due",
    },
  ];

  const quickActions = [
    {
      label: "View My Stalls",
      path: "/vendor/stalls",
      icon: Grid3X3,
    },
    {
      label: "Pay Pending Bills",
      path: "/vendor/payments",
      icon: ReceiptText,
    },
    {
      label: "Apply for Stall",
      path: "/vendor/stalls",
      icon: Store,
    },
  ];

  const getStallLeaseExpiry = (stallId: string) => {
    const booking = myBookings.find((item) => item.stallId === stallId && (item.status === "approved" || item.status === "paid")) ||
      myBookings.find((item) => item.stallId === stallId);

    return formatDashboardDate(booking?.endDate);
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:p-6">
        <h1 className="text-2xl font-bold font-heading lg:text-3xl">{getTimeAwareGreeting(firstName)} 👋</h1>
        <p className="mt-2 text-sm text-muted-foreground">Here's a quick overview of your stalls and payments.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={stat.label} className="stat-card animate-fade-in-up" style={{ animationDelay: `${index * 70}ms` }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold font-heading mt-1">{stat.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{stat.detail}</p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <stat.icon className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {quickActions.map((action) => (
            <Button key={action.label} asChild variant={action.label === "Pay Pending Bills" ? "default" : "outline"} className="justify-start gap-2">
              <Link to={action.path}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">My Active Stalls</CardTitle>
        </CardHeader>
        <CardContent>
          {myStalls.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active stalls yet. Approved applications will appear here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stall</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lease Expiry</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myStalls.map((stall) => (
                  <TableRow key={stall.id}>
                    <TableCell className="font-medium">{stall.name}</TableCell>
                    <TableCell>{stall.zone}</TableCell>
                    <TableCell className="text-muted-foreground">{stall.size}</TableCell>
                    <TableCell><StatusBadge status={stall.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{getStallLeaseExpiry(stall.id)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/vendor/stalls">View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Booking Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {myBookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No applications submitted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stall</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myBookings.slice(0, 5).map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <p className="font-medium">{booking.stallName}</p>
                      <p className="text-xs text-muted-foreground">{booking.stallZone}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDashboardDateRange(booking.startDate, booking.endDate)}</TableCell>
                    <TableCell><StatusBadge status={booking.status} context="booking" /></TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant={booking.status === "approved" ? "default" : "outline"}>
                        <Link to={booking.status === "approved" ? "/vendor/payments" : "/vendor/stalls"}>
                          {booking.status === "approved" ? "Pay Now" : "View"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Payments Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 rounded-lg bg-muted/25 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold font-heading mt-1">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground lg:min-w-[260px]">
            <div className="interactive-row flex items-center justify-between px-3 py-2">
              <span>Pending payments</span>
              <strong className="text-foreground">{pendingPayments.length}</strong>
            </div>
            <Button asChild size="sm" className="mt-1 justify-self-start lg:justify-self-end">
              <Link to="/vendor/payments">View Payment History</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;
