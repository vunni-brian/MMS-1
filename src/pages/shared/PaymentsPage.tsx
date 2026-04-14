import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReceiptText, Smartphone, Wallet } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PaymentsPage = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    phoneNumber: "",
    provider: "mtn" as "mtn" | "airtel",
  });

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

  useEffect(() => {
    if (user?.phone) {
      setPaymentForm((current) => ({ ...current, phoneNumber: user.phone }));
    }
  }, [user?.phone]);

  const initiatePayment = useMutation({
    mutationFn: ({ bookingId, provider, phoneNumber }: { bookingId: string; provider: "mtn" | "airtel"; phoneNumber: string }) =>
      api.initiatePayment(bookingId, provider, phoneNumber),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setPaymentMessage(response.message);
      setError(null);
    },
    onError: (mutationError) => {
      setPaymentMessage(null);
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
                              setPaymentMessage(null);
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
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${payment.method === "mtn" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                        {payment.method.toUpperCase()}
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
            <DialogTitle className="font-heading">Mobile Money Payment</DialogTitle>
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

              <div className="space-y-1.5">
                <Label htmlFor="payment-phone">Phone Number</Label>
                <Input
                  id="payment-phone"
                  value={paymentForm.phoneNumber}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  placeholder="+256 7XX XXX XXX"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-provider">Network</Label>
                <Select
                  value={paymentForm.provider}
                  onValueChange={(value: "mtn" | "airtel") => setPaymentForm((current) => ({ ...current, provider: value }))}
                >
                  <SelectTrigger id="payment-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                    <SelectItem value="airtel">Airtel Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                After you tap pay, confirm the payment prompt on your phone. The status here will remain pending until Flutterwave confirms the transaction.
              </div>

              {paymentMessage && <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{paymentMessage}</div>}

              <Button
                className="w-full"
                onClick={() =>
                  initiatePayment.mutate({
                    bookingId: selectedBooking.id,
                    provider: paymentForm.provider,
                    phoneNumber: paymentForm.phoneNumber,
                  })
                }
                disabled={initiatePayment.isPending || !paymentForm.phoneNumber.trim()}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                {initiatePayment.isPending ? "Initiating Payment..." : "Pay with Mobile Money"}
              </Button>
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
