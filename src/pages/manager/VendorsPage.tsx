import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  Clock3,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Search,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { formatCurrency, formatHumanDate, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { LoadingState } from "@/components/console/ConsolePage";
import {
  MockupHeader,
  MockupPage,
  MockupPanel,
  StatusPill,
} from "@/components/mockup/MockupUI";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { VendorActivityEvent, VendorProfile } from "@/types";

const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);

type OperationalVendorStatus = "active" | "late_payment" | "suspended";

const operationalTone = (status: OperationalVendorStatus) => {
  if (status === "late_payment") return "amber" as const;
  if (status === "suspended") return "red" as const;
  return "green" as const;
};

// ─────────────────────────────────────────────────────────
// Document Preview
// ─────────────────────────────────────────────────────────
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
    if (!attachment) return;
    setIsLoading(true);
    api
      .getVendorDocumentUrl(vendorId, documentType)
      .then((url) => {
        objectUrl = url;
        if (isActive) setDocumentUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (isActive) setLoadError(error instanceof Error ? error.message : "Unable to load document.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, documentType, vendorId]);

  const isImage = attachment?.mimeType?.startsWith("image/");
  const isPdf = attachment?.mimeType === "application/pdf";

  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 break-words text-xs text-slate-500">{formatAttachmentLabel(attachment)}</p>
        </div>
        <FileText className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
      <div className="min-h-[280px] overflow-hidden rounded-sm border border-slate-200 bg-white">
        {!attachment ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">No document uploaded</div>
        ) : isLoading ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">Loading document...</div>
        ) : loadError ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-center text-sm text-red-600">{loadError}</div>
        ) : documentUrl && isImage ? (
          <img src={documentUrl} alt={title} className="h-[280px] w-full object-contain" />
        ) : documentUrl && isPdf ? (
          <iframe title={title} src={documentUrl} className="h-[440px] w-full border-0 bg-white" />
        ) : documentUrl ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">Preview unavailable.</div>
        ) : (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">Document not loaded</div>
        )}
      </div>
      {documentUrl && (
        <a href={documentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline">
          Open full document
        </a>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Vendor card
// ─────────────────────────────────────────────────────────
const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "V";

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

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;
    setProfileImageUrl(null);
    if (!vendor.profileImage) return;
    api.getUserProfileImageUrl(vendor.id).then((url) => {
      objectUrl = url;
      if (isActive) setProfileImageUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (isActive) setProfileImageUrl(null); });
    return () => { isActive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [vendor.id, vendor.profileImage]);

  const statusDot = vendor.status === "approved" ? "bg-emerald-500" : vendor.status === "pending" ? "bg-amber-400" : "bg-red-500";
  const statusLabel = vendor.status === "approved"
    ? row.operationalStatus === "late_payment" ? "Payment follow-up" : "Active vendor"
    : vendor.status === "pending" ? "Pending review" : "Rejected";

  return (
    <article className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-sm hover:border-slate-300">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
            {profileImageUrl ? <img src={profileImageUrl} alt={vendor.name} className="h-full w-full object-cover" /> : initials}
          </div>
          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${statusDot}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">{vendor.name}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">{productSection}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{marketName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{statusLabel}</p>
            </div>
            <StatusPill tone={vendor.status === "approved" ? "green" : vendor.status === "pending" ? "amber" : "red"}>
              {vendor.status}
            </StatusPill>
          </div>
          <button type="button" onClick={onOpen} className="mt-2 text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline">
            View profile
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-sm border border-slate-100 bg-slate-50 p-2">
          <p className="text-slate-500">Outstanding</p>
          <p className="mt-1 truncate font-bold text-slate-900">{formatCurrency(row.totalOutstanding)}</p>
        </div>
        <div className="rounded-sm border border-slate-100 bg-slate-50 p-2">
          <p className="text-slate-500">Permit</p>
          <p className="mt-1 truncate font-bold text-slate-900">
            {row.nextPermitExpiry ? formatHumanDate(row.nextPermitExpiry.endDate) : "No permit"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusPill tone={operationalTone(row.operationalStatus)}>
          {row.operationalStatus.replace(/_/g, " ")}
        </StatusPill>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <a href={`tel:${vendor.phone}`} title={`Call ${vendor.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Phone className="h-3.5 w-3.5" />
          </a>
          <a href={`mailto:${vendor.email}`} title={`Email ${vendor.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Mail className="h-3.5 w-3.5" />
          </a>
          <button type="button" onClick={onOpen} title="Review documents" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <FileText className="h-3.5 w-3.5" />
          </button>
          <span title={`Outstanding: ${formatCurrency(row.totalOutstanding)}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
            <CreditCard className="h-3.5 w-3.5" />
          </span>
          <span title={marketName} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
};

// ─────────────────────────────────────────────────────────
// Activity timeline
// ─────────────────────────────────────────────────────────
const activityTypeLabels: Record<VendorActivityEvent["type"], string> = {
  audit: "Audit", booking: "Stall", ticket: "Complaint",
  ticket_update: "Case update", payment: "Payment", notification: "Notice",
};

const VendorActivityTimeline = ({ events, isLoading }: { events: VendorActivityEvent[]; isLoading: boolean }) => (
  <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="font-bold text-slate-900">Activity Timeline</p>
        <p className="mt-1 text-xs text-slate-500">Approvals, complaints, payments, and notifications for this vendor.</p>
      </div>
      <Activity className="h-5 w-5 shrink-0 text-slate-400" />
    </div>
    {isLoading ? (
      <LoadingState rows={4} itemClassName="h-14 rounded-sm" />
    ) : events.length === 0 ? (
      <div className="rounded-sm border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
        No operational activity recorded for this vendor yet.
      </div>
    ) : (
      <div className="space-y-2">
        {events.slice(0, 12).map((event) => (
          <div key={event.id} className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {activityTypeLabels[event.type]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{event.description}</p>
              {event.actorName && (
                <p className="mt-1 text-xs text-slate-400">By {event.actorName}{event.actorRole ? ` (${event.actorRole})` : ""}</p>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 sm:justify-end">
              <Clock3 className="h-3.5 w-3.5" />
              {formatHumanDateTime(event.createdAt)}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────
// Evidence field (matching mockup style)
// ─────────────────────────────────────────────────────────
const FieldRow = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="rounded-sm border border-slate-100 bg-slate-50 p-2.5">
    <p className="text-xs text-slate-500">{label}</p>
    <div className={`mt-1 break-words text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────
const VendorsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [error, setError] = useState<string | null>(null);

  const { data: vendorsData, isPending: vendorsPending } = useQuery({ queryKey: ["vendors"], queryFn: () => api.getVendors() });
  const { data: bookingsData, isPending: bookingsPending } = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const { data: paymentsData, isPending: paymentsPending } = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments(), refetchInterval: 30_000 });
  const { data: activityData, isPending: activityPending } = useQuery({
    queryKey: ["vendor-activity", selectedVendorId],
    queryFn: () => api.getVendorActivity(selectedVendorId!),
    enabled: Boolean(selectedVendorId),
  });

  const approveVendor = useMutation({
    mutationFn: ({ vendorId, notes }: { vendorId: string; notes?: string }) => api.approveVendor(vendorId, notes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSelectedVendorId(null);
      setError(null);
      toast.success("Vendor approved");
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to approve vendor."; setError(msg); toast.error("Vendor was not approved", { description: msg }); },
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
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to reject vendor."; setError(msg); toast.error("Vendor was not rejected", { description: msg }); },
  });

  const resetVendorPassword = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.resetVendorPassword(vendorId, reason),
    onSuccess: (response) => {
      setResetReason("");
      setResetMessage(response.message);
      setError(null);
      toast.success("Temporary password sent", { description: response.message });
    },
    onError: (e) => {
      setResetMessage(null);
      const msg = e instanceof ApiError ? e.message : "Unable to reset vendor password.";
      setError(msg);
      toast.error("Password reset failed", { description: msg });
    },
  });

  useEffect(() => {
    setRejectionReason(""); setManagerNotes(""); setResetReason(""); setResetMessage(null); setError(null);
  }, [selectedVendorId]);

  const vendors = vendorsData?.vendors || [];
  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const isLoading = vendorsPending || bookingsPending || paymentsPending;

  const paidByBooking = payments.reduce<Record<string, number>>((acc, payment) => {
    if (payment.status === "completed" && payment.bookingId) {
      acc[payment.bookingId] = (acc[payment.bookingId] || 0) + payment.amount;
    }
    return acc;
  }, {});

  const allVendorRows = vendors.map((vendor) => {
    const vendorBookings = bookings.filter((b) => b.vendorId === vendor.id);
    const nextPermitExpiry = vendorBookings
      .filter((b) => ["approved", "paid"].includes(b.status))
      .sort((a, b) => endOfDay(a.endDate).getTime() - endOfDay(b.endDate).getTime())[0] || null;
    const totalOutstanding = vendorBookings.reduce((sum, b) => sum + Math.max(b.amount - (paidByBooking[b.id] || 0), 0), 0);
    const hasLatePayment = vendorBookings.some((b) => {
      const outstanding = Math.max(b.amount - (paidByBooking[b.id] || 0), 0);
      return outstanding > 0 && (b.status === "approved" || endOfDay(b.endDate).getTime() < Date.now());
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
    const matchesSearch = !term || [vendor.name, vendor.phone, vendor.email].some((v) => v.toLowerCase().includes(term));
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: allVendorRows.length,
    pending: allVendorRows.filter((r) => r.vendor.status === "pending").length,
    approved: allVendorRows.filter((r) => r.vendor.status === "approved").length,
    rejected: allVendorRows.filter((r) => r.vendor.status === "rejected").length,
  };
  const followUpRows = allVendorRows.filter((r) => r.operationalStatus === "late_payment");
  const outstandingTotal = allVendorRows.reduce((sum, r) => sum + r.totalOutstanding, 0);
  const selectedRow = allVendorRows.find((r) => r.vendor.id === selectedVendorId) || null;

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Vendor operations"
        title="Vendors"
        subtitle={`Vendor status, applications, documents, and payment follow-up for ${user?.marketName || "your market"}.`}
      />

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pending approval", value: statusCounts.pending, sub: "Applications awaiting review", tone: "amber" as const },
          { label: "Approved vendors", value: statusCounts.approved, sub: "Active trading profiles", tone: "green" as const },
          { label: "Payment follow-up", value: followUpRows.length, sub: formatCurrency(outstandingTotal) + " outstanding", tone: followUpRows.length ? "red" as const : "green" as const },
          { label: "Current view", value: vendorRows.length, sub: "Filtered records", tone: "slate" as const },
        ].map((item) => (
          <div key={item.label} className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 font-heading">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="border-slate-300 pl-9 rounded-sm focus-visible:border-primary focus-visible:ring-0"
            placeholder="Search by name, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-sm border border-slate-200 bg-slate-50 p-1" role="tablist">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-bold transition-colors focus-visible:outline-none ${
                statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === s ? "bg-slate-100" : "bg-white"}`}>
                {statusCounts[s]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Vendor grid */}
      <MockupPanel title={`Vendor Directory — ${vendorRows.length} records`}>
        {isLoading ? (
          <LoadingState rows={6} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" itemClassName="h-[180px] rounded-sm" />
        ) : vendorRows.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
            No vendors match the current search or filter.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {vendorRows.map((row) => (
              <VendorProfileCard key={row.vendor.id} row={row} onOpen={() => setSelectedVendorId(row.vendor.id)} />
            ))}
          </div>
        )}
      </MockupPanel>

      {/* Vendor detail sheet */}
      <Sheet open={Boolean(selectedVendorId)} onOpenChange={(open) => !open && setSelectedVendorId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl lg:max-w-5xl" aria-describedby="vendor-sheet-desc">
          <SheetHeader className="pr-6">
            <SheetTitle className="font-bold text-slate-900">Vendor Application Review</SheetTitle>
            <SheetDescription id="vendor-sheet-desc">
              Review applicant details and submitted documents before deciding.
            </SheetDescription>
          </SheetHeader>

          {selectedRow && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.6fr]">
                {/* User details */}
                <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">User Input</p>
                  <FieldRow label="Full Name" value={selectedRow.vendor.name} />
                  <FieldRow label="Phone" value={selectedRow.vendor.phone} />
                  <FieldRow label="Email" value={selectedRow.vendor.email} />
                  <FieldRow label="NIN" value={selectedRow.vendor.nationalIdNumber || "Not recorded"} mono={Boolean(selectedRow.vendor.nationalIdNumber)} />
                  <FieldRow label="District" value={selectedRow.vendor.district || "Not recorded"} />
                  <FieldRow label="Product Section" value={selectedRow.vendor.productSection || "Not recorded"} />
                </div>

                {/* Documents */}
                <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">Submitted Documents</p>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <DocumentPreview title="National ID" vendorId={selectedRow.vendor.id} documentType="national-id" attachment={selectedRow.vendor.idDocument} />
                    <DocumentPreview title="LC Letter" vendorId={selectedRow.vendor.id} documentType="lc-letter" attachment={selectedRow.vendor.lcLetter} />
                  </div>
                </div>
              </div>

              {/* Status overview */}
              <div className="grid gap-3 md:grid-cols-3">
                <FieldRow label="Approval" value={<StatusBadge status={selectedRow.vendor.status} />} />
                <FieldRow label="Follow-up Status" value={<StatusBadge status={selectedRow.operationalStatus} />} />
                <FieldRow label="Outstanding" value={formatCurrency(selectedRow.totalOutstanding)} />
                <div className="md:col-span-3">
                  <FieldRow
                    label="Next Permit Expiry"
                    value={selectedRow.nextPermitExpiry ? formatHumanDate(selectedRow.nextPermitExpiry.endDate) : "No active permit on record"}
                  />
                </div>
              </div>

              <VendorActivityTimeline events={activityData?.events || []} isLoading={activityPending} />

              {/* Password reset */}
              {selectedRow.vendor.status === "approved" && (
                <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">Password Reset</p>
                  <p className="text-slate-600">Send the vendor a temporary password by SMS. A reason is required.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-reason">Reset Reason</Label>
                    <Textarea id="reset-reason" value={resetReason} onChange={(e) => setResetReason(e.target.value)} rows={2} />
                  </div>
                  {resetMessage && <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{resetMessage}</div>}
                  <Button variant="outline" onClick={() => resetVendorPassword.mutate({ vendorId: selectedRow.vendor.id, reason: resetReason })} disabled={resetVendorPassword.isPending || !resetReason.trim()}>
                    <KeyRound className="mr-1 h-4 w-4" />
                    {resetVendorPassword.isPending ? "Sending..." : "Reset Password"}
                  </Button>
                </div>
              )}

              {/* Decision panel */}
              {selectedRow.vendor.status === "pending" && (
                <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">Decision Panel</p>
                  <div className="space-y-1.5">
                    <Label>Manager Notes</Label>
                    <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reject Reason</Label>
                    <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm shadow-none"
                      onClick={() => approveVendor.mutate({ vendorId: selectedRow.vendor.id, notes: managerNotes })}
                      disabled={approveVendor.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve Vendor
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-sm shadow-none"
                      onClick={() => rejectVendor.mutate({ vendorId: selectedRow.vendor.id, reason: rejectionReason })}
                      disabled={rejectVendor.isPending || !rejectionReason.trim()}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject Vendor
                    </Button>
                  </div>
                </div>
              )}

              {/* Mobile close button */}
              <div className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white pt-3 sm:hidden">
                <button type="button" onClick={() => setSelectedVendorId(null)} className="flex h-11 w-full items-center justify-center rounded-sm border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900">
                  Close
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </MockupPage>
  );
};

export default VendorsPage;
