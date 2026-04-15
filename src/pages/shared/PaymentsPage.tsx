import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CalendarRange, ExternalLink, ReceiptText, ShieldCheck, Wallet } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { filterPaymentsByHistory, getPaymentHistoryYears, getPaymentPurpose, getPaymentReference, type PaymentHistoryStatusFilter } from "@/lib/payment-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Payment, PaymentMethod, UtilityCharge, UtilityType } from "@/types";

const paymentMethodMeta: Record<PaymentMethod, { label: string; className: string }> = {
  mtn: { label: "MTN", className: "bg-warning/10 text-warning" },
  airtel: { label: "AIRTEL", className: "bg-destructive/10 text-destructive" },
  pesapal: { label: "PESAPAL", className: "bg-info/10 text-info" },
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
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
};

const formatDate = (value: string | null, fallback = "Not available") => {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
};

const getPaymentStatusLabel = (status: Payment["status"]) => (status === "pending" ? "Pending" : undefined);
const getUtilityStatusLabel = (status: UtilityCharge["status"]) =>
  status === "pending" ? "Pending" : status.charAt(0).toUpperCase() + status.slice(1);

const getPaymentChannelDescription = (payment: Payment) => {
  const methodLabel = paymentMethodMeta[payment.method].label;
  if (payment.bookingId) return `${methodLabel} payment for booking ${payment.bookingId}`;
  if (payment.utilityChargeId) return `${methodLabel} utility payment`;
  return `${methodLabel} payment`;
};

const getUtilityChargeTitle = (charge: UtilityCharge) =>
  charge.description?.trim() || [utilityTypeLabels[charge.utilityType], charge.billingPeriod].filter(Boolean).join(" - ");

const getUtilityCalculationSummary = (charge: UtilityCharge) => {
  if (charge.calculationMethod === "fixed") return "Fixed service charge";
  if (charge.usageQuantity == null || charge.ratePerUnit == null) return `${charge.calculationMethod} usage`;
  const unit = charge.unit || "unit";
  return `${charge.usageQuantity.toLocaleString()} ${unit} x UGX ${charge.ratePerUnit.toLocaleString()} per ${unit}`;
};

const getReceiptMessageClassName = (status: Payment["status"]) =>
  status === "completed"
    ? "border-success/20 bg-success/5 text-success"
    : status === "failed"
      ? "border-destructive/20 bg-destructive/5 text-destructive"
      : "border-border/70 bg-muted/20 text-muted-foreground";

const EvidenceField = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="rounded-xl bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`mt-1 break-words text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
  </div>
);

