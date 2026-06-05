import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Grid3X3,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate, getTimeAwareGreeting } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConsolePage,
  EmptyState,
  KpiStrip,
  LoadingState,
  PageHeader,
  Panel,
  RecordCard,
  SegmentedControl,
} from "@/components/console/ConsolePage";
import { StatusBadge } from "@/components/StatusBadge";
import {
  PriorityIndicator,
  ScanCounter,
  CompactStatusCard,
} from "@/components/ScanComponents";
import { toast } from "@/components/ui/sonner";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import type {
  BookingStatus,
  ChargeTypeName,
  Payment,
  Ticket,
  UtilityCharge,
  VendorApprovalStatus,
} from "@/types";

const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);

const RENEWAL_WARNING_HOURS = DASHBOARD_CONFIG.RENEWAL_WARNING_DAYS * 24;

const categoryLabels: Record<Ticket["category"], string> = {
  billing: "Billing",
  maintenance: "Maintenance",
  dispute: "Dispute",
  payment: "Payment",
  stall: "Stall",
  sanitation: "Sanitation",
  harassment: "Harassment",
  other: "Other",
};

const chargeTypeLabels: Record<ChargeTypeName, string> = {
  market_dues: "Market dues",
  utilities: "Utility charge",
  penalties: "Penalty",
  booking_fee: "Booking fee",
  payment_gateway: "Payment service",
};

