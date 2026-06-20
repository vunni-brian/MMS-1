import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
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

const currentPeriod = () => {
 const now = new Date();
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(now);
};

const formatDate = (value: string | null, fallback = "Not recorded") =>
 value ? new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : fallback;

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
}) => {
 const { t } = useTranslation();
 return (
 <div className="rounded-lg border border-slate-200 bg-white p-4">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
 <div className="min-w-0 space-y-2">
 <div className="flex flex-wrap items-center gap-2">
 <p className="font-semibold text-slate-950">{payment.vendorName}</p>
 <StatusBadge status={payment.status} context="payment" />
 <Badge variant="secondary">{payment.method === "receipt" ? t("payments:bankReceipt") : payment.method}</Badge>
 </div>
 <p className="text-sm text-slate-600">{getPaymentPurpose(payment)}</p>
 <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
 <span>
 <strong className="block text-slate-700">{t("common:amount")}</strong>
 {formatCurrency(payment.amount)}
 </span>
 <span>
 <strong className="block text-slate-700">{t("payments:reference")}</strong>
 {getPaymentReference(payment)}
 </span>
 <span>
 <strong className="block text-slate-700">{t("payments:submitted")}</strong>
 {formatDate(payment.createdAt, t("common:notRecorded"))}
 </span>
 <span>
 <strong className="block text-slate-700">{t("payments:file")}</strong>
 {payment.receiptFileName || t("common:noFile")}
 </span>
 </div>
 </div>
 <div className="flex shrink-0 flex-wrap gap-2">
 {payment.receiptFilePath ? (
 <Button variant="outline" size="sm" onClick={() => onViewReceipt(payment)}>
 <Eye className="mr-2 h-4 w-4" />
 {t("common:view")}
 </Button>
 ) : null}
 {payment.status === "pending" && payment.method === "receipt" ? (
 <>
 <Button size="sm" disabled={isBusy} onClick={() => onVerify(payment, "verified")}>
 <CheckCircle2 className="mr-2 h-4 w-4" />
 {t("common:approve")}
 </Button>
 <Button variant="outline" size="sm" disabled={isBusy} onClick={() => onVerify(payment, "rejected")}>
 <XCircle className="mr-2 h-4 w-4" />
 {t("common:reject")}
 </Button>
 </>
 ) : null}
 </div>
 </div>
 </div>
 );
};

