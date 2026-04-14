import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ExternalLink, ReceiptText, ShieldCheck, Wallet } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaymentMethod } from "@/types";

const paymentMethodMeta: Record<PaymentMethod, { label: string; className: string }> = {
  mtn: {
    label: "MTN",
    className: "bg-warning/10 text-warning",
  },
  airtel: {
    label: "AIRTEL",
    className: "bg-destructive/10 text-destructive",
  },
  pesapal: {
    label: "PESAPAL",
    className: "bg-info/10 text-info",
  },
};

const PaymentsPage = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<{ redirectUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: bookingsData } = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    refetchInterval: 8_000,
  });
  const { data: receiptData } = useQuery({
    queryKey: ["receipt", selectedReceiptPaymentId],
    queryFn: () => api.getReceipt(selectedReceiptPaymentId!),
    enabled: Boolean(selectedReceiptPaymentId),
  });

  const initiatePayment = useMutation({
    mutationFn: ({ bookingId }: { bookingId: string }) => api.initiatePayment(bookingId),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setError(null);
      setSelectedBookingId(null);

      if (response.iframe) {
        setCheckoutSession({
          redirectUrl: response.redirectUrl,
        });
        return;
      }

      window.location.assign(response.redirectUrl);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Unable to initiate payment.");
    },
  });

  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const pendingBookings = bookings.filter((booking) => booking.status === "approved");
  const selectedBooking = pendingBookings.find((booking) => booking.id === selectedBookingId) || null;
  const pendingPaymentByBooking = payments.reduce<Record<string, (typeof payments)[number]>>((accumulator, payment) => {
    if (payment.status === "pending") {
      accumulator[payment.bookingId] = payment;
    }
    return accumulator;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {role === "vendor" ? "Initiate mobile money payments and view receipts." : "Track payment records and payment status."}
        </p>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {role === "vendor" && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="card-warm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Approved Bookings</p>
                <p className="mt-1 text-xl font-bold font-heading">{pendingBookings.length}</p>
              </CardContent>
            </Card>
            <Card className="card-warm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pending Payments</p>
                <p className="mt-1 text-xl font-bold font-heading">{payments.filter((payment) => payment.status === "pending").length}</p>
              </CardContent>
            </Card>
            <Card className="card-warm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Completed Payments</p>
                <p className="mt-1 text-xl font-bold font-heading">{payments.filter((payment) => payment.status === "completed").length}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Approved Booking Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved bookings are currently awaiting payment.</p>
              ) : (
                pendingBookings.map((booking) => {
                  const pendingPayment = pendingPaymentByBooking[booking.id];
                  return (
                    <div key={booking.id} className="rounded-lg bg-muted/50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-sm">{booking.stallName}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.startDate} to {booking.endDate} - UGX {booking.amount.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {pendingPayment && <StatusBadge status="pending" />}
                          <Button
                            onClick={() => {
                              setSelectedBookingId(booking.id);
                              setError(null);
                            }}
                            disabled={Boolean(pendingPayment)}
                          >
                            <Wallet className="mr-1 h-4 w-4" />
                            {pendingPayment ? "Awaiting Confirmation" : "Pay Now"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Payment Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {role !== "vendor" && <TableHead>Vendor</TableHead>}
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    {role !== "vendor" && <TableCell className="font-medium">{payment.vendorName}</TableCell>}
                    <TableCell>UGX {payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${paymentMethodMeta[payment.method].className}`}>
                        {paymentMethodMeta[payment.method].label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{payment.providerReference || payment.externalReference}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{payment.createdAt}</TableCell>
                    <TableCell><StatusBadge status={payment.status} /></TableCell>
                    <TableCell>
                      {payment.status === "completed" ? (
                        <Button variant="outline" size="sm" onClick={() => setSelectedReceiptPaymentId(payment.id)}>
                          <ReceiptText className="mr-1 h-4 w-4" />
                          View Receipt
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Available after success</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedBookingId)} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Secure Checkout</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm">
                <p className="font-medium">{selectedBooking.stallName}</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedBooking.startDate} to {selectedBooking.endDate}
                </p>
                <p className="mt-2 text-lg font-bold font-heading">UGX {selectedBooking.amount.toLocaleString()}</p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-info" />
                  <div className="space-y-2">
                    <p>Pesapal will open a secure checkout where the customer can complete payment.</p>
                    <p>
                      {user?.email
                        ? `The current checkout will use ${user.email} and ${user.phone}.`
                        : "The current checkout will use the phone number attached to the signed-in vendor account."}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => initiatePayment.mutate({ bookingId: selectedBooking.id })}
                disabled={initiatePayment.isPending}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {initiatePayment.isPending ? "Opening Checkout..." : "Continue to Pesapal"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(checkoutSession)} onOpenChange={(open) => !open && setCheckoutSession(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Pesapal Checkout</DialogTitle>
          </DialogHeader>
          {checkoutSession && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                Complete the payment in the secure Pesapal frame below. After checkout, Pesapal will return the user to the callback page and the app will verify the final status.
              </div>

              <iframe
                title="Pesapal Checkout"
                src={checkoutSession.redirectUrl}
                className="h-[640px] w-full rounded-xl border border-border/70 bg-white"
              />

              <div className="flex justify-end">
                <a
                  href={checkoutSession.redirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open checkout in a new tab
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedReceiptPaymentId)} onOpenChange={(open) => !open && setSelectedReceiptPaymentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Receipt</DialogTitle>
          </DialogHeader>
          {receiptData?.receipt ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Receipt ID</p>
                <p className="mt-1 font-medium">{receiptData.receipt.receiptId}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="mt-1 font-medium">UGX {receiptData.receipt.amount.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Transaction</p>
                  <p className="mt-1 font-medium">{receiptData.receipt.transactionId}</p>
                </div>
              </div>
              <div className="rounded-xl bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Confirmed At</p>
                <p className="mt-1 font-medium">{new Date(receiptData.receipt.createdAt).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-success">
                {receiptData.receipt.message}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading receipt...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsPage;
