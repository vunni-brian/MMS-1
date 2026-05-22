import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ReceiptText,
  Upload,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import {
  filterPaymentsByHistory,
  getPaymentHistoryYears,
  getPaymentPurpose,
  getPaymentReference,
  type PaymentHistoryStatusFilter,
} from "@/lib/payment-history";
import {
  formatCurrency,
  formatHumanDate,
  formatHumanDateRange,
  formatHumanDateTime,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ConsolePage,
  DataTableFrame,
  DetailSheet,
  EmptyState,
  EvidenceField,
  LoadingState,
  PageHeader,
  Panel,
  ScopeBar,
  ScopeItem,
  SegmentedControl,
} from "@/components/console/ConsolePage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import type { Payment, PaymentMethod, Penalty, UtilityCharge, UtilityType } from "@/types";

type OutstandingTab = "bookings" | "utilities" | "penalties";

const paymentMethodMeta: Record<PaymentMethod, { label: string; className: string }> = {
  mtn: { label: "MTN", className: "bg-muted text-muted-foreground" },
  airtel: { label: "AIRTEL", className: "bg-muted text-muted-foreground" },
  pesapal: { label: "Receipt", className: "bg-muted text-muted-foreground" },
  receipt: { label: "Receipt", className: "bg-muted text-muted-foreground" },
};

const utilityTypeLabels: Record<UtilityType, string> = {
  electricity: "Electricity",
  water: "Water",
  sanitation: "Sanitation",
  garbage: "Garbage",
  other: "Utility",
};

const paymentStatusFilters: { label: string; value: PaymentHistoryStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
];

const formatDateTime = (value: string | null, fallback = "Not available") => {
  return formatHumanDateTime(value, fallback);
};

const formatDate = (value: string | null, fallback = "Not available") => {
  return formatHumanDate(value ? `${value}T00:00:00` : null, fallback);
};

const getPaymentStatusLabel = (status: Payment["status"]) =>
  status === "pending" ? "Pending" : undefined;

const getUtilityStatusLabel = (status: UtilityCharge["status"]) =>
  status === "pending" || status === "pending_payment"
    ? "Pending Payment"
    : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

const getPaymentChannelDescription = (payment: Payment) => {
  const methodLabel = paymentMethodMeta[payment.method].label;
  if (payment.bookingId) return `${methodLabel} payment for stall booking`;
  if (payment.utilityChargeId) return `${methodLabel} utility payment`;
  if (payment.penaltyId) return `${methodLabel} penalty payment`;
  return `${methodLabel} payment`;
};

const getUtilityChargeTitle = (charge: UtilityCharge) =>
  charge.description?.trim() ||
  [utilityTypeLabels[charge.utilityType], charge.billingPeriod].filter(Boolean).join(" - ");

const getUtilityCalculationSummary = (charge: UtilityCharge) => {
  if (charge.calculationMethod === "fixed") return "Fixed service charge";
  if (charge.usageQuantity == null || charge.ratePerUnit == null) {
    return `${charge.calculationMethod} usage`;
  }

  const unit = charge.unit || "unit";
  return `${charge.usageQuantity.toLocaleString()} ${unit} x ${formatCurrency(
    charge.ratePerUnit,
  )} per ${unit}`;
};

const getReceiptMessageClassName = (status: Payment["status"]) =>
  status === "completed"
    ? "border-success/20 bg-success/5 text-success"
    : status === "failed"
      ? "border-destructive/20 bg-destructive/5 text-destructive"
      : "border-border/70 bg-muted/20 text-muted-foreground";

