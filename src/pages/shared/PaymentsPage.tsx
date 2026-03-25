import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PaymentsPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: bookingsData } = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    refetchInterval: 8_000,
  });

  const initiatePayment = useMutation({
    mutationFn: ({ bookingId, provider }: { bookingId: string; provider: "mtn" | "airtel" }) =>
      api.initiatePayment(bookingId, provider),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setError(null);
    },
    onError: (error) => setError(error instanceof ApiError ? error.message : "Unable to initiate payment."),
  });

  const manualMarkPaid = useMutation({
    mutationFn: (bookingId: string) => api.markBookingPaid(bookingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setError(null);
    },
    onError: (error) => setError(error instanceof ApiError ? error.message : "Unable to mark booking as paid."),
  });

  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const pendingBookings = bookings.filter((booking) => booking.status === "reserved");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {role === "vendor" ? "Your payment history and pending booking payments" : "All payment records"}
        </p>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {role === "vendor" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="card-warm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MTN MoMo</p>
                  <p className="text-sm font-medium">Sandbox provider flow</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-warm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Airtel Money</p>
                  <p className="text-sm font-medium">Sandbox provider flow</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Pending Booking Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings are currently awaiting payment.</p>
              ) : (
                pendingBookings.map((booking) => (
                  <div key={booking.id} className="rounded-lg bg-muted/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-sm">{booking.stallName}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.startDate} to {booking.endDate} · UGX {booking.amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => initiatePayment.mutate({ bookingId: booking.id, provider: "mtn" })}>
                        Pay with MTN
                      </Button>
                      <Button onClick={() => initiatePayment.mutate({ bookingId: booking.id, provider: "airtel" })}>
                        Pay with Airtel
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {role === "manager" && pendingBookings.length > 0 && (
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Manual Payment Reconciliation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingBookings.map((booking) => (
              <div key={booking.id} className="rounded-lg bg-muted/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {booking.vendorName} · {booking.stallName}
                  </p>
                  <p className="text-xs text-muted-foreground">UGX {booking.amount.toLocaleString()}</p>
                </div>
                <Button onClick={() => manualMarkPaid.mutate(booking.id)}>Mark Paid</Button>
              </div>
            ))}
          </CardContent>
        </Card>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    {role !== "vendor" && <TableCell className="font-medium">{payment.vendorName}</TableCell>}
                    <TableCell>UGX {payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${payment.method === "mtn" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                        {payment.method.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{payment.transactionId || payment.externalReference}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{payment.createdAt}</TableCell>
                    <TableCell><StatusBadge status={payment.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsPage;
