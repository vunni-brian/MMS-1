import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, KeyRound, Search, X } from "lucide-react";

import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);
type OperationalVendorStatus = "active" | "late_payment" | "suspended";

const VendorsPage = () => {
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: vendorsData } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.getVendors(),
  });
  const { data: bookingsData } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    refetchInterval: 10_000,
  });

  const approveVendor = useMutation({
    mutationFn: (vendorId: string) => api.approveVendor(vendorId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSelectedVendorId(null);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to approve vendor."),
  });

  const rejectVendor = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.rejectVendor(vendorId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSelectedVendorId(null);
      setRejectionReason("");
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to reject vendor."),
  });

  const resetVendorPassword = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.resetVendorPassword(vendorId, reason),
    onSuccess: (response) => {
      setResetReason("");
      setResetMessage(response.message);
      setError(null);
    },
    onError: (mutationError) => {
      setResetMessage(null);
      setError(mutationError instanceof ApiError ? mutationError.message : "Unable to reset vendor password.");
    },
  });

  useEffect(() => {
    setRejectionReason("");
    setResetReason("");
    setResetMessage(null);
    setError(null);
  }, [selectedVendorId]);

  const vendors = vendorsData?.vendors || [];
  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];

  const paidByBooking = payments.reduce<Record<string, number>>((accumulator, payment) => {
    if (payment.status === "completed") {
      accumulator[payment.bookingId] = (accumulator[payment.bookingId] || 0) + payment.amount;
    }
    return accumulator;
  }, {});

  const allVendorRows = vendors
    .map((vendor) => {
      const vendorBookings = bookings.filter((booking) => booking.vendorId === vendor.id);
      const nextPermitExpiry = vendorBookings
        .filter((booking) => ["approved", "paid"].includes(booking.status))
        .sort((left, right) => endOfDay(left.endDate).getTime() - endOfDay(right.endDate).getTime())[0] || null;

      const totalOutstanding = vendorBookings.reduce((sum, booking) => {
        const outstanding = Math.max(booking.amount - (paidByBooking[booking.id] || 0), 0);
        return sum + outstanding;
      }, 0);

      const hasLatePayment = vendorBookings.some((booking) => {
        const outstanding = Math.max(booking.amount - (paidByBooking[booking.id] || 0), 0);
        return outstanding > 0 && (booking.status === "approved" || endOfDay(booking.endDate).getTime() < Date.now());
      });

      return {
        vendor,
        totalOutstanding,
        nextPermitExpiry,
        operationalStatus: (vendor.status === "approved" ? (hasLatePayment ? "late_payment" : "active") : "suspended") as OperationalVendorStatus,
      };
    });

  const vendorRows = allVendorRows.filter(({ vendor }) => {
      const term = search.trim().toLowerCase();
      if (!term) {
        return true;
      }
      return [vendor.name, vendor.phone, vendor.email].some((value) => value.toLowerCase().includes(term));
    });

  const selectedRow = allVendorRows.find((row) => row.vendor.id === selectedVendorId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Vendor Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search vendors and track approval, permit coverage, and payment risk in one place.
          </p>
        </div>
        <div className="relative w-full lg:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold font-heading mt-1">{vendorRows.filter((row) => row.operationalStatus === "active").length}</p></CardContent></Card>
        <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Late Payment</p><p className="text-xl font-bold font-heading mt-1">{vendorRows.filter((row) => row.operationalStatus === "late_payment").length}</p></CardContent></Card>
        <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Suspended</p><p className="text-xl font-bold font-heading mt-1">{vendorRows.filter((row) => row.operationalStatus === "suspended").length}</p></CardContent></Card>
        <Card className="card-warm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Approval</p><p className="text-xl font-bold font-heading mt-1">{vendors.filter((vendor) => vendor.status === "pending").length}</p></CardContent></Card>
      </div>

      <Card className="card-warm">
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Operational</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Permit Expiry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorRows.map((row) => (
                  <TableRow key={row.vendor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.vendor.name}</p>
                        <p className="text-xs text-muted-foreground">{row.vendor.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.vendor.phone}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.vendor.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.operationalStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">UGX {row.totalOutstanding.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{row.nextPermitExpiry?.endDate || "No active permit"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelectedVendorId(row.vendor.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {row.vendor.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="text-success hover:text-success" onClick={() => approveVendor.mutate(row.vendor.id)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setSelectedVendorId(row.vendor.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedVendorId)} onOpenChange={() => setSelectedVendorId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Vendor Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Name</span>
                  <p className="font-medium">{selectedRow.vendor.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Approval</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedRow.vendor.status} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Operational Status</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedRow.operationalStatus} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Outstanding</span>
                  <p className="font-medium">UGX {selectedRow.totalOutstanding.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{selectedRow.vendor.phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium">{selectedRow.vendor.email}</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Next Permit Expiry</span>
                <p className="font-medium mt-1">{selectedRow.nextPermitExpiry?.endDate || "No active permit on record"}</p>
              </div>
              {selectedRow.vendor.idDocument && (
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-muted-foreground">ID Document</span>
                  <p className="font-medium mt-1">{formatAttachmentLabel(selectedRow.vendor.idDocument)}</p>
                </div>
              )}
              {selectedRow.vendor.status === "approved" && (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div>
                    <p className="font-medium">Password Reset</p>
                    <p className="mt-1 text-muted-foreground">
                      Send the vendor a temporary password by SMS. A reason is required and the vendor will need to change it after signing in.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-reason">Reset Reason</Label>
                    <Textarea
                      id="reset-reason"
                      value={resetReason}
                      onChange={(event) => setResetReason(event.target.value)}
                      rows={2}
                    />
                  </div>
                  {resetMessage && (
                    <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                      {resetMessage}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => resetVendorPassword.mutate({ vendorId: selectedRow.vendor.id, reason: resetReason })}
                    disabled={resetVendorPassword.isPending || !resetReason.trim()}
                  >
                    <KeyRound className="mr-1 h-4 w-4" />
                    {resetVendorPassword.isPending ? "Sending Temporary Password..." : "Reset Password"}
                  </Button>
                </div>
              )}
              {selectedRow.vendor.status === "pending" && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label>Rejection Reason (if rejecting)</Label>
                    <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => approveVendor.mutate(selectedRow.vendor.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => rejectVendor.mutate({ vendorId: selectedRow.vendor.id, reason: rejectionReason })}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorsPage;