const PaymentsPage = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  const [outstandingTab, setOutstandingTab] = useState<OutstandingTab>("bookings");
  const [paymentIntent, setPaymentIntent] = useState<{
    title: string;
    subtitle: string;
    amount: number;
    payload: {
      bookingId?: string | null;
      utilityChargeId?: string | null;
      penaltyId?: string | null;
    };
  } | null>(null);
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentHistoryStatusFilter>("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    refetchInterval: 8_000,
  });

  const utilityChargesQuery = useQuery({
    queryKey: ["utility-charges", role, user?.marketId || "all"],
    queryFn: () => api.getUtilityCharges(),
    enabled: role === "vendor",
    refetchInterval: 8_000,
  });

  const penaltiesQuery = useQuery({
    queryKey: ["penalties", role, user?.marketId || "all"],
    queryFn: () => api.getPenalties(),
    enabled: role === "vendor",
    refetchInterval: 8_000,
  });

  const isPending =
    bookingsQuery.isPending ||
    paymentsQuery.isPending ||
    (role === "vendor" && (utilityChargesQuery.isPending || penaltiesQuery.isPending));

  const isError =
    bookingsQuery.isError ||
    paymentsQuery.isError ||
    (role === "vendor" && (utilityChargesQuery.isError || penaltiesQuery.isError));

  const bookingsData = bookingsQuery.data;
  const paymentsData = paymentsQuery.data;
  const utilityChargesData = utilityChargesQuery.data;
  const penaltiesData = penaltiesQuery.data;

  const receiptQuery = useQuery({
    queryKey: ["receipt", selectedReceiptPaymentId],
    queryFn: () => api.getReceipt(selectedReceiptPaymentId!),
    enabled: Boolean(selectedReceiptPaymentId),
  });

  const initiatePayment = useMutation({
    mutationFn: (payload: {
      bookingId?: string | null;
      utilityChargeId?: string | null;
      penaltyId?: string | null;
      receiptNumber?: string | null;
      receiptNote?: string | null;
      receiptFile?: File | null;
    }) => api.initiatePayment(payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["utility-charges"] });
      await queryClient.invalidateQueries({ queryKey: ["penalties"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });

      toast.success("Receipt uploaded", {
        description: "A manager will review the receipt and update the payment status.",
      });

      setError(null);
      setPaymentIntent(null);
      setReceiptNumber("");
      setReceiptNote("");
      setReceiptFile(null);
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Unable to initiate payment.";
      setError(message);
      toast.error("Payment could not start", { description: message });
    },
  });

  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const penalties = penaltiesData?.penalties || [];

  const pendingBookings = bookings.filter((booking) => booking.status === "approved");

  const filteredPayments =
    role === "vendor"
      ? filterPaymentsByHistory(payments, { status: statusFilter, year: yearFilter, dateFrom, dateTo })
      : payments;

  const paymentHistoryYears = getPaymentHistoryYears(payments);

  const pendingPaymentByBooking = payments.reduce<Record<string, Payment>>((acc, payment) => {
    if (payment.status === "pending" && payment.bookingId) acc[payment.bookingId] = payment;
    return acc;
  }, {});

  const pendingPaymentByUtilityCharge = payments.reduce<Record<string, Payment>>((acc, payment) => {
    if (payment.status === "pending" && payment.utilityChargeId) {
      acc[payment.utilityChargeId] = payment;
    }
    return acc;
  }, {});

  const pendingPaymentByPenalty = payments.reduce<Record<string, Payment>>((acc, payment) => {
    if (payment.status === "pending" && payment.penaltyId) acc[payment.penaltyId] = payment;
    return acc;
  }, {});

  const selectedReceiptPayment =
    payments.find((payment) => payment.id === selectedReceiptPaymentId) || null;

  const hasHistoryFilters =
    statusFilter !== "all" || yearFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo);

  const paymentReference = selectedReceiptPayment ? getPaymentReference(selectedReceiptPayment) : null;
  const paymentPurpose = selectedReceiptPayment ? getPaymentPurpose(selectedReceiptPayment) : null;
  const paymentMessage =
    receiptQuery.data?.receipt.message ||
    selectedReceiptPayment?.receiptMessage ||
    "Receipt details are not available.";
  const paymentReceiptId =
    receiptQuery.data?.receipt.receiptId ||
    selectedReceiptPayment?.receiptId ||
    "Pending receipt generation";
  const paymentAmount = receiptQuery.data?.receipt.amount || selectedReceiptPayment?.amount || 0;
  const paymentCompletedAt =
    receiptQuery.data?.receipt.createdAt || selectedReceiptPayment?.completedAt || null;

  const payableUtilityCharges = utilityCharges.filter(
    (charge) => charge.status === "unpaid" || charge.status === "overdue" || charge.status === "pending",
  );

  const payablePenalties = penalties.filter(
    (penalty: Penalty) => penalty.status === "unpaid" || penalty.status === "pending",
  );

  const outstandingTabs: Array<{ key: OutstandingTab; label: string; count: number }> = [
    { key: "bookings", label: "Bookings", count: pendingBookings.length },
    { key: "utilities", label: "Utilities", count: payableUtilityCharges.length },
    { key: "penalties", label: "Penalties", count: payablePenalties.length },
  ];

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Payments and evidence"
        title="Payments"
        description={role === "vendor" ? "Obligations, receipt upload, and verification status." : "Receipt status, references, and verification evidence."}
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">Role: {role}</span>
            {user?.marketName && (
              <span className="rounded-full bg-muted px-2.5 py-1">
                Market: {user.marketName}
              </span>
            )}
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {role === "vendor" && (
        <ScopeBar>
          <ScopeItem label="Status" className="w-full sm:w-[170px]">
            <Select value={statusFilter} onValueChange={(value: PaymentHistoryStatusFilter) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {paymentStatusFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ScopeItem>

          <ScopeItem label="Year" className="w-full sm:w-[150px]">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {paymentHistoryYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ScopeItem>

          <ScopeItem label="From" className="w-full sm:w-[160px]">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              max={dateTo || undefined}
            />
          </ScopeItem>

          <ScopeItem label="To" className="w-full sm:w-[160px]">
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              min={dateFrom || undefined}
            />
          </ScopeItem>

          {hasHistoryFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setYearFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </ScopeBar>
      )}

      {isError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading payments</AlertTitle>
          <AlertDescription>
            We couldn&apos;t reach the server to load the payment data. Please check your connection.
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        <LoadingState rows={role === "vendor" ? 7 : 5} itemClassName="h-28 rounded-xl" />
      ) : (
        <>
          {role === "vendor" && (
            <Panel
              title="Outstanding Payments"
              description="Booking fees, utilities, and penalties awaiting payment."
              actions={
                <SegmentedControl<OutstandingTab>
                  value={outstandingTab}
                  options={outstandingTabs.map((tab) => ({
                    value: tab.key,
                    label: tab.label,
                    count: tab.count,
                  }))}
                  onChange={setOutstandingTab}
                />
              }
              contentClassName="space-y-3"
            >
                {outstandingTab === "bookings" && (
                  <>
                    {pendingBookings.length === 0 ? (
                      <EmptyState
                        title="No approved bookings awaiting payment"
                        description="Approved booking fees will appear here when a stall application is ready for checkout."
                      />
                    ) : (
                      pendingBookings.map((booking) => {
                        const pendingPayment = pendingPaymentByBooking[booking.id];
                        const feeDisabled = booking.amount <= 0;

                        return (
                          <div
                            key={booking.id}
                            className="rounded-md border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium text-sm">{booking.stallName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatHumanDateRange(booking.startDate, booking.endDate)}
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  {formatCurrency(booking.amount)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {pendingPayment && (
                                  <StatusBadge status="pending" context="payment" />
                                )}
                                <Button
                                  onClick={() => {
                                    setPaymentIntent({
                                      title: booking.stallName,
                                      subtitle: formatHumanDateRange(
                                        booking.startDate,
                                        booking.endDate,
                                      ),
                                      amount: booking.amount,
                                      payload: { bookingId: booking.id },
                                    });
                                    setError(null);
                                  }}
                                  disabled={Boolean(pendingPayment) || feeDisabled}
                                >
                                  <Wallet className="mr-1 h-4 w-4" />
                                  {feeDisabled
                                    ? "No payments due"
                                    : pendingPayment
                                      ? "Pending"
                                      : "Upload Receipt"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {outstandingTab === "utilities" && (
                  <>
                    {utilityCharges.length === 0 ? (
                      <EmptyState
                        title="No utility charges"
                        description="Utility charges assigned to your account will appear here."
                      />
                    ) : (
                      utilityCharges.map((charge) => {
                        const pendingPayment = pendingPaymentByUtilityCharge[charge.id];
                        const amountDisabled = charge.amount <= 0;
                        const canPay =
                          (charge.status === "unpaid" || charge.status === "overdue") &&
                          !amountDisabled;
                        const canViewReceipt =
                          charge.status === "paid" && Boolean(charge.latestPaymentId);
                        const actionLabel =
                          pendingPayment || charge.status === "pending"
                            ? "Pending"
                            : "Upload Receipt";

                        return (
                          <div
                            key={charge.id}
                            className="rounded-md border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="font-medium">{getUtilityChargeTitle(charge)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {utilityTypeLabels[charge.utilityType]} - {charge.billingPeriod}
                                  {charge.stallName ? ` - ${charge.stallName}` : ""}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  status={charge.status}
                                  label={getUtilityStatusLabel(charge.status)}
                                  context="obligation"
                                />
                                <span className="text-sm font-semibold">
                                  {formatCurrency(charge.amount)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <EvidenceField label="Due Date" value={formatDate(charge.dueDate)} />
                              <EvidenceField
                                label="Calculation"
                                value={getUtilityCalculationSummary(charge)}
                              />
                              <EvidenceField
                                label="Latest Reference"
                                value={
                                  charge.latestPaymentReference ||
                                  "Awaiting payment reference"
                                }
                                mono={Boolean(charge.latestPaymentReference)}
                              />
                              <EvidenceField
                                label="Paid At"
                                value={formatDateTime(charge.paidAt, "Awaiting payment")}
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {canPay && (
                                <Button
                                  onClick={() => {
                                    setPaymentIntent({
                                      title: getUtilityChargeTitle(charge),
                                      subtitle: `${utilityTypeLabels[charge.utilityType]} - ${charge.billingPeriod
                                        }`,
                                      amount: charge.amount,
                                      payload: { utilityChargeId: charge.id },
                                    });
                                    setError(null);
                                  }}
                                  disabled={Boolean(pendingPayment)}
                                >
                                  <Wallet className="mr-1 h-4 w-4" />
                                  {actionLabel}
                                </Button>
                              )}

                              {amountDisabled && ["unpaid", "overdue"].includes(charge.status) && (
                                <Button disabled>
                                  <Wallet className="mr-1 h-4 w-4" />
                                  No payments due
                                </Button>
                              )}

                              {!amountDisabled &&
                                !canPay &&
                                (pendingPayment || charge.status === "pending") && (
                                  <Button disabled>
                                    <Wallet className="mr-1 h-4 w-4" />
                                    Pending
                                  </Button>
                                )}

                              {canViewReceipt && (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    setSelectedReceiptPaymentId(charge.latestPaymentId!)
                                  }
                                >
                                  <ReceiptText className="mr-1 h-4 w-4" />
                                  View Receipt
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {outstandingTab === "penalties" && (
                  <>
                    {penalties.length === 0 ? (
                      <EmptyState
                        title="No penalties issued"
                        description="Penalty obligations will appear here if issued to your account."
                      />
                    ) : (
                      penalties.map((penalty: Penalty) => {
                        const pendingPayment = pendingPaymentByPenalty[penalty.id];
                        const amountDisabled = penalty.amount <= 0;
                        const canPay = penalty.status === "unpaid" && !amountDisabled;
                        const canViewReceipt =
                          penalty.status === "paid" && Boolean(penalty.latestPaymentId);
                        const actionLabel =
                          pendingPayment || penalty.status === "pending"
                            ? "Pending"
                            : "Upload Receipt";

                        return (
                          <div
                            key={penalty.id}
                            className="rounded-md border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="font-medium">Penalty - {penalty.reason}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {penalty.marketName || "Market"}
                                  {penalty.relatedUtilityChargeDescription
                                    ? ` - ${penalty.relatedUtilityChargeDescription}`
                                    : ""}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  status={penalty.status}
                                  label={
                                    penalty.status === "pending" ? "Pending Payment" : undefined
                                  }
                                  context="obligation"
                                />
                                <span className="text-sm font-semibold">
                                  {formatCurrency(penalty.amount)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <EvidenceField
                                label="Issued At"
                                value={formatDateTime(penalty.createdAt)}
                              />
                              <EvidenceField
                                label="Latest Reference"
                                value={
                                  penalty.latestPaymentReference ||
                                  "Awaiting payment reference"
                                }
                                mono={Boolean(penalty.latestPaymentReference)}
                              />
                              <EvidenceField
                                label="Payment Attempts"
                                value={String(penalty.paymentCount)}
                              />
                              <EvidenceField
                                label="Paid At"
                                value={formatDateTime(penalty.paidAt, "Awaiting payment")}
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {canPay && (
                                <Button
                                  onClick={() => {
                                    setPaymentIntent({
                                      title: `Penalty - ${penalty.reason}`,
                                      subtitle:
                                        penalty.relatedUtilityChargeDescription ||
                                        "Compliance enforcement",
                                      amount: penalty.amount,
                                      payload: { penaltyId: penalty.id },
                                    });
                                    setError(null);
                                  }}
                                  disabled={Boolean(pendingPayment)}
                                >
                                  <Wallet className="mr-1 h-4 w-4" />
                                  {actionLabel}
                                </Button>
                              )}

                              {amountDisabled && penalty.status === "unpaid" && (
                                <Button disabled>
                                  <Wallet className="mr-1 h-4 w-4" />
                                  No payments due
                                </Button>
                              )}

                              {!amountDisabled &&
                                !canPay &&
                                (pendingPayment || penalty.status === "pending") && (
                                  <Button disabled>
                                    <Wallet className="mr-1 h-4 w-4" />
                                    Pending
                                  </Button>
                                )}

                              {canViewReceipt && (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    setSelectedReceiptPaymentId(penalty.latestPaymentId!)
                                  }
                                >
                                  <ReceiptText className="mr-1 h-4 w-4" />
                                  View Receipt
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
            </Panel>
          )}

          <DataTableFrame
            title={role === "vendor" ? "Payment History & Evidence" : "Payment Records"}
            description="Receipt references, verification status, and review evidence."
            actions={
              role === "vendor" && (
                <p className="text-xs text-muted-foreground">
                  Showing {filteredPayments.length} of {payments.length} record
                  {payments.length === 1 ? "" : "s"}
                </p>
              )
            }
          >
              {filteredPayments.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    title={
                      role === "vendor" && hasHistoryFilters
                        ? "No matching payment evidence"
                        : "No payment records yet"
                    }
                    description={
                      role === "vendor" && statusFilter === "cancelled"
                        ? "No cancelled payments are recorded in the system yet."
                        : role === "vendor" && hasHistoryFilters
                          ? "Adjust the filters to find older receipts or payment attempts."
                          : "Payment rows will appear here after a checkout attempt is created."
                    }
                  />
                </div>
              ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {role !== "vendor" && <TableHead>Vendor</TableHead>}
                        <TableHead>Market</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Reviewed At</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          {role !== "vendor" && (
                            <TableCell className="font-medium">
                              {payment.vendorName}
                            </TableCell>
                          )}

                          <TableCell className="min-w-[150px] text-sm text-muted-foreground">
                            {payment.marketName || "Unassigned"}
                          </TableCell>

                          <TableCell className="min-w-[240px]">
                            <div>
                              <p className="font-medium">{getPaymentPurpose(payment)}</p>
                              <div className="mt-2 flex items-center gap-2">
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-medium ${paymentMethodMeta[payment.method].className
                                    }`}
                                >
                                  {paymentMethodMeta[payment.method].label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {getPaymentChannelDescription(payment)}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>{formatCurrency(payment.amount)}</TableCell>

                          <TableCell className="min-w-[180px] font-mono text-xs">
                            {getPaymentReference(payment)}
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={payment.status}
                              label={getPaymentStatusLabel(payment.status)}
                              context="payment"
                            />
                          </TableCell>

                          <TableCell className="min-w-[160px] text-sm text-muted-foreground">
                            {formatDateTime(payment.createdAt)}
                          </TableCell>

                          <TableCell className="min-w-[160px] text-sm text-muted-foreground">
                            {formatDateTime(payment.completedAt, "Pending review")}
                          </TableCell>

                          <TableCell className="min-w-[190px]">
                            {payment.receiptFileName || payment.status === "completed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedReceiptPaymentId(payment.id)}
                              >
                                <ReceiptText className="mr-1 h-4 w-4" />
                                View Receipt
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No receipt uploaded
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              )}
          </DataTableFrame>
        </>
      )}

      <Dialog open={Boolean(paymentIntent)} onOpenChange={(open) => !open && setPaymentIntent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Upload Receipt</DialogTitle>
          </DialogHeader>

          {paymentIntent && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm">
                <p className="font-medium">{paymentIntent.title}</p>
                <p className="mt-1 text-muted-foreground">{paymentIntent.subtitle}</p>
                <p className="mt-2 text-lg font-bold font-heading">
                  {formatCurrency(paymentIntent.amount)}
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  value={receiptNumber}
                  onChange={(event) => setReceiptNumber(event.target.value)}
                  placeholder="Receipt number, for example RCPT-2026-00451"
                />
                <Input
                  value={receiptNote}
                  onChange={(event) => setReceiptNote(event.target.value)}
                  placeholder="Optional note"
                />
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Upload a clear image or PDF of the receipt. Status remains Pending until staff verify it.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() =>
                  initiatePayment.mutate({
                    ...paymentIntent.payload,
                    receiptNumber: receiptNumber || null,
                    receiptNote: receiptNote || null,
                    receiptFile,
                  })
                }
                disabled={initiatePayment.isPending || !receiptFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                {initiatePayment.isPending ? "Uploading..." : "Submit Receipt"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DetailSheet
        open={Boolean(selectedReceiptPaymentId)}
        onOpenChange={(open) => !open && setSelectedReceiptPaymentId(null)}
        title="Payment Receipt"
        description="Receipt reference, verification status, and review message."
      >
        {selectedReceiptPayment ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Receipt ID</p>
                <p className="mt-1 font-medium">{paymentReceiptId}</p>
              </div>
              <StatusBadge
                status={selectedReceiptPayment.status}
                label={getPaymentStatusLabel(selectedReceiptPayment.status)}
                context="payment"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceField label="Purpose" value={paymentPurpose || "Payment"} />
              <EvidenceField label="Amount" value={formatCurrency(paymentAmount)} />
              <EvidenceField label="Reference" value={paymentReference || "Awaiting reference"} mono />
              <EvidenceField label="Created At" value={formatDateTime(selectedReceiptPayment.createdAt)} />
              <EvidenceField
                label="Reviewed At"
                value={formatDateTime(paymentCompletedAt, "Pending review")}
              />
            </div>

            <div
              className={`whitespace-pre-line rounded-xl border p-4 ${getReceiptMessageClassName(
                selectedReceiptPayment.status,
              )}`}
            >
              {receiptQuery.isError
                ? "Unable to refresh the receipt from the server. The stored payment record is shown below.\n\n"
                : ""}
              {paymentMessage}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a completed payment to view its receipt.
          </p>
        )}
      </DetailSheet>
    </ConsolePage>
  );
};

export default PaymentsPage;
