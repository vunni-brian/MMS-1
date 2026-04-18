import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Grid3X3,
  MessageSquare,
  ReceiptText,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate, getTimeAwareGreeting } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/ui/sonner";
import type {
  BookingStatus,
  ChargeTypeName,
  Payment,
  Ticket,
  UtilityCharge,
  UtilityType,
  VendorApprovalStatus,
} from "@/types";

const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);

const categoryLabels: Record<Ticket["category"], string> = {
  billing: "Billing",
  maintenance: "Maintenance",
  dispute: "Dispute",
  other: "Other",
};

const utilityLabels: Record<UtilityType, string> = {
  electricity: "Electricity",
  water: "Water",
  sanitation: "Sanitation",
  garbage: "Garbage",
  other: "Utility",
};

const chargeTypeLabels: Record<ChargeTypeName, string> = {
  market_dues: "Market dues",
  utilities: "Utility charge",
  penalties: "Penalty",
  booking_fee: "Booking fee",
  payment_gateway: "Payment gateway",
};

type ApprovalRow =
  | {
      id: string;
      kind: "vendor";
      vendorId: string;
      vendorName: string;
      detail: string;
      market: string;
      appliedAt: string;
      status: VendorApprovalStatus;
    }
  | {
      id: string;
      kind: "booking";
      bookingId: string;
      vendorName: string;
      detail: string;
      market: string;
      appliedAt: string;
      status: BookingStatus;
    };

type ComplaintPriority = "High" | "Medium" | "Normal";

const getPaymentPurpose = (payment: Payment) => {
  if (payment.description?.trim()) return payment.description;
  if (payment.stallName) return `Stall ${payment.stallName}`;
  return chargeTypeLabels[payment.chargeType];
};

const getPaymentReference = (payment: Payment) =>
  payment.providerReference ||
  payment.transactionId ||
  payment.externalReference ||
  "Awaiting reference";

const getComplaintPriority = (ticket: Ticket): ComplaintPriority => {
  if (ticket.category === "dispute") return "High";
  if (ticket.category === "billing" || ticket.category === "maintenance") return "Medium";
  return "Normal";
};

const utilityStatusWeight: Record<UtilityCharge["status"], number> = {
  overdue: 0,
  unpaid: 1,
  pending: 2,
  pending_payment: 2,
  paid: 3,
  cancelled: 4,
};

const ManagerDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: stallsData } = useQuery({
    queryKey: ["stalls"],
    queryFn: () => api.getStalls(),
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

  const { data: vendorsData } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.getVendors(),
  });

  const { data: ticketsData } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.getTickets(),
  });

  const { data: utilityChargesData } = useQuery({
    queryKey: ["utility-charges", "manager-dashboard"],
    queryFn: () => api.getUtilityCharges(),
    refetchInterval: 10_000,
  });

  const approveVendor = useMutation({
    mutationFn: (vendorId: string) => api.approveVendor(vendorId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Vendor approved");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Unable to approve vendor.";
      toast.error("Vendor was not approved", { description: message });
    },
  });

  const rejectVendor = useMutation({
    mutationFn: (vendorId: string) =>
      api.rejectVendor(vendorId, "Rejected from manager dashboard review."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Vendor rejected");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Unable to reject vendor.";
      toast.error("Vendor was not rejected", { description: message });
    },
  });

  const reviewBookingApplication = useMutation({
    mutationFn: ({ bookingId, approved }: { bookingId: string; approved: boolean }) =>
      approved
        ? api.approveBooking(bookingId)
        : api.rejectBooking(bookingId, "Application requirements were not met."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Application reviewed");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Unable to review booking application.";
      toast.error("Application was not reviewed", { description: message });
    },
  });

  const stalls = stallsData?.stalls || [];
  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const vendors = vendorsData?.vendors || [];
  const tickets = ticketsData?.tickets || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];

  const pendingVendors = vendors.filter((vendor) => vendor.status === "pending");
  const pendingApplications = bookings.filter((booking) => booking.status === "pending");
  const activeStalls = stalls.filter((stall) => stall.status === "active");
  const vacantStalls = stalls.filter((stall) => stall.status === "inactive");
  const maintenanceStalls = stalls.filter((stall) => stall.status === "maintenance");
  const pendingPayments = payments.filter((payment) => payment.status === "pending");
  const openComplaints = tickets.filter((ticket) => ticket.status !== "resolved");
  const highPriorityComplaints = openComplaints.filter(
    (ticket) => getComplaintPriority(ticket) === "High",
  );
  const firstName = user?.name?.split(" ")[0] || "there";

  const renewalPending = bookings.filter((booking) => {
    if (!["approved", "paid"].includes(booking.status)) return false;
    const hoursLeft = Math.round(
      (endOfDay(booking.endDate).getTime() - Date.now()) / (1000 * 60 * 60),
    );
    return hoursLeft >= 0 && hoursLeft <= 24 * 7;
  });

  const approvalRows: ApprovalRow[] = [
    ...pendingVendors.map((vendor) => ({
      id: `vendor-${vendor.id}`,
      kind: "vendor" as const,
      vendorId: vendor.id,
      vendorName: vendor.name,
      detail: "Vendor registration",
      market: vendor.marketName || user?.marketName || "Assigned market",
      appliedAt: vendor.createdAt,
      status: vendor.status,
    })),
    ...pendingApplications.map((booking) => ({
      id: `booking-${booking.id}`,
      kind: "booking" as const,
      bookingId: booking.id,
      vendorName: booking.vendorName,
      detail: `Stall ${booking.stallName} application`,
      market: booking.marketName || user?.marketName || "Assigned market",
      appliedAt: booking.createdAt,
      status: booking.status,
    })),
  ].sort(
    (left, right) =>
      new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime(),
  );

  const utilityRows = utilityCharges
    .filter((charge) => charge.status !== "paid" && charge.status !== "cancelled")
    .sort((left, right) => utilityStatusWeight[left.status] - utilityStatusWeight[right.status])
    .slice(0, 3);

  const complaintRows = [...openComplaints]
    .sort((left, right) => {
      const priorityWeight = { High: 0, Medium: 1, Normal: 2 };
      const priorityDifference =
        priorityWeight[getComplaintPriority(left)] -
        priorityWeight[getComplaintPriority(right)];
      return (
        priorityDifference ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    })
    .slice(0, 3);

  const actionDisabled =
    approveVendor.isPending || rejectVendor.isPending || reviewBookingApplication.isPending;

  const approveRow = (row: ApprovalRow) => {
    if (row.kind === "vendor") {
      approveVendor.mutate(row.vendorId);
      return;
    }
    reviewBookingApplication.mutate({ bookingId: row.bookingId, approved: true });
  };

  const rejectRow = (row: ApprovalRow) => {
    if (row.kind === "vendor") {
      rejectVendor.mutate(row.vendorId);
      return;
    }
    reviewBookingApplication.mutate({ bookingId: row.bookingId, approved: false });
  };

  const kpis = [
    {
      label: "Pending Approvals",
      value: approvalRows.length,
      detail: "Applications awaiting review",
      icon: ClipboardList,
    },
    {
      label: "Active Stalls",
      value: activeStalls.length,
      detail: `${vacantStalls.length} stalls currently vacant`,
      icon: Grid3X3,
    },
    {
      label: "Payments Awaiting Confirmation",
      value: pendingPayments.length,
      detail: "Vendor payments still processing",
      icon: CreditCard,
    },
    {
      label: "Open Complaints",
      value: openComplaints.length,
      detail: `${highPriorityComplaints.length} high-priority issues`,
      icon: AlertCircle,
    },
  ];

  const quickActions = [
    { label: "Review Applications", path: "/manager/vendors", icon: ClipboardList },
    { label: "Assign Utility Charge", path: "/manager/billing", icon: SlidersHorizontal },
    { label: "View Pending Payments", path: "/manager/payments", icon: ReceiptText },
    { label: "Resolve Complaints", path: "/manager/complaints", icon: MessageSquare },
  ];

  const occupancySummary = [
    {
      label: "Occupied Stalls",
      value: activeStalls.length,
      detail: "Assigned to vendors",
      icon: CheckCircle2,
    },
    {
      label: "Vacant Stalls",
      value: vacantStalls.length,
      detail: "Available for allocation",
      icon: Grid3X3,
    },
    {
      label: "Maintenance",
      value: maintenanceStalls.length,
      detail: "Need follow-up",
      icon: Wrench,
    },
    {
      label: "Renewal Pending",
      value: renewalPending.length,
      detail: "Expiring within 7 days",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:p-5">
        <h1 className="text-2xl font-bold font-heading lg:text-[2rem] leading-tight">
          {getTimeAwareGreeting(firstName)} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s today&apos;s market operations overview.
        </p>
        <p className="text-sm text-muted-foreground">
          Monitor approvals, stalls, payments, utilities, and complaints in one place.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <Card key={item.label} className="stat-card">
            <CardContent className="p-3.5 lg:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg lg:text-xl font-bold font-heading leading-none">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="card-warm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base font-heading">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 pt-0 px-4 pb-4">
          {quickActions.map((action, index) => (
            <Button
              key={action.label}
              asChild
              variant={index === 0 ? "default" : "outline"}
              className="justify-start gap-2"
            >
              <Link to={action.path}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">Vendor Approvals</CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/manager/vendors">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-[290px] px-4 pb-4">
            {approvalRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No vendor or stall applications need review right now.
              </p>
            ) : (
              approvalRows.slice(0, 3).map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.vendorName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.market} • {formatHumanDate(row.appliedAt)}
                      </p>
                    </div>
                    <StatusBadge
                      status={row.status}
                      context={row.kind === "booking" ? "booking" : "vendor"}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={row.kind === "vendor" ? "/manager/vendors" : "/manager/stalls"}>
                        View
                      </Link>
                    </Button>
                    <Button size="sm" onClick={() => approveRow(row)} disabled={actionDisabled}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectRow(row)}
                      disabled={actionDisabled}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm h-[360px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">
                Payments Awaiting Confirmation
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/manager/payments">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-[290px] px-4 pb-4">
            {pendingPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No vendor payments are awaiting confirmation.
              </p>
            ) : (
              pendingPayments.slice(0, 3).map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{payment.vendorName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getPaymentPurpose(payment)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
                        {getPaymentReference(payment)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      <div className="mt-2">
                        <StatusBadge status={payment.status} context="payment" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/manager/payments">View</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="card-warm h-[300px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-heading">Stall Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 px-4 pb-4">
            {occupancySummary.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-bold font-heading">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-warm h-[300px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">Utility Charges</CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/manager/billing">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-[230px] px-4 pb-4">
            {utilityRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No open utility charges need follow-up.
              </p>
            ) : (
              utilityRows.map((charge) => (
                <div
                  key={charge.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{charge.vendorName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {utilityLabels[charge.utilityType]} • {charge.billingPeriod}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {charge.stallName || "No stall linked"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(charge.amount)}</p>
                      <div className="mt-2">
                        <StatusBadge status={charge.status} context="obligation" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/manager/billing">View</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm h-[300px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-heading">Complaints / Issues</CardTitle>
              <Button asChild variant="ghost" size="sm" className="px-0 h-auto">
                <Link to="/manager/complaints">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-[230px] px-4 pb-4">
            {complaintRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No open complaints need response.
              </p>
            ) : (
              complaintRows.map((ticket) => {
                const priority = getComplaintPriority(ticket);
                const priorityClasses =
                  priority === "High"
                    ? "border-destructive/20 bg-destructive/15 text-destructive"
                    : priority === "Medium"
                      ? "border-warning/20 bg-warning/15 text-warning-foreground"
                      : "border-border bg-muted text-muted-foreground";

                return (
                  <div
                    key={ticket.id}
                    className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{ticket.vendorName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{ticket.subject}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {categoryLabels[ticket.category]} • {formatHumanDate(ticket.createdAt)}
                        </p>
                      </div>
                      <span className={`status-badge ${priorityClasses}`}>{priority}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <StatusBadge status={ticket.status} context="ticket" />
                      <Button
                        asChild
                        size="sm"
                        variant={priority === "High" ? "default" : "outline"}
                      >
                        <Link to="/manager/complaints">Respond</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;
