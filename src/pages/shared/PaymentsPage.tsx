import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CreditCard, Eye, FileText, Landmark, Smartphone, Upload, XCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { getPaymentPurpose, getPaymentReference } from "@/lib/payment-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/console/ConsolePage";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import type { Payment, PaymentStatus } from "@/types";

type PaymentMethod = "mobile" | "card" | "bank";

interface PayableItem {
 stall: string;
 paymentType: string;
 period: string;
 amount: number;
 payload: {
 bookingId?: string | null;
 utilityChargeId?: string | null;
 penaltyId?: string | null;
 };
}

const methodOptions: Array<{ id: PaymentMethod; label: string; icon: typeof Smartphone; detail: string }> = [
 { id: "mobile", label: "Mobile Money", icon: Smartphone, detail: "MTN and Airtel" },
 { id: "card", label: "Credit / Debit Card", icon: CreditCard, detail: "Visa or Mastercard" },
 { id: "bank", label: "Bank Transfer", icon: Landmark, detail: "Manual bank transfer" },
];

const currentPeriod = () => {
 const now = new Date();
 return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);
};
const formatDate = (value: string | null) =>
 value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "Not recorded";

const ReceiptReviewRow = ({
 payment,
 onViewReceipt,
 onVerify,
 isBusy,
}: {
 payment: Payment;
 onViewReceipt: (payment: Payment) => void;
 onVerify: (payment: Payment, status: "verified" | "rejected") => void;
 isBusy: boolean;
}) => (
 <div className="rounded-lg border border-slate-200 bg-white p-4">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
 <div className="min-w-0 space-y-2">
 <div className="flex flex-wrap items-center gap-2">
 <p className="font-semibold text-slate-950">{payment.vendorName}</p>
 <StatusBadge status={payment.status} context="payment" />
 <Badge variant="secondary">{payment.method === "receipt" ? "Bank receipt" : payment.method}</Badge>
 </div>
 <p className="text-sm text-slate-600">{getPaymentPurpose(payment)}</p>
 <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
 <span>
 <strong className="block text-slate-700">Amount</strong>
 {formatCurrency(payment.amount)}
 </span>
 <span>
 <strong className="block text-slate-700">Reference</strong>
 {getPaymentReference(payment)}
 </span>
 <span>
 <strong className="block text-slate-700">Submitted</strong>
 {formatDate(payment.createdAt)}
 </span>
 <span>
 <strong className="block text-slate-700">File</strong>
 {payment.receiptFileName || "No file"}
 </span>
 </div>
 </div>
 <div className="flex shrink-0 flex-wrap gap-2">
 {payment.receiptFilePath ? (
 <Button variant="outline" size="sm" onClick={() => onViewReceipt(payment)}>
 <Eye className="mr-2 h-4 w-4" />
 View
 </Button>
 ) : null}
 {payment.status === "pending" && payment.method === "receipt" ? (
 <>
 <Button size="sm" disabled={isBusy} onClick={() => onVerify(payment, "verified")}>
 <CheckCircle2 className="mr-2 h-4 w-4" />
 Approve
 </Button>
 <Button variant="outline" size="sm" disabled={isBusy} onClick={() => onVerify(payment, "rejected")}>
 <XCircle className="mr-2 h-4 w-4" />
 Reject
 </Button>
 </>
 ) : null}
 </div>
 </div>
 </div>
);

