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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import type { BookingStatus, ChargeTypeName, Payment, Ticket, UtilityCharge, UtilityType, VendorApprovalStatus } from "@/types";

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
  payment.providerReference || payment.transactionId || payment.externalReference || "Awaiting reference";

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

  const { data: stallsData } = useQuery({ queryKey: ["stalls"], queryFn: () => api.getStalls() });
  const { data: bookingsData } = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const { data: paymentsData } = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments(), refetchInterval: 10_000 });
  const { data: vendorsData } = useQuery({ queryKey: ["vendors"], queryFn: () => api.getVendors() });
  const { data: ticketsData } = useQuery({ queryKey: ["tickets"], queryFn: () => api.getTickets() });
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
    mutationFn: (vendorId: string) => api.rejectVendor(vendorId, "Rejected from manager dashboard review."),
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
      approved ? api.approveBooking(bookingId) : api.rejectBooking(bookingId, "Application requirements were not met."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Application reviewed");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Unable to review booking application.";
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
  const highPriorityComplaints = openComplaints.filter((ticket) => getComplaintPriority(ticket) === "High");
  const firstName = user?.name?.split(" ")[0] || "there";

  const renewalPending = bookings.filter((booking) => {
    if (!["approved", "paid"].includes(booking.status)) return false;
    const hoursLeft = Math.round((endOfDay(booking.endDate).getTime() - Date.now()) / (1000 * 60 * 60));
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
  ].sort((left, right) => new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime());

  const stallRows = [...stalls]
    .sort((left, right) => {
      const weight = { inactive: 0, maintenance: 1, active: 2 };
      return weight[left.status] - weight[right.status] || left.zone.localeCompare(right.zone) || left.name.localeCompare(right.name);
    })
    .slice(0, 8);

  const utilityRows = utilityCharges
    .filter((charge) => charge.status !== "paid" && charge.status !== "cancelled")
    .sort((left, right) => utilityStatusWeight[left.status] - utilityStatusWeight[right.status])
    .slice(0, 5);

  const complaintRows = [...openComplaints]
    .sort((left, right) => {
      const priorityWeight = { High: 0, Medium: 1, Normal: 2 };
      const priorityDifference = priorityWeight[getComplaintPriority(left)] - priorityWeight[getComplaintPriority(right)];
      return priorityDifference || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 6);

  const actionDisabled = approveVendor.isPending || rejectVendor.isPending || reviewBookingApplication.isPending;

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
    { label: "Occupied Stalls", value: activeStalls.length, detail: "Assigned to vendors", icon: CheckCircle2 },
    { label: "Vacant Stalls", value: vacantStalls.length, detail: "Available for allocation", icon: Grid3X3 },
    { label: "Maintenance Stalls", value: maintenanceStalls.length, detail: "Need follow-up", icon: Wrench },
    { label: "Renewal Pending", value: renewalPending.length, detail: "Expiring within 7 days", icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:p-6">
        <h1 className="text-2xl font-bold font-heading lg:text-3xl">{getTimeAwareGreeting(firstName)} 👋</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Here&apos;s today&apos;s market operations overview.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor approvals, stalls, payments, utilities, and complaints in one place.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <Card key={item.label} className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-bold font-heading">{item.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action, index) => (
            <Button key={action.label} asChild variant={index === 0 ? "default" : "outline"} className="justify-start gap-2">
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
          <CardTitle className="text-base font-heading">Vendor Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {approvalRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No vendor or stall applications need review right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalRows.slice(0, 6).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.vendorName}</p>
                      <p className="text-xs text-muted-foreground">{row.detail}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.market}</TableCell>
                    <TableCell className="text-muted-foreground">{formatHumanDate(row.appliedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} context={row.kind === "booking" ? "booking" : "vendor"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={row.kind === "vendor" ? "/manager/vendors" : "/manager/stalls"}>View Details</Link>
                        </Button>
                        <Button size="sm" onClick={() => approveRow(row)} disabled={actionDisabled}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => rejectRow(row)} disabled={actionDisabled}>
                          Reject
                        </Button>
                      </div>
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
          <CardTitle className="text-base font-heading">Stall & Occupancy Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {occupancySummary.map((item) => (
              <div key={item.label} className="rounded-lg border border-border/70 bg-muted/20 p-3">
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
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stall</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Monthly Fee</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stallRows.map((stall) => (
                <TableRow key={stall.id}>
                  <TableCell>
                    <p className="font-medium">{stall.name}</p>
                    <p className="text-xs text-muted-foreground">{stall.vendorName || "Unassigned"}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{stall.zone}</TableCell>
                  <TableCell className="text-muted-foreground">{stall.size}</TableCell>
                  <TableCell><StatusBadge status={stall.status} /></TableCell>
                  <TableCell>{formatCurrency(stall.pricePerMonth)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/manager/stalls">View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Payments Awaiting Confirmation</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No vendor payments are awaiting confirmation.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPayments.slice(0, 5).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.vendorName}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{getPaymentPurpose(payment)}</TableCell>
                      <TableCell><StatusBadge status={payment.status} context="payment" /></TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                        {getPaymentReference(payment)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/manager/payments">View</Link>
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
            <CardTitle className="text-base font-heading">Utility Charges</CardTitle>
          </CardHeader>
          <CardContent>
            {utilityRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No open utility charges need follow-up.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Utility</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utilityRows.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell>
                        <p className="font-medium">{charge.vendorName}</p>
                        <p className="text-xs text-muted-foreground">{charge.stallName || "No stall linked"}</p>
                      </TableCell>
                      <TableCell>{utilityLabels[charge.utilityType]}</TableCell>
                      <TableCell className="text-muted-foreground">{charge.billingPeriod}</TableCell>
                      <TableCell>{formatCurrency(charge.amount)}</TableCell>
                      <TableCell><StatusBadge status={charge.status} context="obligation" /></TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/manager/billing">View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Complaints / Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {complaintRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open complaints need response.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaintRows.map((ticket) => {
                  const priority = getComplaintPriority(ticket);

                  return (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.vendorName}</TableCell>
                      <TableCell>
                        <p className="font-medium">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{categoryLabels[ticket.category]} - {formatHumanDate(ticket.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <span className={priority === "High" ? "status-badge border-destructive/20 bg-destructive/15 text-destructive" : "status-badge border-border bg-muted text-muted-foreground"}>
                          {priority}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={ticket.status} context="ticket" /></TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant={priority === "High" ? "default" : "outline"}>
                          <Link to="/manager/complaints">Respond</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerDashboard;
