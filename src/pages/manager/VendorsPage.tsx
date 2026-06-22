/**
 * Manager vendor management page with vendor list, document preview, suspension,
 * and penalty tracking. Manager role only.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { VendorActivityEvent, VendorProfile } from "@/types";

/** Returns a Date set to the end of the given date string. */
const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);

/** Operational status for a vendor account from the manager's perspective. */
type OperationalVendorStatus = "active" | "late_payment" | "suspended";

// ─────────────────────────────────────────────────────────
// Document Preview
// ─────────────────────────────────────────────────────────
/** Renders a modal preview of a vendor's uploaded document with image or file placeholder. */
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
  const { t } = useTranslation();
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
        if (isActive) setLoadError(error instanceof Error ? error.message : t("vendor:unableToLoadDocument"));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, documentType, vendorId, t]);

  const isImage = attachment?.mimeType?.startsWith("image/");
  const isPdf = attachment?.mimeType === "application/pdf";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 break-words text-xs text-slate-500">{formatAttachmentLabel(attachment)}</p>
        </div>
        <FileText className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
      <div className="min-h-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!attachment ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">{t("vendor:noDocument")}</div>
        ) : isLoading ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">{t("vendor:loadingDocument")}</div>
        ) : loadError ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-center text-sm text-red-600">{loadError}</div>
        ) : documentUrl && isImage ? (
          <img src={documentUrl} alt={title} className="h-[280px] w-full object-contain" />
        ) : documentUrl && isPdf ? (
          <iframe title={title} src={documentUrl} className="h-[440px] w-full border-0 bg-white" />
        ) : documentUrl ? (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">{t("vendor:previewUnavailable")}</div>
        ) : (
          <div className="flex h-[280px] items-center justify-center p-4 text-sm text-slate-400">{t("vendor:documentNotLoaded")}</div>
        )}
      </div>
      {documentUrl && (
        <a href={documentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline">
          {t("vendor:openFullDocument")}
        </a>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Vendor card
// ─────────────────────────────────────────────────────────
/** Extracts initials from a full name (up to 2 characters). */
const getInitials = (name: string) =>
  (name || "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "V";

/** Card component displaying vendor profile details with document preview and action controls. */
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
  const { t } = useTranslation();
  const vendor = row.vendor;
  const initials = getInitials(vendor.name);
  const marketName = vendor.marketName || t("common:assignedMarket");
  const productSection = vendor.productSection || t("common:productSectionNotSet");
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
    ? row.operationalStatus === "late_payment" ? t("common:paymentFollowUp") : t("common:activeVendor")
    : vendor.status === "pending" ? t("common:pendingReview") : t("common:rejected");

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-sm hover:border-slate-300">
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
            <StatusBadge status={vendor.status} context="vendor" />
          </div>
          <button type="button" onClick={onOpen} className="mt-2 text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline">
            {t("vendor:viewProfile")}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <p className="text-slate-500">{t("common:outstanding")}</p>
          <p className="mt-1 truncate font-bold text-slate-900">{formatCurrency(row.totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <p className="text-slate-500">{t("common:permit")}</p>
          <p className="mt-1 truncate font-bold text-slate-900">
            {row.nextPermitExpiry ? formatHumanDate(row.nextPermitExpiry.endDate) : t("common:noPermit")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge status={row.operationalStatus} />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <a href={`tel:${vendor.phone}`} title={t("common:callName", { name: vendor.name })} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Phone className="h-3.5 w-3.5" />
          </a>
          <a href={`mailto:${vendor.email}`} title={t("common:emailName", { name: vendor.name })} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Mail className="h-3.5 w-3.5" />
          </a>
          <button type="button" onClick={onOpen} title={t("vendor:reviewDocuments")} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <FileText className="h-3.5 w-3.5" />
          </button>
          <span title={t("common:outstandingWithAmount", { amount: formatCurrency(row.totalOutstanding) })} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
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
/** Timeline component showing vendor-related activity events. */
const VendorActivityTimeline = ({ events, isLoading }: { events: VendorActivityEvent[]; isLoading: boolean }) => {
  const { t } = useTranslation();
  const activityTypeLabels: Record<VendorActivityEvent["type"], string> = {
    audit: t("vendor:activityAudit"), booking: t("common:stall"), ticket: t("vendor:activityComplaint"),
    ticket_update: t("vendor:activityCaseUpdate"), payment: t("common:payment"), notification: t("vendor:activityNotice"),
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{t("vendor:activityTimeline")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("vendor:activityTimelineDesc")}</p>
        </div>
        <Activity className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
      {isLoading ? (
        <LoadingState rows={4} itemClassName="h-14 rounded-lg" />
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
          {t("vendor:noActivity")}
        </div>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 12).map((event) => (
            <div key={event.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {activityTypeLabels[event.type]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                {event.actorName && (
                  <p className="mt-1 text-xs text-slate-400">{t("common:by")} {event.actorName}{event.actorRole ? ` (${event.actorRole})` : ""}</p>
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
};

// ─────────────────────────────────────────────────────────
// Evidence field (matching mockup style)
// ─────────────────────────────────────────────────────────
/** Label-value row for display in vendor detail sections. */
const FieldRow = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
    <p className="text-xs text-slate-500">{label}</p>
    <div className={`mt-1 break-words text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────
/** VendorsPage - renders the vendor management dashboard with searchable vendor list, detail sheet, and penalty controls. */
const VendorsPage = () => {
  const { t } = useTranslation();
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
      toast.success(t("vendor:approved"));
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to approve vendor."; setError(msg); toast.error(t("vendor:notApproved"), { description: msg }); },
  });

  const rejectVendor = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.rejectVendor(vendorId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSelectedVendorId(null);
      setRejectionReason("");
      setError(null);
      toast.success(t("vendor:rejected"));
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to reject vendor."; setError(msg); toast.error(t("vendor:notRejected"), { description: msg }); },
  });

  const resetVendorPassword = useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) => api.resetVendorPassword(vendorId, reason),
    onSuccess: (response) => {
      setResetReason("");
      setResetMessage(response.message);
      setError(null);
      toast.success(t("vendor:tempPasswordSent"), { description: response.message });
    },
    onError: (e) => {
      setResetMessage(null);
      const msg = e instanceof ApiError ? e.message : "Unable to reset vendor password.";
      setError(msg);
      toast.error(t("common:passwordResetFailed"), { description: msg });
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
    if (payment?.status === "completed" && payment?.bookingId) {
      acc[payment.bookingId] = (acc[payment.bookingId] || 0) + payment.amount;
    }
    return acc;
  }, {});

  const allVendorRows = vendors.filter(Boolean).map((vendor) => {
    const vendorBookings = bookings.filter((b) => b?.vendorId === vendor.id);
    const nextPermitExpiry = vendorBookings
      .filter((b) => b && ["approved", "paid"].includes(b.status))
      .sort((a, b) => endOfDay(a?.endDate ?? "").getTime() - endOfDay(b?.endDate ?? "").getTime())[0] || null;
    const totalOutstanding = vendorBookings.reduce((sum, b) => sum + Math.max((b?.amount ?? 0) - (paidByBooking[b?.id ?? ""] || 0), 0), 0);
    const hasLatePayment = vendorBookings.some((b) => {
      const outstanding = Math.max((b?.amount ?? 0) - (paidByBooking[b?.id ?? ""] || 0), 0);
      return outstanding > 0 && (b?.status === "approved" || endOfDay(b?.endDate ?? "").getTime() < Date.now());
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

  const statusFilterLabels: Record<string, string> = {
    all: t("common:all"),
    pending: t("common:pending"),
    approved: t("common:approved"),
    rejected: t("common:rejected"),
  };

  return (
    <PageLayout>
      <PageHeader
        eyebrow={t("vendor:operations")}
        title={t("vendor:title")}
        description={`Vendor status, applications, documents, and payment follow-up for ${user?.marketName || t("common:yourMarket")}.`}
      />

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("vendor:pendingApproval"), value: statusCounts.pending, sub: t("vendor:awaitingReview"), tone: "amber" as const },
          { label: t("vendor:approvedVendors"), value: statusCounts.approved, sub: t("vendor:activeTradingProfiles"), tone: "green" as const },
          { label: t("common:paymentFollowUp"), value: followUpRows.length, sub: `${formatCurrency(outstandingTotal)} ${t("common:outstanding")}`, tone: followUpRows.length ? "red" as const : "green" as const },
          { label: t("common:currentView"), value: vendorRows.length, sub: t("common:filteredRecords"), tone: "slate" as const },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
            className="border-slate-300 pl-9 rounded-lg focus-visible:border-primary focus-visible:ring-0"
            placeholder={t("vendor:searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none ${
                statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {statusFilterLabels[s]}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === s ? "bg-slate-100" : "bg-white"}`}>
                {statusCounts[s]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Vendor grid */}
      <Card>
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <CardTitle className="text-base font-medium">{t("vendor:directoryWithRecords", { count: vendorRows.length })}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
        {isLoading ? (
          <LoadingState rows={6} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" itemClassName="h-[180px] rounded-lg" />
        ) : vendorRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
            {t("vendor:noVendors")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {vendorRows.map((row) => (
              <VendorProfileCard key={row.vendor.id} row={row} onOpen={() => setSelectedVendorId(row.vendor.id)} />
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {/* Vendor detail sheet */}
      <Sheet open={Boolean(selectedVendorId)} onOpenChange={(open) => !open && setSelectedVendorId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl lg:max-w-5xl" aria-describedby="vendor-sheet-desc">
          <SheetHeader className="pr-6">
            <SheetTitle className="font-bold text-slate-900">{t("vendor:applicationReview")}</SheetTitle>
            <SheetDescription id="vendor-sheet-desc">
              {t("vendor:reviewDetails")}
            </SheetDescription>
          </SheetHeader>

          {selectedRow && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.6fr]">
                {/* User details */}
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">{t("vendor:userInput")}</p>
                  <FieldRow label={t("common:fullName")} value={selectedRow.vendor.name} />
                  <FieldRow label={t("common:phone")} value={selectedRow.vendor.phone} />
                  <FieldRow label={t("common:email")} value={selectedRow.vendor.email} />
                  <FieldRow label={t("common:nin")} value={selectedRow.vendor.nationalIdNumber || t("common:notRecorded")} mono={Boolean(selectedRow.vendor.nationalIdNumber)} />
                  <FieldRow label={t("common:district")} value={selectedRow.vendor.district || t("common:notRecorded")} />
                  <FieldRow label={t("common:productSection")} value={selectedRow.vendor.productSection || t("common:notRecorded")} />
                </div>

                {/* Documents */}
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">{t("vendor:submittedDocuments")}</p>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <DocumentPreview title={t("common:nationalId")} vendorId={selectedRow.vendor.id} documentType="national-id" attachment={selectedRow.vendor.idDocument} />
                    <DocumentPreview title={t("common:lcLetter")} vendorId={selectedRow.vendor.id} documentType="lc-letter" attachment={selectedRow.vendor.lcLetter} />
                  </div>
                </div>
              </div>

              {/* Status overview */}
              <div className="grid gap-3 md:grid-cols-3">
                <FieldRow label={t("common:approval")} value={<StatusBadge status={selectedRow.vendor.status} />} />
                <FieldRow label={t("common:followUpStatus")} value={<StatusBadge status={selectedRow.operationalStatus} />} />
                <FieldRow label={t("common:outstanding")} value={formatCurrency(selectedRow.totalOutstanding)} />
                <div className="md:col-span-3">
                  <FieldRow
                    label={t("common:nextPermitExpiry")}
                    value={selectedRow.nextPermitExpiry ? formatHumanDate(selectedRow.nextPermitExpiry.endDate) : t("common:noActivePermit")}
                  />
                </div>
              </div>

              <VendorActivityTimeline events={activityData?.events || []} isLoading={activityPending} />

              {/* Password reset */}
              {selectedRow.vendor.status === "approved" && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">{t("common:passwordReset")}</p>
                  <p className="text-slate-600">{t("vendor:passwordResetDesc")}</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-reason">{t("vendor:resetReason")}</Label>
                    <Textarea id="reset-reason" value={resetReason} onChange={(e) => setResetReason(e.target.value)} rows={2} />
                  </div>
                  {resetMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{resetMessage}</div>}
                  <Button variant="outline" onClick={() => resetVendorPassword.mutate({ vendorId: selectedRow.vendor.id, reason: resetReason })} disabled={resetVendorPassword.isPending || !resetReason.trim()}>
                    <KeyRound className="mr-1 h-4 w-4" />
                    {resetVendorPassword.isPending ? t("common:sending") : t("common:resetPassword")}
                  </Button>
                </div>
              )}

              {/* Decision panel */}
              {selectedRow.vendor.status === "pending" && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">{t("vendor:decisionPanel")}</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="manager-notes">{t("common:managerNotes")}</Label>
                    <Textarea id="manager-notes" value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reject-reason">{t("common:rejectReason")}</Label>
                    <Textarea id="reject-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-none"
                      onClick={() => approveVendor.mutate({ vendorId: selectedRow.vendor.id, notes: managerNotes })}
                      disabled={approveVendor.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {t("vendor:approveVendor")}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-lg shadow-none"
                      onClick={() => rejectVendor.mutate({ vendorId: selectedRow.vendor.id, reason: rejectionReason })}
                      disabled={rejectVendor.isPending || !rejectionReason.trim()}
                    >
                      <X className="mr-1 h-4 w-4" />
                      {t("vendor:rejectVendor")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Mobile close button */}
              <div className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white pt-3 sm:hidden">
                <button type="button" onClick={() => setSelectedVendorId(null)} className="flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900">
                  {t("common:close")}
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
};

export default VendorsPage;