const PaymentsPage = () => {
 const { t } = useTranslation();
 const { role } = useAuth();
 const queryClient = useQueryClient();
 const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("mobile");
 const [receiptNumber, setReceiptNumber] = useState("");
 const [receiptNote, setReceiptNote] = useState("");
 const [receiptFile, setReceiptFile] = useState<File | null>(null);

 const methodOptions: Array<{ id: PaymentMethod; labelKey: string; detailKey: string; icon: typeof Smartphone }> = [
  { id: "mobile", labelKey: "payments:mobileMoney", detailKey: "payments:mobileMoneyDesc", icon: Smartphone },
  { id: "card", labelKey: "payments:creditCard", detailKey: "payments:creditCardDesc", icon: CreditCard },
  { id: "bank", labelKey: "payments:bankTransfer", detailKey: "payments:bankTransferDesc", icon: Landmark },
 ];

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
  toast.success(t("payments:paymentStarted"), { description: response.message || t("payments:paymentStartedDesc") });
  if (response.redirectUrl) {
  window.location.href = response.redirectUrl;
  }
  },
  onError: (error) => {
  toast.error(t("payments:paymentNotStarted"), {
  description: error instanceof ApiError ? error.message : t("payments:paymentError"),
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
  toast.success(t("payments:receiptSubmitted"), { description: response.message || t("payments:receiptSubmittedDesc") });
  },
  onError: (error) => {
  toast.error(t("payments:receiptNotSubmitted"), {
  description: error instanceof ApiError ? error.message : t("payments:receiptError"),
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
  toast.success(variables.status === "verified" ? t("payments:receiptApproved") : t("payments:receiptRejected"));
  },
  onError: (error) => {
  toast.error(t("payments:receiptReviewFailed"), {
  description: error instanceof ApiError ? error.message : t("payments:receiptUpdateError"),
  });
  },
 });

 const viewReceipt = async (payment: Payment) => {
  try {
  const url = await api.getReceiptFileUrl(payment.id);
  window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
  toast.error(t("payments:receiptOpenError"), {
  description: error instanceof ApiError ? error.message : t("payments:receiptLoadError"),
  });
  }
 };

 if (isError) {
  return (
  <PageLayout>
  <Alert variant="destructive" className="max-w-xl">
  <AlertTitle>{t("common:error")}</AlertTitle>
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
  eyebrow={t("payments:managerEyebrow")}
  title={t("payments:managerTitle")}
  description={t("payments:managerSubtitle")}
  actions={<Badge variant={pendingReceiptPayments.length ? "warning" : "success"}>{t("payments:pendingBadge", { n: pendingReceiptPayments.length })}</Badge>}
  />

  {onlinePaymentsPaused ? (
  <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>{t("payments:onlinePaymentsUnavailable")}</AlertTitle>
  <AlertDescription>{t("payments:onlinePaymentsDesc")}</AlertDescription>
  </Alert>
  ) : null}

  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
  <Card>
     <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
       <CardTitle className="text-base font-medium">{t("payments:bankReceiptQueue")}</CardTitle>
     </CardHeader>
     <CardContent className="p-4">
  {pendingReceiptPayments.length === 0 ? (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
  <FileText className="mx-auto h-8 w-8 text-slate-400" />
  <p className="mt-3 font-semibold text-slate-900">{t("payments:noReceipts")}</p>
  <p className="mt-1 text-sm text-slate-500">{t("payments:noReceiptsDesc")}</p>
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
       <CardTitle className="text-base font-medium">{t("payments:recentPayments")}</CardTitle>
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
 eyebrow={t("payments:vendorEyebrow")}
 title={t("payments:vendorTitle")}
  description={t("payments:vendorSubtitle")}
 />

 {onlinePaymentsPaused ? (
 <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
 <AlertTriangle className="h-4 w-4" />
 <AlertTitle>{t("payments:vendorOnlineUnavailable")}</AlertTitle>
 <AlertDescription>{t("payments:vendorOnlineDesc")}</AlertDescription>
 </Alert>
 ) : null}

   {!payable ? (
   <Card>
     <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
       <CardTitle className="text-base font-medium">{t("payments:paymentDetails")}</CardTitle>
     </CardHeader>
     <CardContent className="p-4">
   <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
   <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
   <p className="mt-3 font-semibold text-slate-900">{t("payments:noDues")}</p>
   <p className="mt-1 text-sm text-slate-500">
   {t("payments:noDuesDesc")}
   </p>
   </div>
     </CardContent>
   </Card>
   ) : (
  <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
   <Card>
     <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
       <CardTitle className="text-base font-medium">{t("payments:paymentDetails")}</CardTitle>
     </CardHeader>
     <CardContent className="p-4">
   <div className="space-y-5 text-sm">
   <div>
   <p className="text-xs font-semibold text-slate-500">{t("payments:stall")}</p>
   <p className="mt-1 font-bold text-slate-900">{payable.stall}</p>
   </div>
   <div>
   <p className="text-xs font-semibold text-slate-500">{t("payments:paymentType")}</p>
   <p className="mt-1 font-bold text-slate-900">{payable.paymentType}</p>
   </div>
   <div>
   <p className="text-xs font-semibold text-slate-500">{t("payments:period")}</p>
   <p className="mt-1 font-bold text-slate-900">{payable.period}</p>
   </div>
   <div>
   <p className="text-xs font-semibold text-slate-500">{t("common:amount")}</p>
   <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(payable.amount)}</p>
   </div>
   </div>
     </CardContent>
   </Card>

   <Card>
     <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
       <CardTitle className="text-base font-medium">{t("payments:selectMethod")}</CardTitle>
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
  title={disabled ? t("payments:onlineOffline") : undefined}
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
  <span className="block text-sm font-semibold text-slate-900">{t(method.labelKey)}</span>
  <span className="text-xs text-slate-500">{t(method.detailKey)}</span>
  </span>
  </span>
  {disabled ? (
  <Badge variant="warning">{t("payments:unavailable")}</Badge>
  ) : method.id === "mobile" ? (
  <span className="flex shrink-0 gap-1">
  <Badge variant="secondary">{t("payments:mtn")}</Badge>
  <Badge variant="error">{t("payments:airtel")}</Badge>
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
  <p className="text-sm font-semibold text-slate-900">{t("payments:uploadReceipt")}</p>
  <p className="text-xs text-slate-500">{t("payments:uploadReceiptDesc")}</p>
  </div>
  </div>
  <div className="grid gap-3 md:grid-cols-2">
  <div className="space-y-1.5">
  <Label htmlFor="receipt-number">{t("payments:transactionRef")}</Label>
  <Input
  id="receipt-number"
  value={receiptNumber}
  onChange={(event) => setReceiptNumber(event.target.value)}
  placeholder={t("payments:transactionRefPlaceholder")}
  />
  </div>
  <div className="space-y-1.5">
  <Label htmlFor="receipt-file">{t("payments:receiptFile")}</Label>
  <Input
  id="receipt-file"
  type="file"
  accept="image/*,.pdf"
  onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
  />
  </div>
  <div className="space-y-1.5 md:col-span-2">
  <Label htmlFor="receipt-note">{t("payments:noteToManager")}</Label>
  <Textarea
  id="receipt-note"
  value={receiptNote}
  onChange={(event) => setReceiptNote(event.target.value)}
  placeholder={t("payments:notePlaceholder")}
  />
  </div>
  </div>
  <Button
  className="mt-4 h-11 w-full"
  disabled={uploadReceipt.isPending}
  onClick={() => {
  if (!hasRealPayable) {
  toast.info(t("payments:noPayableItem"));
  return;
  }
  if (!receiptFile) {
  toast.error(t("payments:receiptRequired"), { description: t("payments:receiptRequiredDesc") });
  return;
  }
  uploadReceipt.mutate();
  }}
  >
  {uploadReceipt.isPending ? t("payments:submittingReceipt") : t("payments:submitReceipt")}
  </Button>
  </div>
  ) : (
  <Button
  className="mt-5 h-11 w-full"
  disabled={initiatePayment.isPending}
  onClick={() => {
  if (!hasRealPayable) {
  toast.info(t("payments:noPayableItem"));
  return;
  }
  initiatePayment.mutate();
  }}
  >
  {initiatePayment.isPending ? t("payments:startingPayment") : t("payments:proceedToPay")}
  </Button>
  )}
     </CardContent>
   </Card>

   <Card>
     <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
       <CardTitle className="text-base font-medium">{t("payments:paymentSummary")}</CardTitle>
     </CardHeader>
     <CardContent className="p-4">
  <div className="space-y-4 text-sm">
  <div className="flex items-center justify-between gap-3">
  <span className="text-slate-500">{t("common:amount")}</span>
  <span className="font-bold text-slate-900">{formatCurrency(payable.amount)}</span>
  </div>
  <div className="flex items-center justify-between gap-3">
  <span className="text-slate-500">{t("payments:charges")}</span>
  <span className="font-bold text-slate-900">{formatCurrency(0)}</span>
  </div>
  <div className="border-t border-slate-100 pt-4">
  <div className="flex items-center justify-between gap-3">
  <span className="font-semibold text-slate-900">{t("payments:totalAmount")}</span>
  <span className="text-lg font-bold text-slate-900">{formatCurrency(payable.amount)}</span>
  </div>
  </div>
  <div className="pt-8 text-center">
  <p className="text-[11px] text-slate-400">
  {onlinePaymentsPaused ? t("payments:bankTransfersAccepted") : t("payments:securePaymentsBy")}
  </p>
  {!onlinePaymentsPaused ? (
  <p className="mt-1 text-2xl font-bold tracking-normal text-emerald-700">
  {t("payments:pesapal")}
  </p>
  ) : null}
  </div>
  </div>
     </CardContent>
   </Card>
   </div>
   )}

   <Card className="mt-4">
     <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
       <CardTitle className="text-base font-medium">{t("payments:recentActivity")}</CardTitle>
     </CardHeader>
     <CardContent className="p-4">
  <div className="grid gap-3 lg:grid-cols-2">
  {recentPayments.length === 0 ? (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
  {t("payments:noActivity")}
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
