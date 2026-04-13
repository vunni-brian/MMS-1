import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, CreditCard, Grid3X3, TrendingUp } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

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

  const totalPaid = myPayments
    .filter((payment) => payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const stats = [
    { label: "Active Stalls", value: myStalls.length, icon: Grid3X3, color: "text-primary" },
    { label: "Pending Applications", value: pendingApplications.length, icon: ClipboardList, color: "text-warning" },
    {
      label: "Awaiting Payment",
      value: approvedAwaitingPayment.length,
      icon: CreditCard,
      color: "text-info",
    },
    { label: "Unread Alerts", value: myNotifications.filter((item) => !item.read).length, icon: Bell, color: "text-info" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Welcome back, {user?.name?.split(" ")[0]}!</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your stall applications, active assignments, and payment status.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="card-warm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold font-heading mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <div key={stall.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">
                      {stall.name} - {stall.zone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stall.size} - UGX {stall.pricePerMonth.toLocaleString()}/mo
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
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                  <div>
                    <p className="font-medium text-sm">{booking.stallName}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.startDate} to {booking.endDate}
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
        <CardContent className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Total completed payments</p>
            <p className="text-2xl font-bold font-heading mt-1">UGX {totalPaid.toLocaleString()}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{approvedAwaitingPayment.length} approved booking(s) awaiting payment</p>
            <p>{myPayments.filter((payment) => payment.status === "pending").length} payment(s) still processing</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;
