import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Search,
  Store,
  UserX,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConsolePage, DetailSheet, EvidenceField, KpiStrip, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import type { VendorProfile } from "@/types";

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

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "V";

const VendorProfileCard = ({
  row,
  onOpen,
}: {
  row: {
    vendor: VendorProfile;
    totalOutstanding: number;
    nextPermitExpiry: { endDate: string } | null;
    operationalStatus: OperationalVendorStatus;
  };
  onOpen: () => void;
}) => {
  const vendor = row.vendor;
  const initials = getInitials(vendor.name);
  const marketName = vendor.marketName || "Assigned market";
  const productSection = vendor.productSection || "Product section not set";
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const statusLabel =
    vendor.status === "approved"
      ? row.operationalStatus === "late_payment"
        ? "Payment follow-up"
        : "Approved vendor"
      : vendor.status === "pending"
        ? "Pending application"
        : "Rejected application";

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;
    setProfileImageUrl(null);

    if (!vendor.profileImage) {
      return;
    }

    api
      .getUserProfileImageUrl(vendor.id)
      .then((url) => {
        objectUrl = url;
        if (isActive) {
          setProfileImageUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (isActive) {
          setProfileImageUrl(null);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [vendor.id, vendor.profileImage]);

  return (
    <article className="rounded-xl border border-[#2b3546] bg-[#1f2937] p-5 text-slate-100 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-100 text-3xl font-bold text-slate-800 shadow-sm">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt={vendor.name} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <h2 className="mt-5 max-w-full truncate text-xl font-bold font-heading tracking-wide text-slate-100">{vendor.name}</h2>
        <p className="mt-1 max-w-full truncate text-sm font-semibold text-slate-200">{marketName}</p>
        <p className="mt-1 max-w-full truncate text-sm text-slate-300">{productSection}</p>
        <p className="mt-2 max-w-full truncate text-sm text-slate-400">{statusLabel}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <StatusBadge status={vendor.status} context="vendor" />
          <StatusBadge status={row.operationalStatus} />
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <a
          href={`tel:${vendor.phone}`}
          title={`Call ${vendor.name}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#263453] text-white transition-colors hover:bg-[#33446b]"
        >
          <Phone className="h-4 w-4" />
        </a>
        <a
          href={`mailto:${vendor.email}`}
          title={`Email ${vendor.name}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#263453] text-white transition-colors hover:bg-[#33446b]"
        >
          <Mail className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={onOpen}
          title="View submitted documents"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#263453] text-white transition-colors hover:bg-[#33446b]"
        >
          <FileText className="h-4 w-4" />
        </button>
        <span
          title={`Outstanding: ${formatCurrency(row.totalOutstanding)}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#263453] text-white"
        >
          <CreditCard className="h-4 w-4" />
        </span>
        <span title={marketName} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#263453] text-white">
          <MapPin className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <a
          href={`tel:${vendor.phone}`}
          className="inline-flex h-11 items-center justify-center rounded-md border border-slate-600 text-sm font-medium text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
        >
          Call
        </a>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-11 items-center justify-center rounded-md border border-primary text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-11 items-center justify-center rounded-md border border-slate-600 text-sm font-medium text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
        >
          View
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
        <div>
          <p>Outstanding</p>
          <p className="mt-1 font-semibold text-slate-100">{formatCurrency(row.totalOutstanding)}</p>
        </div>
        <div className="text-right">
          <p>Permit Expiry</p>
          <p className="mt-1 font-semibold text-slate-100">
            {row.nextPermitExpiry ? formatHumanDate(row.nextPermitExpiry.endDate) : "No permit"}
          </p>
        </div>
      </div>
    </article>
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

      {vendorRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card px-4 py-12 text-center">
          <Store className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No vendors found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another name, phone number, or email address.</p>
        </div>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {vendorRows.map((row) => (
            <VendorProfileCard key={row.vendor.id} row={row} onOpen={() => setSelectedVendorId(row.vendor.id)} />
          ))}
        </section>
      )}

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
                  <EvidenceField label="Product Section" value={selectedRow.vendor.productSection || "Not recorded"} />
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