const PaymentsPage = () => {
 const { role } = useAuth();
 const queryClient = useQueryClient();
 const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("mobile");
 const [receiptNumber, setReceiptNumber] = useState("");
 const [receiptNote, setReceiptNote] = useState("");
 const [receiptFile, setReceiptFile] = useState<File | null>(null);

 const bookingsQuery = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
 const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments() });
 const chargeTypesQuery = useQuery({ queryKey: ["charge-types", "payments-page"], queryFn: () => api.getChargeTypes() });
 const utilityChargesQuery = useQuery({
 queryKey: ["utility-charges", "payment-page"],
 queryFn: () => api.getUtilityCharges(),
 enabled: role === "vendor",
 });
 const penaltiesQuery = useQuery({
 queryKey: ["penalties", "payment-page"],
 queryFn: () => api.getPenalties(),
 enabled: role === "vendor",
 });

 const isLoading =
 bookingsQuery.isPending ||
 paymentsQuery.isPending ||
 (role === "vendor" && (utilityChargesQuery.isPending || penaltiesQuery.isPending));

 const isError =
 bookingsQuery.isError ||
 paymentsQuery.isError ||
 (role === "vendor" && (utilityChargesQuery.isError || penaltiesQuery.isError));

 const payable = useMemo<PayableItem | null>(() => {
 const bookings = bookingsQuery.data?.bookings || [];
 const approvedBooking = bookings.find((booking) => booking.status === "approved" && booking.amount > 0);
 if (approvedBooking) {
 return {
 stall: approvedBooking.stallName,
 paymentType: "Stall Rent",
 period: currentPeriod(),
 amount: approvedBooking.amount,
 payload: { bookingId: approvedBooking.id },
 };
 }

 const utility = (utilityChargesQuery.data?.utilityCharges || []).find((charge) =>
 ["unpaid", "overdue"].includes(charge.status) && charge.amount > 0,
 );
 if (utility) {
 return {
 stall: utility.stallName || "Assigned Stall",
 paymentType: utility.description || "Utility Fee",
 period: utility.billingPeriod,
 amount: utility.amount,
 payload: { utilityChargeId: utility.id },
 };
 }

 const penalty = (penaltiesQuery.data?.penalties || []).find((item) => item.status === "unpaid" && item.amount > 0);
 if (penalty) {
 return {
 stall: "Assigned Stall",
 paymentType: "Penalty",
 period: currentPeriod(),
 amount: penalty.amount,
 payload: { penaltyId: penalty.id },
 };
 }

 return null;
 }, [bookingsQuery.data?.bookings, penaltiesQuery.data?.penalties, utilityChargesQuery.data?.utilityCharges]);

 const hasRealPayable = payable !== null;
 const payments = (paymentsQuery.data?.payments || []).filter((payment) => payment.amount > 0);
 const pendingReceiptPayments = payments.filter((payment) => payment.method === "receipt" && payment.status === "pending");
 const recentPayments = payments.slice(0, 5);
 const paymentGateway = (chargeTypesQuery.data?.chargeTypes || []).find((chargeType) => chargeType.name === "payment_gateway");
 const onlinePaymentsPaused = chargeTypesQuery.isError || paymentGateway?.isEnabled === false;

 useEffect(() => {
 if (onlinePaymentsPaused) {
 setSelectedMethod("bank");
 }
 }, [onlinePaymentsPaused]);

 const initiatePayment = useMutation({
 mutationFn: () => api.initiateGatewayPayment(payable.payload),
 onSuccess: async (response) => {
 await queryClient.invalidateQueries({ queryKey: ["payments"] });
 toast.success("Payment started", { description: response.message || "Continue with the payment provider." });
 if (response.redirectUrl) {
 window.location.href = response.redirectUrl;
 }
 },
 onError: (error) => {
 toast.error("Payment could not start", {
 description: error instanceof ApiError ? error.message : "Unable to initiate this payment.",
 });
 },
 });

 const uploadReceipt = useMutation({
 mutationFn: () =>
 api.initiatePayment({
 ...payable.payload,
 receiptNumber,
 receiptNote,
 receiptFile,
 }),
 onSuccess: async (response) => {
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: ["payments"] }),
 queryClient.invalidateQueries({ queryKey: ["bookings"] }),
 queryClient.invalidateQueries({ queryKey: ["utility-charges"] }),
 queryClient.invalidateQueries({ queryKey: ["penalties"] }),
 ]);
 setReceiptNumber("");
 setReceiptNote("");
 setReceiptFile(null);
 toast.success("Receipt submitted", { description: response.message || "Your bank receipt is awaiting manager approval." });
 },
 onError: (error) => {
 toast.error("Receipt could not be submitted", {
 description: error instanceof ApiError ? error.message : "Upload a valid receipt and try again.",
 });
 },
 });

 const verifyReceipt = useMutation({
 mutationFn: ({ payment, status }: { payment: Payment; status: "verified" | "rejected" }) =>
 api.verifyPaymentReceipt(payment.id, {
 status,
 reason: status === "rejected" ? "Receipt rejected by manager review." : null,
 }),
 onSuccess: async (_, variables) => {
 await queryClient.invalidateQueries({ queryKey: ["payments"] });
 toast.success(variables.status === "verified" ? "Receipt approved" : "Receipt rejected");
 },
 onError: (error) => {
 toast.error("Receipt review failed", {
 description: error instanceof ApiError ? error.message : "Unable to update this receipt.",
 });
 },
 });

 const viewReceipt = async (payment: Payment) => {
 try {
 const url = await api.getReceiptFileUrl(payment.id);
 window.open(url, "_blank", "noopener,noreferrer");
 } catch (error) {
 toast.error("Receipt could not be opened", {
 description: error instanceof ApiError ? error.message : "Unable to load the uploaded file.",
 });
 }
 };

 if (isError) {
 return (
 <PageLayout>
 <Alert variant="destructive" className="max-w-xl">
 <AlertTitle>Error loading payments</AlertTitle>
 <AlertDescription>We could not reach the server to load payment details.</AlertDescription>
 </Alert>
 </PageLayout>
 );
 }

 if (isLoading) {
 return (
 <PageLayout>
 <LoadingState rows={4} itemClassName="h-28 rounded-lg" />
 </PageLayout>
 );
 }

 if (role !== "vendor") {
 return (
 <PageLayout>
 <PageHeader
 eyebrow="Payments > Receipt Review"
 title="Payment Review"
 subtitle="Review uploaded bank receipts, open the submitted proof, and approve payments after reconciliation."
 actions={<Badge variant={pendingReceiptPayments.length ? "warning" : "success"}>{pendingReceiptPayments.length} pending</Badge>}
 />

 {onlinePaymentsPaused ? (
 <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
 <AlertTriangle className="h-4 w-4" />
 <AlertTitle>Online payments are temporarily unavailable</AlertTitle>
 <AlertDescription>Managers can still review uploaded bank transfer receipts.</AlertDescription>
 </Alert>
 ) : null}

 <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
 <Card>
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Bank Receipt Queue</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
  {pendingReceiptPayments.length === 0 ? (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
  <FileText className="mx-auto h-8 w-8 text-slate-400" />
  <p className="mt-3 font-semibold text-slate-900">No receipts awaiting approval</p>
  <p className="mt-1 text-sm text-slate-500">Uploaded bank receipts will appear here for manager review.</p>
  </div>
  ) : (
  <div className="space-y-3">
  {pendingReceiptPayments.map((payment) => (
  <ReceiptReviewRow
  key={payment.id}
  payment={payment}
  onViewReceipt={viewReceipt}
  onVerify={(item, status) => verifyReceipt.mutate({ payment: item, status })}
  isBusy={verifyReceipt.isPending}
  />
  ))}
  </div>
  )}
    </CardContent>
  </Card>

 <Card>
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Recent Payments</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
  <div className="space-y-3">
  {recentPayments.map((payment) => (
  <div key={payment.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
  <div className="flex items-center justify-between gap-3">
  <p className="text-sm font-semibold text-slate-900">{payment.vendorName}</p>
  <StatusBadge status={payment.status} context="payment" />
  </div>
  <p className="mt-1 text-xs text-slate-500">{getPaymentPurpose(payment)}</p>
  <p className="mt-2 text-sm font-bold text-slate-950">{formatCurrency(payment.amount)}</p>
  </div>
  ))}
  </div>
    </CardContent>
  </Card>
 </div>
 </PageLayout>
 );
 }

 return (
 <PageLayout>
 <PageHeader
 eyebrow="Payments > Make Payment"
 title="Make Payment"
 subtitle="Pay online or upload a bank receipt for manager approval."
 />

 {onlinePaymentsPaused ? (
 <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
 <AlertTriangle className="h-4 w-4" />
 <AlertTitle>Online payments are temporarily unavailable</AlertTitle>
 <AlertDescription>Please use Bank Transfer or pay at the market office while provider collections are paused.</AlertDescription>
 </Alert>
 ) : null}

  {!payable ? (
  <Card>
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Payment Details</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
  <p className="mt-3 font-semibold text-slate-900">No payments due</p>
  <p className="mt-1 text-sm text-slate-500">
  You have no outstanding stall fees, utility charges, or penalties at this time.
  </p>
  </div>
    </CardContent>
  </Card>
  ) : (
 <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
  <Card>
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Payment Details</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
  <div className="space-y-5 text-sm">
  <div>
  <p className="text-xs font-semibold text-slate-500">Stall</p>
  <p className="mt-1 font-bold text-slate-900">{payable.stall}</p>
  </div>
  <div>
  <p className="text-xs font-semibold text-slate-500">Payment Type</p>
  <p className="mt-1 font-bold text-slate-900">{payable.paymentType}</p>
  </div>
  <div>
  <p className="text-xs font-semibold text-slate-500">Period</p>
  <p className="mt-1 font-bold text-slate-900">{payable.period}</p>
  </div>
  <div>
  <p className="text-xs font-semibold text-slate-500">Amount</p>
  <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(payable.amount)}</p>
  </div>
  </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Select Payment Method</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
 <div className="space-y-3">
 {methodOptions.map((method) => {
 const Icon = method.icon;
 const selected = selectedMethod === method.id;
 const disabled = onlinePaymentsPaused && method.id !== "bank";

 return (
 <button
 key={method.id}
 type="button"
 disabled={disabled}
 title={disabled ? "Online payments temporarily offline" : undefined}
 onClick={() => {
 if (!disabled) setSelectedMethod(method.id);
 }}
 className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
 disabled
 ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
 : selected
 ? "border-emerald-300 bg-emerald-50/70"
 : "border-slate-200 bg-white hover:border-slate-300"
 }`}
 >
 <span className="flex min-w-0 items-center gap-3">
 <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-emerald-700 bg-emerald-700" : "border-slate-300"}`}>
 {selected ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : null}
 </span>
 <Icon className="h-4 w-4 text-slate-500" />
 <span>
 <span className="block text-sm font-semibold text-slate-900">{method.label}</span>
 <span className="text-xs text-slate-500">{method.detail}</span>
 </span>
 </span>
 {disabled ? (
 <Badge variant="warning">Unavailable</Badge>
 ) : method.id === "mobile" ? (
 <span className="flex shrink-0 gap-1">
 <Badge variant="secondary">MTN</Badge>
 <Badge variant="error">airtel</Badge>
 </span>
 ) : null}
 </button>
 );
 })}
 </div>

 {selectedMethod === "bank" ? (
 <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
 <div className="mb-4 flex items-start gap-3">
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
 <Upload className="h-4 w-4" />
 </span>
 <div>
 <p className="text-sm font-semibold text-slate-900">Upload bank receipt</p>
 <p className="text-xs text-slate-500">Attach proof of transfer for manager approval before the payment is marked complete.</p>
 </div>
 </div>
 <div className="grid gap-3 md:grid-cols-2">
 <div className="space-y-1.5">
 <Label htmlFor="receipt-number">Receipt or transaction reference</Label>
 <Input
 id="receipt-number"
 value={receiptNumber}
 onChange={(event) => setReceiptNumber(event.target.value)}
 placeholder="BANK-TRX-2026-001"
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="receipt-file">Receipt file</Label>
 <Input
 id="receipt-file"
 type="file"
 accept="image/*,.pdf"
 onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
 />
 </div>
 <div className="space-y-1.5 md:col-span-2">
 <Label htmlFor="receipt-note">Note to manager</Label>
 <Textarea
 id="receipt-note"
 value={receiptNote}
 onChange={(event) => setReceiptNote(event.target.value)}
 placeholder="Paid through bank transfer and attached the deposit slip."
 />
 </div>
 </div>
 <Button
 className="mt-4 h-11 w-full"
 disabled={uploadReceipt.isPending}
 onClick={() => {
 if (!hasRealPayable) {
 toast.info("No live payable item is currently available.");
 return;
 }
 if (!receiptFile) {
 toast.error("Receipt file required", { description: "Upload a bank receipt before submitting." });
 return;
 }
 uploadReceipt.mutate();
 }}
 >
 {uploadReceipt.isPending ? "Submitting Receipt..." : "Submit Receipt for Approval"}
 </Button>
 </div>
 ) : (
 <Button
 className="mt-5 h-11 w-full"
 disabled={initiatePayment.isPending}
 onClick={() => {
 if (!hasRealPayable) {
 toast.info("No live payable item is currently available.");
 return;
 }
 initiatePayment.mutate();
 }}
 >
 {initiatePayment.isPending ? "Starting Payment..." : "Proceed to Pay"}
 </Button>
 )}
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Payment Summary</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
 <div className="space-y-4 text-sm">
 <div className="flex items-center justify-between gap-3">
 <span className="text-slate-500">Amount</span>
 <span className="font-bold text-slate-900">{formatCurrency(payable.amount)}</span>
 </div>
 <div className="flex items-center justify-between gap-3">
 <span className="text-slate-500">Charges</span>
 <span className="font-bold text-slate-900">{formatCurrency(0)}</span>
 </div>
 <div className="border-t border-slate-100 pt-4">
 <div className="flex items-center justify-between gap-3">
 <span className="font-semibold text-slate-900">Total Amount</span>
 <span className="text-lg font-bold text-slate-900">{formatCurrency(payable.amount)}</span>
 </div>
 </div>
 <div className="pt-8 text-center">
 <p className="text-[11px] text-slate-400">
 {onlinePaymentsPaused ? "Bank transfer receipts accepted. Online payments paused." : "Secure payments powered by"}
 </p>
 {!onlinePaymentsPaused ? (
 <p className="mt-1 text-2xl font-bold tracking-normal text-emerald-700">
 pesa<span className="text-red-500">pal</span>
 </p>
 ) : null}
 </div>
 </div>
    </CardContent>
  </Card>
  </div>
  )} {/* end payable conditional */}

  <Card className="mt-4">
    <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <CardTitle className="text-base font-medium">Recent Payment Activity</CardTitle>
    </CardHeader>
    <CardContent className="p-4">
 <div className="grid gap-3 lg:grid-cols-2">
 {recentPayments.length === 0 ? (
 <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
 Payment history will appear after you start a payment or upload a receipt.
 </div>
 ) : (
 recentPayments.map((payment) => (
 <div key={payment.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
 <div className="min-w-0">
 <p className="font-semibold text-slate-950">{getPaymentPurpose(payment)}</p>
 <p className="mt-1 text-xs text-slate-500">{getPaymentReference(payment)}</p>
 {payment.method === "receipt" ? <p className="mt-1 text-xs text-slate-500">{payment.receiptMessage}</p> : null}
 </div>
 <div className="shrink-0 text-right">
 <p className="text-sm font-bold text-slate-950">{formatCurrency(payment.amount)}</p>
 <StatusBadge status={payment.status} context="payment" className="mt-2" />
 </div>
 </div>
 ))
 )}
  </div>
    </CardContent>
  </Card>
  </PageLayout>
  );
};

export default PaymentsPage;
