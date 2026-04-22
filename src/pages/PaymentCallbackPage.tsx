import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { getPaymentPurpose } from "@/lib/payment-history";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

const PaymentCallbackPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const orderTrackingId = searchParams.get("OrderTrackingId");
  const merchantReference = searchParams.get("OrderMerchantReference");

  const returnPath = useMemo(() => {
    if (!user) {
      return "/login";
    }
    if (user.role === "vendor") {
      return "/vendor/payments";
    }
    if (user.role === "manager") {
      return "/manager/payments";
    }
    if (user.role === "official") {
      return "/official";
    }
    if (user.role === "admin") {
      return "/admin";
    }
    return "/";
  }, [user]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payments", "pesapal-callback", orderTrackingId, merchantReference],
    enabled: Boolean(orderTrackingId && merchantReference),
    queryFn: () => api.getPesapalCallbackStatus(orderTrackingId!, merchantReference!),
  });

  const payment = data?.payment || null;
  const paymentStatus = payment?.status || "pending";

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Payment Result</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This page confirms the latest payment state after Pesapal redirects the customer back to the app.
          </p>
        </div>

        {!orderTrackingId || !merchantReference ? (
          <Card className="card-warm">
            <CardContent className="p-6 text-sm text-destructive">
              Missing callback parameters. Start the payment again from the payments page.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="card-warm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Checking the latest transaction status with Pesapal...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="card-warm">
            <CardContent className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Unable to confirm the Pesapal payment status."}
            </CardContent>
          </Card>
        ) : (
          <Card className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-heading">
                {paymentStatus === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : paymentStatus === "failed" ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Clock3 className="h-5 w-5 text-warning" />
                )}
                Payment Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <StatusBadge status={paymentStatus} label={paymentStatus === "pending" ? "Pending" : undefined} />
                <span className="text-muted-foreground">Order tracking ID: {orderTrackingId}</span>
              </div>

              {payment ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-muted/30 p-4 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Purpose</p>
                      <p className="mt-1 font-medium">{getPaymentPurpose(payment)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-4">
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="mt-1 font-medium">{formatCurrency(payment.amount)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-4">
                      <p className="text-xs text-muted-foreground">Reference</p>
                      <p className="mt-1 break-all font-mono text-xs">{payment.providerReference || payment.externalReference}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                    {payment.status === "completed"
                      ? "Payment confirmed. You can now return to the payments page and open the receipt."
                      : payment.status === "failed"
                        ? "Pesapal marked this payment as failed. You can return to the payments page and start a new checkout session."
                        : "The transaction is still pending. Return to the payments page to refresh the latest status."}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                  No payment record was returned for this callback.
                </div>
              )}

              <Button asChild className="w-full">
                <Link to={returnPath}>Return to Payments</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PaymentCallbackPage;