const PaymentsPage = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentIntent, setPaymentIntent] = useState<{ title: string; subtitle: string; amount: number; payload: { bookingId?: string | null; utilityChargeId?: string | null } } | null>(null);
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<{ redirectUrl: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentHistoryStatusFilter>("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: bookingsData } = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const { data: paymentsData } = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments(), refetchInterval: 8_000 });
  const { data: utilityChargesData } = useQuery({
    queryKey: ["utility-charges", role, user?.marketId || "all"],
    queryFn: () => api.getUtilityCharges(),
    enabled: role === "vendor",
    refetchInterval: 8_000,
  });
  const receiptQuery = useQuery({
    queryKey: ["receipt", selectedReceiptPaymentId],
    queryFn: () => api.getReceipt(selectedReceiptPaymentId!),
    enabled: Boolean(selectedReceiptPaymentId),
  });

  const initiatePayment = useMutation({
    mutationFn: (payload: { bookingId?: string | null; utilityChargeId?: string | null }) => api.initiatePayment(payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["utility-charges"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setError(null);
      setPaymentIntent(null);
      if (response.iframe) {
        setCheckoutSession({ redirectUrl: response.redirectUrl });
        return;
      }
      window.location.assign(response.redirectUrl);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to initiate payment."),
  });

  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const pendingBookings = bookings.filter((booking) => booking.status === "approved");
  const filteredPayments = role === "vendor"
    ? filterPaymentsByHistory(payments, { status: statusFilter, year: yearFilter, dateFrom, dateTo })
    : payments;
  const paymentHistoryYears = getPaymentHistoryYears(payments);
  const pendingPaymentByBooking = payments.reduce<Record<string, Payment>>((acc, payment) => {
    if (payment.status === "pending" && payment.bookingId) acc[payment.bookingId] = payment;
    return acc;
  }, {});
  const pendingPaymentByUtilityCharge = payments.reduce<Record<string, Payment>>((acc, payment) => {
    if (payment.status === "pending" && payment.utilityChargeId) acc[payment.utilityChargeId] = payment;
    return acc;
  }, {});
  const selectedReceiptPayment = payments.find((payment) => payment.id === selectedReceiptPaymentId) || null;
  const hasHistoryFilters = statusFilter !== "all" || yearFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo);
  const paymentReference = selectedReceiptPayment ? getPaymentReference(selectedReceiptPayment) : null;
  const paymentPurpose = selectedReceiptPayment ? getPaymentPurpose(selectedReceiptPayment) : null;
  const paymentMessage = receiptQuery.data?.receipt.message || selectedReceiptPayment?.receiptMessage || "Receipt details are not available.";
  const paymentReceiptId = receiptQuery.data?.receipt.receiptId || selectedReceiptPayment?.receiptId || "Pending receipt generation";
  const paymentTransactionId = receiptQuery.data?.receipt.transactionId || selectedReceiptPayment?.transactionId || "Awaiting confirmation";
  const paymentAmount = receiptQuery.data?.receipt.amount || selectedReceiptPayment?.amount || 0;
  const paymentCompletedAt = receiptQuery.data?.receipt.createdAt || selectedReceiptPayment?.completedAt || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "vendor" ? "Track bookings, utilities, receipts, and full payment evidence from one place." : "Track payment records and payment status."}
        </p>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {role === "vendor" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Approved Bookings</p><p className="mt-1 text-xl font-bold font-heading">{pendingBookings.length}</p></CardContent></Card>
            <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Utility Charges</p><p className="mt-1 text-xl font-bold font-heading">{utilityCharges.length}</p></CardContent></Card>
            <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Payments</p><p className="mt-1 text-xl font-bold font-heading">{payments.filter((payment) => payment.status === "pending").length}</p></CardContent></Card>
            <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed Payments</p><p className="mt-1 text-xl font-bold font-heading">{payments.filter((payment) => payment.status === "completed").length}</p></CardContent></Card>
          </div>

          <Card className="card-warm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-heading">Approved Booking Payments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingBookings.length === 0 ? <p className="text-sm text-muted-foreground">No approved bookings are currently awaiting payment.</p> : pendingBookings.map((booking) => {
                const pendingPayment = pendingPaymentByBooking[booking.id];
                return (
                  <div key={booking.id} className="rounded-lg bg-muted/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="font-medium text-sm">{booking.stallName}</p><p className="text-xs text-muted-foreground">{booking.startDate} to {booking.endDate} - UGX {booking.amount.toLocaleString()}</p></div>
                      <div className="flex items-center gap-2">
                        {pendingPayment && <StatusBadge status="pending" label="Pending" />}
                        <Button onClick={() => { setPaymentIntent({ title: booking.stallName, subtitle: `${booking.startDate} to ${booking.endDate}`, amount: booking.amount, payload: { bookingId: booking.id } }); setError(null); }} disabled={Boolean(pendingPayment)}>
                          <Wallet className="mr-1 h-4 w-4" />
                          {pendingPayment ? "Awaiting Confirmation" : "Pay Now"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="card-warm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-heading">Utility Charges</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {utilityCharges.length === 0 ? <p className="text-sm text-muted-foreground">No utility charges have been assigned to your account yet.</p> : utilityCharges.map((charge) => {
                const pendingPayment = pendingPaymentByUtilityCharge[charge.id];
                const canPay = charge.status === "unpaid" || charge.status === "overdue";
                const canViewReceipt = charge.status === "paid" && Boolean(charge.latestPaymentId);
                const actionLabel = pendingPayment || charge.status === "pending" ? "Awaiting Confirmation" : charge.paymentCount > 0 ? "Retry Payment" : "Pay Utility";
                return (
                  <div key={charge.id} className="rounded-xl border border-border/70 bg-background/80 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div><p className="font-medium">{getUtilityChargeTitle(charge)}</p><p className="mt-1 text-xs text-muted-foreground">{utilityTypeLabels[charge.utilityType]} - {charge.billingPeriod}{charge.stallName ? ` - ${charge.stallName}` : ""}</p></div>
                      <div className="flex items-center gap-2"><StatusBadge status={charge.status} label={getUtilityStatusLabel(charge.status)} /><span className="text-sm font-semibold">UGX {charge.amount.toLocaleString()}</span></div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <EvidenceField label="Due Date" value={formatDate(charge.dueDate)} />
                      <EvidenceField label="Calculation" value={getUtilityCalculationSummary(charge)} />
                      <EvidenceField label="Latest Reference" value={charge.latestPaymentReference || "Awaiting payment reference"} mono={Boolean(charge.latestPaymentReference)} />
                      <EvidenceField label="Paid At" value={formatDateTime(charge.paidAt, "Awaiting payment")} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canPay && <Button onClick={() => { setPaymentIntent({ title: getUtilityChargeTitle(charge), subtitle: `${utilityTypeLabels[charge.utilityType]} - ${charge.billingPeriod}`, amount: charge.amount, payload: { utilityChargeId: charge.id } }); setError(null); }} disabled={Boolean(pendingPayment)}><Wallet className="mr-1 h-4 w-4" />{actionLabel}</Button>}
                      {!canPay && (pendingPayment || charge.status === "pending") && <Button disabled><Wallet className="mr-1 h-4 w-4" />Awaiting Confirmation</Button>}
                      {canViewReceipt && <Button variant="outline" onClick={() => setSelectedReceiptPaymentId(charge.latestPaymentId!)}><ReceiptText className="mr-1 h-4 w-4" />View Receipt</Button>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div><CardTitle className="text-base font-heading">{role === "vendor" ? "Payment History & Evidence" : "Payment Records"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{role === "vendor" ? "Review what you paid for, when it was confirmed, and keep a clear record of past transactions." : "Review payment evidence, references, and receipt access."}</p></div>
            {role === "vendor" && <p className="text-xs text-muted-foreground">Showing {filteredPayments.length} of {payments.length} record{payments.length === 1 ? "" : "s"}</p>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {role === "vendor" && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><div className="flex items-center gap-2 text-sm font-medium"><CalendarRange className="h-4 w-4 text-info" />Payment history filters</div><p className="mt-1 text-xs text-muted-foreground">Filter by status, year, or a date range to find older payment evidence quickly.</p></div>
                {hasHistoryFilters && <Button variant="outline" size="sm" onClick={() => { setStatusFilter("all"); setYearFilter("all"); setDateFrom(""); setDateTo(""); }}>Clear Filters</Button>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{paymentStatusFilters.map((filter) => <Button key={filter.value} type="button" variant={statusFilter === filter.value ? "secondary" : "outline"} size="sm" onClick={() => setStatusFilter(filter.value)}>{filter.label}</Button>)}</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Year</p><Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger><SelectValue placeholder="All years" /></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{paymentHistoryYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">From</p><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} max={dateTo || undefined} /></div>
                <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">To</p><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} min={dateFrom || undefined} /></div>
              </div>
            </div>
          )}

          {filteredPayments.length === 0 ? <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">{role === "vendor" && hasHistoryFilters ? statusFilter === "cancelled" ? "No cancelled payments are recorded in the system yet." : "No payments matched the selected history filters." : "No payment records are available yet."}</div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {role !== "vendor" && <TableHead>Vendor</TableHead>}
                    <TableHead>Purpose</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      {role !== "vendor" && <TableCell className="font-medium">{payment.vendorName}</TableCell>}
                      <TableCell className="min-w-[240px]"><div><p className="font-medium">{getPaymentPurpose(payment)}</p><div className="mt-2 flex items-center gap-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${paymentMethodMeta[payment.method].className}`}>{paymentMethodMeta[payment.method].label}</span><span className="text-xs text-muted-foreground">{getPaymentChannelDescription(payment)}</span></div></div></TableCell>
                      <TableCell>UGX {payment.amount.toLocaleString()}</TableCell>
                      <TableCell className="min-w-[180px] font-mono text-xs">{getPaymentReference(payment)}</TableCell>
                      <TableCell className="min-w-[180px] font-mono text-xs">{payment.transactionId || "Awaiting confirmation"}</TableCell>
                      <TableCell><StatusBadge status={payment.status} label={getPaymentStatusLabel(payment.status)} /></TableCell>
                      <TableCell className="min-w-[160px] text-sm text-muted-foreground">{formatDateTime(payment.createdAt)}</TableCell>
                      <TableCell className="min-w-[160px] text-sm text-muted-foreground">{formatDateTime(payment.completedAt, "Awaiting confirmation")}</TableCell>
                      <TableCell className="min-w-[190px]">{payment.status === "completed" ? <Button variant="outline" size="sm" onClick={() => setSelectedReceiptPaymentId(payment.id)}><ReceiptText className="mr-1 h-4 w-4" />View Receipt</Button> : <span className="text-xs text-muted-foreground">Available after success</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(paymentIntent)} onOpenChange={(open) => !open && setPaymentIntent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Secure Checkout</DialogTitle></DialogHeader>
          {paymentIntent && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm"><p className="font-medium">{paymentIntent.title}</p><p className="mt-1 text-muted-foreground">{paymentIntent.subtitle}</p><p className="mt-2 text-lg font-bold font-heading">UGX {paymentIntent.amount.toLocaleString()}</p></div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-info" /><div className="space-y-2"><p>Pesapal will open a secure checkout where the customer can complete payment.</p><p>{user?.email ? `The current checkout will use ${user.email} and ${user.phone}.` : "The current checkout will use the phone number attached to the signed-in vendor account."}</p></div></div></div>
              <Button className="w-full" onClick={() => initiatePayment.mutate(paymentIntent.payload)} disabled={initiatePayment.isPending}><ArrowUpRight className="mr-2 h-4 w-4" />{initiatePayment.isPending ? "Opening Checkout..." : "Continue to Pesapal"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(checkoutSession)} onOpenChange={(open) => !open && setCheckoutSession(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="font-heading">Pesapal Checkout</DialogTitle></DialogHeader>
          {checkoutSession && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">Complete the payment in the secure Pesapal frame below. After checkout, Pesapal will return the user to the callback page and the app will verify the final status.</div>
              <iframe title="Pesapal Checkout" src={checkoutSession.redirectUrl} className="h-[640px] w-full rounded-xl border border-border/70 bg-white" />
              <div className="flex justify-end"><a href={checkoutSession.redirectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"><ExternalLink className="h-4 w-4" />Open checkout in a new tab</a></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedReceiptPaymentId)} onOpenChange={(open) => !open && setSelectedReceiptPaymentId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Payment Receipt & Evidence</DialogTitle></DialogHeader>
          {selectedReceiptPayment ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-4"><div><p className="text-xs text-muted-foreground">Receipt ID</p><p className="mt-1 font-medium">{paymentReceiptId}</p></div><StatusBadge status={selectedReceiptPayment.status} label={getPaymentStatusLabel(selectedReceiptPayment.status)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <EvidenceField label="Purpose" value={paymentPurpose || "Payment"} />
                <EvidenceField label="Amount" value={`UGX ${paymentAmount.toLocaleString()}`} />
                <EvidenceField label="Reference" value={paymentReference || "Awaiting reference"} mono />
                <EvidenceField label="Transaction ID" value={paymentTransactionId} mono />
                <EvidenceField label="Created At" value={formatDateTime(selectedReceiptPayment.createdAt)} />
                <EvidenceField label="Completed At" value={formatDateTime(paymentCompletedAt, "Awaiting confirmation")} />
              </div>
              <div className={`whitespace-pre-line rounded-xl border p-4 ${getReceiptMessageClassName(selectedReceiptPayment.status)}`}>{receiptQuery.isError ? "Unable to refresh the receipt from the server. The stored payment record is shown below.\n\n" : ""}{paymentMessage}</div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Select a completed payment to view its receipt.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsPage;
