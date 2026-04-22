import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Eye, FileText, KeyRound, Search, UserX, Users, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsolePage, DetailSheet, EvidenceField, KpiStrip, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);
type OperationalVendorStatus = "active" | "late_payment" | "suspended";

const DocumentPreview = ({
  title,
  vendorId,
  documentType,
  attachment,
}: {
  title: string;
  vendorId: string;
  documentType: "national-id" | "lc-letter";
  attachment: Parameters<typeof formatAttachmentLabel>[0];
}) => {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;
    setDocumentUrl(null);
    setLoadError(null);
    setIsLoading(false);

    if (!attachment) {
      return;
    }

    setIsLoading(true);
    api
      .getVendorDocumentUrl(vendorId, documentType)
      .then((url) => {
        objectUrl = url;
        if (isActive) {
          setDocumentUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch((error) => {
        if (isActive) {
          setLoadError(error instanceof Error ? error.message : "Unable to load document.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment, documentType, vendorId]);

  const isImage = attachment?.mimeType?.startsWith("image/");
  const isPdf = attachment?.mimeType === "application/pdf";

  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold font-heading">{title}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{formatAttachmentLabel(attachment)}</p>
        </div>
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
      <div className="min-h-[360px] overflow-hidden rounded-md border border-border/70 bg-background">
        {!attachment ? (
          <div className="flex h-[360px] items-center justify-center p-4 text-sm text-muted-foreground">No document uploaded</div>
        ) : isLoading ? (
          <div className="flex h-[360px] items-center justify-center p-4 text-sm text-muted-foreground">Loading document...</div>
        ) : loadError ? (
          <div className="flex h-[360px] items-center justify-center p-4 text-center text-sm text-destructive">{loadError}</div>
        ) : documentUrl && isImage ? (
          <img src={documentUrl} alt={title} className="h-[360px] w-full object-contain" />
        ) : documentUrl && isPdf ? (
          <iframe title={title} src={documentUrl} className="h-[520px] w-full border-0 bg-white" />
        ) : documentUrl ? (
          <div className="flex h-[360px] items-center justify-center p-4 text-sm text-muted-foreground">Preview unavailable for this file type.</div>
        ) : (
          <div className="flex h-[360px] items-center justify-center p-4 text-sm text-muted-foreground">Document not loaded</div>
        )}
      </div>
      {documentUrl && (
        <a href={documentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-medium underline-offset-4 hover:underline">
          Open full document
        </a>
      )}
    </div>
  );
};

const VendorsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
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
    mutationFn: ({ vendorId, notes }: { vendorId: string; notes?: string }) => api.approveVendor(vendorId, notes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSelectedVendorId(null);
      setError(null);
      toast.success("Vendor approved");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof ApiError ? mutationError.message : "Unable to approve vendor.";
      setError(message);
      toast.error("Vendor was not approved", { description: message });
    },
  });

  const rejectVendor = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.rejectVendor(vendorId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSelectedVendorId(null);
      setRejectionReason("");
      setError(null);
      toast.success("Vendor rejected");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof ApiError ? mutationError.message : "Unable to reject vendor.";
      setError(message);
      toast.error("Vendor was not rejected", { description: message });
    },
  });

  const resetVendorPassword = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.resetVendorPassword(vendorId, reason),
    onSuccess: (response) => {
      setResetReason("");
      setResetMessage(response.message);
      setError(null);
      toast.success("Temporary password sent", { description: response.message });
    },
    onError: (mutationError) => {
      setResetMessage(null);
      const message = mutationError instanceof ApiError ? mutationError.message : "Unable to reset vendor password.";
      setError(message);
      toast.error("Password reset failed", { description: message });
    },
  });

  useEffect(() => {
    setRejectionReason("");
    setManagerNotes("");
    setResetReason("");
    setResetMessage(null);
    setError(null);
  }, [selectedVendorId]);

  const vendors = vendorsData?.vendors || [];
  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];

  const paidByBooking = payments.reduce<Record<string, number>>((accumulator, payment) => {
    if (payment.status === "completed" && payment.bookingId) {
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
  const vendorKpis = [
    {
      label: "Active Vendors",
      value: vendorRows.filter((row) => row.operationalStatus === "active").length,
      detail: "Approved and currently in good standing",
      icon: CheckCircle2,
      tone: "success" as const,
    },
    {
      label: "Late Payment",
      value: vendorRows.filter((row) => row.operationalStatus === "late_payment").length,
      detail: "Outstanding booking or permit balance",
      icon: AlertTriangle,
      tone: vendorRows.some((row) => row.operationalStatus === "late_payment") ? "warning" as const : "default" as const,
    },
    {
      label: "Suspended",
      value: vendorRows.filter((row) => row.operationalStatus === "suspended").length,
      detail: "Rejected or not approved for operations",
      icon: UserX,
      tone: "destructive" as const,
    },
    {
      label: "Pending Approval",
      value: vendors.filter((vendor) => vendor.status === "pending").length,
      detail: "Needs manager review",
      icon: Users,
      tone: vendors.some((vendor) => vendor.status === "pending") ? "info" as const : "default" as const,
    },
  ];

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Vendor operations"
        title="Vendor Directory"
        description="Search vendors, review approval evidence, track permit coverage, and act on payment or account risk without leaving the directory."
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">Market: {user?.marketName || "Assigned market"}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">Rows: {vendorRows.length}</span>
          </>
        }
      />

      <ScopeBar>
        <ScopeItem label="Vendor search" className="w-full lg:w-[360px]">
          <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </ScopeItem>
        <ScopeItem label="Market scope">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">{user?.marketName || "Assigned market"}</div>
        </ScopeItem>
        <ScopeItem label="Primary action">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">Review pending vendors and account risk</div>
        </ScopeItem>
      </ScopeBar>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <KpiStrip items={vendorKpis} />

      <Card className="card-warm">
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Market</TableHead>
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
                    <TableCell className="text-muted-foreground">{row.vendor.marketName || user?.marketName || "Assigned market"}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.vendor.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.operationalStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(row.totalOutstanding)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.nextPermitExpiry ? formatHumanDate(row.nextPermitExpiry.endDate) : "No active permit"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelectedVendorId(row.vendor.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {row.vendor.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="text-success hover:text-success" onClick={() => approveVendor.mutate({ vendorId: row.vendor.id })}>
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

      <DetailSheet
        open={Boolean(selectedVendorId)}
        onOpenChange={(open) => !open && setSelectedVendorId(null)}
        title="Vendor Application Review"
        description="Review applicant details and the submitted National ID and LC Letter before deciding."
        className="lg:max-w-5xl"
      >
          {selectedRow && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.6fr]">
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-4">
                  <p className="font-semibold font-heading">User Input</p>
                  <EvidenceField label="Full Name" value={selectedRow.vendor.name} />
                  <EvidenceField label="Phone" value={selectedRow.vendor.phone} />
                  <EvidenceField label="Email" value={selectedRow.vendor.email} />
                  <EvidenceField label="NIN" value={selectedRow.vendor.nationalIdNumber || "Not recorded"} mono={Boolean(selectedRow.vendor.nationalIdNumber)} />
                  <EvidenceField label="District" value={selectedRow.vendor.district || "Not recorded"} />
                </div>

                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-4">
                  <p className="font-semibold font-heading">Submitted Documents</p>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <DocumentPreview
                      title="National ID"
                      vendorId={selectedRow.vendor.id}
                      documentType="national-id"
                      attachment={selectedRow.vendor.idDocument}
                    />
                    <DocumentPreview
                      title="LC Letter"
                      vendorId={selectedRow.vendor.id}
                      documentType="lc-letter"
                      attachment={selectedRow.vendor.lcLetter}
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <EvidenceField label="Approval" value={<StatusBadge status={selectedRow.vendor.status} />} />
                <EvidenceField label="Operational Status" value={<StatusBadge status={selectedRow.operationalStatus} />} />
                <EvidenceField label="Outstanding" value={formatCurrency(selectedRow.totalOutstanding)} />
                <EvidenceField
                  label="Next Permit Expiry"
                  value={selectedRow.nextPermitExpiry ? formatHumanDate(selectedRow.nextPermitExpiry.endDate) : "No active permit on record"}
                  className="md:col-span-3"
                />
              </div>
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
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-4">
                  <p className="font-semibold font-heading">Decision Panel</p>
                  <div className="space-y-1.5">
                    <Label>Manager Notes</Label>
                    <Textarea value={managerNotes} onChange={(event) => setManagerNotes(event.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reject Reason</Label>
                    <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-success hover:bg-success/90"
                      onClick={() => approveVendor.mutate({ vendorId: selectedRow.vendor.id, notes: managerNotes })}
                      disabled={approveVendor.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve Vendor
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => rejectVendor.mutate({ vendorId: selectedRow.vendor.id, reason: rejectionReason })}
                      disabled={rejectVendor.isPending || !rejectionReason.trim()}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject Vendor
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
      </DetailSheet>
    </ConsolePage>
  );
};

export default VendorsPage;