type ActiveTaskTab = "approvals" | "payments" | "complaints";

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
  const [activeTaskTab, setActiveTaskTab] = useState<ActiveTaskTab>("approvals");
  const [confirmAction, setConfirmAction] = useState<{
    row: ApprovalRow;
    action: "approve" | "reject";
  } | null>(null);

  const { data: stallsData, isPending: stallsPending } = useQuery({
    queryKey: ["stalls"],
    queryFn: () => api.getStalls(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const { data: bookingsData, isPending: bookingsPending } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const { data: paymentsData, isPending: paymentsPending } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const { data: vendorsData, isPending: vendorsPending } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.getVendors(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const { data: ticketsData, isPending: ticketsPending } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.getTickets(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const { data: utilityChargesData, isPending: utilityChargesPending } = useQuery({
    queryKey: ["utility-charges", "manager-dashboard"],
    queryFn: () => api.getUtilityCharges(),
    refetchInterval: DASHBOARD_CONFIG.UTILITIES_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
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

  const isDashboardLoading =
    stallsPending ||
    bookingsPending ||
    paymentsPending ||
    vendorsPending ||
    ticketsPending ||
    utilityChargesPending;

  if (isDashboardLoading) {
    return (
      <div className="space-y-3">
        <LoadingState rows={1} itemClassName="h-20 rounded-xl" />
        <LoadingState
          rows={4}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          itemClassName="h-20 rounded-xl"
        />
        <LoadingState
          rows={2}
          className="grid gap-3 xl:grid-cols-[2fr_1fr]"
          itemClassName="h-[340px] rounded-xl"
        />
      </div>
    );
  }

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

    return hoursLeft >= 0 && hoursLeft <= RENEWAL_WARNING_HOURS;
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
    .slice(0, DASHBOARD_CONFIG.UTILITY_PREVIEW_LIMIT);

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
    .slice(0, DASHBOARD_CONFIG.COMPLAINT_PREVIEW_LIMIT);

  const actionDisabled =
    approveVendor.isPending || rejectVendor.isPending || reviewBookingApplication.isPending;

  const approveRow = (row: ApprovalRow) => {
    setConfirmAction({ row, action: "approve" });
  };

  const rejectRow = (row: ApprovalRow) => {
    setConfirmAction({ row, action: "reject" });
  };

  const executeConfirmedAction = () => {
    if (!confirmAction) return;
    const { row, action } = confirmAction;
    setConfirmAction(null);
    if (action === "approve") {
      if (row.kind === "vendor") {
        approveVendor.mutate(row.vendorId);
      } else {
        reviewBookingApplication.mutate({ bookingId: row.bookingId, approved: true });
      }
    } else {
      if (row.kind === "vendor") {
        rejectVendor.mutate(row.vendorId);
      } else {
        reviewBookingApplication.mutate({ bookingId: row.bookingId, approved: false });
      }
    }
  };

  const occupancyRate =
    stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 0;

  const unpaidUtilitiesTotal = utilityCharges
    .filter((charge) => charge.status !== "paid" && charge.status !== "cancelled")
    .reduce((total, charge) => total + Number(charge.amount || 0), 0);

  const pendingPaymentsTotal = pendingPayments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0,
  );

  // Build real 7-day sparklines from actual data timestamps
  const buildSparkline = (items: Array<{ createdAt: string }>, windowDays = 7): number[] => {
    const now = Date.now();
    const buckets = Array.from({ length: windowDays }, (_, i) => {
      const dayStart = now - (windowDays - 1 - i) * 86_400_000;
      const dayEnd = dayStart + 86_400_000;
      return items.filter((item) => {
        const t = new Date(item.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
    });
    // Ensure at least a flat non-zero line so the chart renders
    const max = Math.max(...buckets, 1);
    return buckets.map((v) => Math.max(v, max * 0.05));
  };

  const approvalSparkline = buildSparkline([
    ...pendingVendors.map((v) => ({ createdAt: v.createdAt })),
    ...pendingApplications.map((b) => ({ createdAt: b.createdAt })),
  ]);
  const stallsSparkline = buildSparkline(bookings); // bookings as proxy for stall activity
  const paymentsSparkline = buildSparkline(pendingPayments);
  const complaintsSparkline = buildSparkline(openComplaints);

  const kpis = [
    {
      label: "Pending Approvals",
      value: approvalRows.length,
      detail: (
        <>
          <span className="block">Awaiting review</span>
          <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {pendingVendors.length} vendors
          </span>
        </>
      ),
      icon: ClipboardList,
      tone: "warning" as const,
      sparkline: approvalSparkline,
    },
    {
      label: "Active Stalls",
      value: activeStalls.length,
      detail: (
        <>
          <span className="block">{vacantStalls.length} vacant</span>
          <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {occupancyRate}% occupied
          </span>
        </>
      ),
      icon: Grid3X3,
      tone: "success" as const,
      sparkline: stallsSparkline,
    },
    {
      label: "Pending Payments",
      value: pendingPayments.length,
      detail: (
        <>
          <span className="block">Awaiting confirmation</span>
          <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {formatCurrency(pendingPaymentsTotal)}
          </span>
        </>
      ),
      icon: CreditCard,
      tone: "info" as const,
      sparkline: paymentsSparkline,
    },
    {
      label: "Open Complaints",
      value: openComplaints.length,
      detail: (
        <>
          <span className="block">{highPriorityComplaints.length} high priority</span>
          <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px]">
            Needs action
          </span>
        </>
      ),
      icon: AlertCircle,
      tone: highPriorityComplaints.length ? ("destructive" as const) : ("default" as const),
      sparkline: complaintsSparkline,
    },
  ];

  const occupancySummary = [
    { label: "Occupied", value: activeStalls.length, detail: "Assigned", icon: CheckCircle2 },
    { label: "Vacant", value: vacantStalls.length, detail: "Available", icon: Grid3X3 },
    { label: "Maintenance", value: maintenanceStalls.length, detail: "Needs follow-up", icon: Wrench },
    { label: "Renewals", value: renewalPending.length, detail: "Within 7 days", icon: AlertCircle },
  ];

  const taskTabs: Array<{ key: ActiveTaskTab; label: string; count: number }> = [
    { key: "approvals", label: "Approvals", count: approvalRows.length },
    { key: "payments", label: "Payments", count: pendingPayments.length },
    { key: "complaints", label: "Complaints", count: openComplaints.length },
  ];
  const taskTabOptions: Array<{ value: ActiveTaskTab; label: string; count: number }> =
    taskTabs.map((tab) => ({
      value: tab.key,
      label: tab.label,
      count: tab.count,
    }));

  const activeTaskRoute =
    activeTaskTab === "payments"
      ? "/manager/payments"
      : activeTaskTab === "complaints"
        ? "/manager/complaints"
        : "/manager/vendors";

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Manager workspace"
        title={getTimeAwareGreeting(firstName)}
        description="Immediate market decisions, escalations, payment follow-ups, and occupancy signals."
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">{approvalRows.length} approvals</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{openComplaints.length} complaints</span>
          </>
        }
      />
      <KpiStrip items={kpis} columns="grid-cols-2 xl:grid-cols-4" />

      <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <DashboardErrorBoundary>
          <Panel
            title="Active Tasks"
            description="Decisions that need manager action today."
            actions={
              <Button asChild variant="ghost" size="sm" className="h-auto px-0">
                <Link to={activeTaskRoute}>View all</Link>
              </Button>
            }
            className="xl:h-[372px]"
            contentClassName="space-y-2 xl:max-h-[292px] xl:overflow-y-auto"
          >
          <SegmentedControl<ActiveTaskTab>
            value={activeTaskTab}
            options={taskTabOptions}
            onChange={(value) => setActiveTaskTab(value)}
          />
            {activeTaskTab === "approvals" && (
              <>
                {approvalRows.length === 0 ? (
                  <EmptyState
                    title="No reviews waiting"
                    description="Vendor registrations and stall applications will appear here."
                  />
                ) : (
                  approvalRows.slice(0, DASHBOARD_CONFIG.DASHBOARD_PREVIEW_LIMIT).map((row) => (
                    <RecordCard key={row.id}>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{row.vendorName}</p>
                            <StatusBadge
                              status={row.status}
                              context={row.kind === "booking" ? "booking" : "vendor"}
                            />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {row.detail}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {row.market} - {formatHumanDate(row.appliedAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild size="sm" variant="outline" className="h-8">
                            <Link to={row.kind === "vendor" ? "/manager/vendors" : "/manager/stalls"}>
                              View
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => approveRow(row)}
                            disabled={actionDisabled}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className="h-8"
                            variant="destructive"
                            onClick={() => rejectRow(row)}
                            disabled={actionDisabled}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </RecordCard>
                  ))
                )}
              </>
            )}

            {activeTaskTab === "payments" && (
              <>
                {pendingPayments.length === 0 ? (
                  <EmptyState
                    title="No payments waiting"
                    description="Pending confirmations will appear here."
                  />
                ) : (
                  pendingPayments.slice(0, DASHBOARD_CONFIG.DASHBOARD_PREVIEW_LIMIT).map((payment) => (
                    <RecordCard key={payment.id}>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{payment.vendorName}</p>
                            <StatusBadge status={payment.status} context="payment" />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {getPaymentPurpose(payment)}
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {getPaymentReference(payment)}
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                          <p className="text-sm font-semibold">{formatCurrency(payment.amount)}</p>
                          <Button asChild size="sm" variant="outline" className="h-8">
                            <Link to="/manager/payments">View</Link>
                          </Button>
                        </div>
                      </div>
                    </RecordCard>
                  ))
                )}
              </>
            )}

            {activeTaskTab === "complaints" && (
              <>
                {complaintRows.length === 0 ? (
                  <EmptyState
                    title="No open complaints"
                    description="Vendor issues needing response will appear here."
                  />
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
                      <RecordCard key={ticket.id}>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{ticket.vendorName}</p>
                              <span className={`status-badge ${priorityClasses}`}>
                                {priority}
                              </span>
                              <StatusBadge status={ticket.status} context="ticket" />
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {ticket.subject}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {categoryLabels[ticket.category]} - {formatHumanDate(ticket.createdAt)}
                            </p>
                          </div>

                          <Button
                            asChild
                            size="sm"
                            className="h-8"
                            variant={priority === "High" ? "default" : "outline"}
                          >
                            <Link to="/manager/complaints">Respond</Link>
                          </Button>
                        </div>
                      </RecordCard>
                    );
                  })
                )}
              </>
            )}
          </Panel>
        </DashboardErrorBoundary>

        <DashboardErrorBoundary>
          <Panel
            title="Market Health"
            description="Occupancy signals and unpaid utility payments due."
            className="xl:h-[372px]"
            contentClassName="space-y-3"
          >
            <div className="rounded-md border border-border/70 bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Occupancy</p>
                  <p className="mt-0.5 text-2xl font-bold leading-none font-heading">{occupancyRate}%</p>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {activeStalls.length} of {stalls.length} stalls assigned
                </p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(occupancyRate, 100)}%` }} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {occupancySummary.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-md border border-border/70 bg-background p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>

                  <p className="text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-xs text-muted-foreground">Utilities due</p>
                <p className="mt-1 truncate text-base font-bold font-heading">
                  {formatCurrency(unpaidUtilitiesTotal)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-xs text-muted-foreground">Follow-ups</p>
                <p className="mt-1 text-base font-bold font-heading">{utilityRows.length}</p>
              </div>
            </div>
          </Panel>
        </DashboardErrorBoundary>
      </div>
      {/* Confirmation dialog for approve / reject actions */}
      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {confirmAction?.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "approve"
                ? `Approve ${confirmAction.row.kind === "vendor" ? "vendor registration" : "stall application"} for ${confirmAction.row.vendorName}? This will grant them access to the relevant workspace features.`
                : `Reject ${confirmAction.row.kind === "vendor" ? "vendor registration" : "stall application"} for ${confirmAction.row.vendorName}? They will be notified of the decision.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === "approve" ? "default" : "destructive"}
              onClick={executeConfirmedAction}
              disabled={actionDisabled}
            >
              {confirmAction?.action === "approve" ? "Yes, Approve" : "Yes, Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePage>
  );
};

export default ManagerDashboard;
