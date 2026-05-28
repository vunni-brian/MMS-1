import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Download, ReceiptText, ShieldCheck, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { getPaymentPurpose } from "@/lib/payment-history";
import { formatCurrency } from "@/lib/utils";

const PaymentCallbackPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderTrackingId = searchParams.get("OrderTrackingId");
  const merchantReference = searchParams.get("OrderMerchantReference");
  const [countdown, setCountdown] = useState<number | null>(null);

  const returnPath = useMemo(() => {
    if (!user) return "/login";
    if (user.role === "vendor") return "/vendor/payments";
    if (user.role === "manager") return "/manager/payments";
    return `/${user.role}`;
  }, [user]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payments", "pesapal-callback", orderTrackingId, merchantReference],
    enabled: Boolean(orderTrackingId && merchantReference),
    queryFn: () => api.getPesapalCallbackStatus(orderTrackingId!, merchantReference!),
  });

  const payment = data?.payment || null;
  const paymentStatus = payment?.status || "pending";
  const isSuccess = paymentStatus === "completed";
  const isFailed = paymentStatus === "failed" || Boolean(error);
  const StatusIcon = isSuccess ? CheckCircle2 : isFailed ? XCircle : Clock3;

  useEffect(() => {
    if (paymentStatus !== "completed") return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          navigate(returnPath);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentStatus, navigate, returnPath]);

  const bodyMessage = !orderTrackingId || !merchantReference
    ? "Missing callback parameters. Start the payment again from the payments page."
    : isLoading
      ? "Checking the latest payment status..."
      : error
        ? error instanceof Error ? error.message : "Unable to confirm the payment status."
        : isSuccess
          ? "Your payment has been received successfully."
          : paymentStatus === "failed"
            ? "This payment was not verified."
            : "The transaction is still pending.";

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-bold font-heading">WMMS</span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to={returnPath}>Dashboard</Link>
        </Button>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-82px)] max-w-5xl items-center justify-center py-8">
        <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 text-center shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)] sm:p-8">
          <div
            className={
              isSuccess
                ? "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground"
                : isFailed
                  ? "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  : "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning text-warning-foreground"
            }
          >
            <StatusIcon className="h-11 w-11" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase text-primary">Payment Result</p>
          <h1 className="mt-2 text-2xl font-bold font-heading">
            {isSuccess ? "Payment Successful" : isFailed ? "Payment Needs Review" : "Payment Pending"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            {bodyMessage}
            {countdown !== null && <span className="ml-1 font-semibold text-slate-950">Redirecting in {countdown}s.</span>}
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold font-heading">Receipt Summary</p>
              </div>
              <StatusBadge status={paymentStatus} context="payment" />
            </div>

            <dl className="grid gap-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Receipt Number</dt>
                <dd className="break-all text-right font-medium">{payment?.receiptId || payment?.providerReference || merchantReference || "Unavailable"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Amount Paid</dt>
                <dd className="font-medium">{payment ? formatCurrency(payment.amount) : "Unavailable"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Purpose</dt>
                <dd className="text-right font-medium">{payment ? getPaymentPurpose(payment) : "Unavailable"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Transaction ID</dt>
                <dd className="break-all text-right font-mono text-xs">{orderTrackingId || "Unavailable"}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="gap-2" disabled={!payment}>
              <Download className="h-4 w-4" />
              Download Receipt
            </Button>
            <Button asChild>
              <Link to={returnPath}>Go to Dashboard</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PaymentCallbackPage;
