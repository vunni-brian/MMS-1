import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Landmark, ReceiptText, XCircle } from "lucide-react";
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
 const missingCallbackParams = !orderTrackingId || !merchantReference;
 const isFailed = paymentStatus === "failed" || Boolean(error) || missingCallbackParams;
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

 const bodyMessage = missingCallbackParams
 ? "We didn't receive confirmation from the payment provider. Your account has not been charged."
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
  <div className="min-h-screen flex flex-col bg-[#F3F4F6] text-slate-900 font-sans">
      {/* Official Top Bar */}
      <div className="bg-primary px-4 py-2 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary">✓</span>
            Official Market Management Portal
          </div>
        </div>
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="flex h-12 w-12 items-center justify-center bg-primary text-white">
            <Landmark className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="block text-xl font-bold leading-tight text-slate-900 tracking-tight">KAMPALA MARKETS</span>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Management System</span>
          </div>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to={returnPath}>Dashboard</Link>
        </Button>
      </header>

      <main className="mx-auto flex flex-1 w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
 <section className="w-full max-w-xl rounded-sm border border-slate-200 bg-white p-5 text-center shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)] sm:p-8">
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
 {isSuccess ? "Payment Successful" : isFailed ? "Payment Could Not Be Completed" : "Payment Pending"}
 </h1>
 <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
 {bodyMessage}
 {countdown !== null && <span className="ml-1 font-semibold text-slate-950">Redirecting in {countdown}s.</span>}
 </p>

 {isFailed ? (
 <p className="mx-auto mt-4 max-w-md rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
 If you see a charge on your mobile money or bank statement, please contact market support with your transaction ID.
 </p>
 ) : null}

 {!isFailed ? (
 <div className="mt-6 rounded-sm border border-slate-200 bg-slate-50 p-4 text-left">
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
 ) : null}

 <div className="mt-6 grid gap-2 sm:grid-cols-2">
 {isFailed ? (
 <>
 <Button asChild>
 <Link to={returnPath}>Try Payment Again</Link>
 </Button>
 <Button asChild variant="outline">
 <Link to={user ? `/${user.role}` : "/login"}>Go to Dashboard</Link>
 </Button>
 </>
 ) : (
 <Button asChild className="sm:col-span-2">
 <Link to={returnPath}>Go to Dashboard</Link>
 </Button>
 )}
 </div>
 </section>
 </main>
 </div>
 );
};

export default PaymentCallbackPage;
