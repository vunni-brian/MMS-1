import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState, PageHeader } from "@/components/console/ConsolePage";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import type { Stall, StallStatus } from "@/types";

// ─── Types ───────────────────────────────────────────────
type AllocationStatus = "available" | "reserved" | "allocated";
type StatusFilter = "all" | AllocationStatus;

interface DisplayStall {
  id: string;
  name: string;
  row: string;
  status: AllocationStatus;
  stallStatus: StallStatus;
  vendorName?: string | null;
  original?: Stall;
}

// ─── Helpers ─────────────────────────────────────────────
const emptyStallForm = { name: "", zone: "", size: "", pricePerMonth: 0 };

const statusLabelKeys: Record<AllocationStatus, string> = {
  available: "stalls:available", reserved: "stalls:reserved", allocated: "stalls:allocated",
};

const statusClasses: Record<AllocationStatus, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300",
  reserved: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300",
  allocated: "border-red-200 bg-red-50 text-red-700 hover:border-red-300",
};

const toAllocationStatus = (status: StallStatus): AllocationStatus => {
  if (status === "active") return "allocated";
  if (status === "maintenance") return "reserved";
  return "available";
};

const rowFromName = (name: string, index: number) => {
  const match = name.match(/^([A-Za-z])/);
  return match ? match[1].toUpperCase() : ["A", "B", "C"][index % 3];
};

// ─── Page ─────────────────────────────────────────────────
const StallsPage = () => {
  const { t } = useTranslation();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("available");
  const [search, setSearch] = useState("");
  const [rowFilter, setRowFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [stallForm, setStallForm] = useState(emptyStallForm);
  const [selectedStall, setSelectedStall] = useState<DisplayStall | null>(null);

  const stallsQuery = useQuery({
    queryKey: ["stalls"],
    queryFn: () => api.getStalls(),
    refetchInterval: 30_000,
  });

  const vendorBookingsQuery = useQuery({
    queryKey: ["bookings", "stall-history"],
    queryFn: () => api.getBookings(),
    enabled: role === "vendor",
  });

  const createStall = useMutation({
    mutationFn: () => api.createStall(stallForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      setShowCreate(false);
      setStallForm(emptyStallForm);
      toast.success(t("stalls:stallCreated"), { description: t("stalls:stallCreatedDesc") });
    },
    onError: (error) => toast.error(t("stalls:stallNotCreated"), { description: error instanceof ApiError ? error.message : t("stalls:stallCreateError") }),
  });

  const updateStall = useMutation({
    mutationFn: (input: Parameters<typeof api.updateStall>[1] & { stallId: string }) => api.updateStall(input.stallId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      setSelectedStall(null);
      toast.success(t("stalls:stallUpdated"));
    },
    onError: (error) => toast.error(t("stalls:stallNotUpdated"), { description: error instanceof ApiError ? error.message : t("stalls:stallUpdateError") }),
  });

  const reserveStall = useMutation({
    mutationFn: ({ stallId, startDate, endDate }: { stallId: string; startDate: string; endDate: string }) =>
      api.reserveStall(stallId, { startDate, endDate }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedStall(null);
      toast.success(t("stalls:applicationSubmitted"), { description: t("stalls:applicationSubmittedDesc") });
    },
    onError: (error) => toast.error(t("stalls:applicationNotSubmitted"), { description: error instanceof ApiError ? error.message : t("stalls:applicationError") }),
  });

  const [reserveDates, setReserveDates] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const displayStalls = useMemo<DisplayStall[]>(() => {
    return (stallsQuery.data?.stalls || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((stall, index) => ({
        id: stall.id,
        name: stall.name,
        row: rowFromName(stall.name, index),
        status: toAllocationStatus(stall.status),
        stallStatus: stall.status,
        vendorName: stall.vendorName,
        original: stall,
      }));
  }, [stallsQuery.data?.stalls]);

  const rows = Array.from(new Set(displayStalls.map((s) => s.row))).sort();

  const filteredStalls = displayStalls.filter((stall) => {
    const statusOk = statusFilter === "all" || stall.status === statusFilter;
    const rowOk = rowFilter === "all" || stall.row === rowFilter;
    const searchOk = !search.trim() || stall.name.toLowerCase().includes(search.trim().toLowerCase());
    return statusOk && rowOk && searchOk;
  });

  const stallCounts = {
    all: displayStalls.length,
    available: displayStalls.filter((s) => s.status === "available").length,
    allocated: displayStalls.filter((s) => s.status === "allocated").length,
    reserved: displayStalls.filter((s) => s.status === "reserved").length,
  };

  if (stallsQuery.isError) {
    return (
      <PageLayout>
        <Alert variant="destructive" className="max-w-xl rounded-lg">
          <AlertTitle>{t("stalls:errorLoading")}</AlertTitle>
          <AlertDescription>{t("stalls:errorLoadingDesc")}</AlertDescription>
        </Alert>
      </PageLayout>
    );
  }

  if (stallsQuery.isPending) {
    return <PageLayout><LoadingState rows={6} itemClassName="h-28 rounded-lg" /></PageLayout>;
  }

  // ── Vendor view ───────────────────────────────────────
  if (role === "vendor") {
    const myStall = (stallsQuery.data?.stalls || []).find((s) => s.vendorName === user?.name && s.status === "active");

    return (
      <PageLayout>
        <PageHeader eyebrow={t("stalls:vendorEyebrow")} title={t("stalls:vendorTitle")} subtitle={t("stalls:vendorSubtitle")} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <CardTitle className="text-base font-medium">{t("stalls:currentStall")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
            {myStall ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-bold text-slate-950">{myStall.name}</h2>
                    <StatusBadge status="active" />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{myStall.zone} — {myStall.size}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t("stalls:monthlyDues")}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{formatCurrency(myStall.pricePerMonth)}</p>
                </div>
                <div className="grid gap-2 sm:w-52">
                  <Button className="rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold" onClick={() => navigate("/vendor/payments")}>{t("stalls:payDues")}</Button>
                  <Button variant="outline" className="rounded-lg border-slate-300 font-bold" onClick={() => navigate("/vendor/complaints")}>{t("stalls:reportIssue")}</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">{t("stalls:noActiveStall")}</p>
                <p className="mt-2 text-sm text-slate-500">{t("stalls:noActiveStallDesc")}</p>
                <Button className="mt-4 rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold" asChild>
                  <Link to="/vendor/stalls">{t("stalls:browseStalls")}</Link>
                </Button>
              </div>
            )}
          </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <CardTitle className="text-base font-medium">{t("stalls:stallInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
            {myStall ? (
              <div className="space-y-3 text-sm">
                {[
                  { label: t("stalls:stall"), value: myStall.name },
                  { label: t("stalls:zone"), value: myStall.zone },
                  { label: t("stalls:size"), value: myStall.size },
                  { label: t("common:market"), value: myStall.marketName || user?.marketName || t("common:assignedMarket") },
                  { label: t("stalls:monthlyDues"), value: formatCurrency(myStall.pricePerMonth) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {t("stalls:activeNote")}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("stalls:noAssignmentText")}</p>
            )}
          </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
            <CardTitle className="text-base font-medium">{t("stalls:stallHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
          {(() => {
            const bookings = vendorBookingsQuery.data?.bookings || [];
            const historyRows = bookings
              .filter((booking) => booking.status !== "pending")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            if (vendorBookingsQuery.isPending) {
              return <LoadingState rows={3} itemClassName="h-12 rounded-lg" />;
            }

            if (historyRows.length === 0) {
              return (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {t("stalls:noHistory")}
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {historyRows.map((booking) => {
                  const isCurrent = booking.status === "approved" && myStall?.name === booking.stallName;
                  const label = booking.status === "rejected" ? t("common:rejected") : isCurrent ? t("common:active") : t("stalls:ended");
                  return (
                    <div key={booking.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{t("stalls:stallName", { name: booking.stallName })}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatHumanDate(booking.startDate)} — {isCurrent ? t("stalls:present") : formatHumanDate(booking.endDate)}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} label={label} context="booking" />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
        </Card>
      </PageLayout>
    );
  }

  // ── Manager / official view ───────────────────────────
  return (
    <PageLayout>
      <PageHeader
        eyebrow={t("stalls:managerEyebrow")}
        title={t("stalls:managerTitle")}
        subtitle={user?.marketName || t("stalls:managerSubtitle")}
        actions={
          role === "manager" ? (
            <Button onClick={() => setShowCreate(true)} className="h-9 gap-2 rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold">
              <Plus className="h-4 w-4" />
              {t("stalls:addStall")}
            </Button>
          ) : undefined
        }
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("stalls:totalStalls"), value: stallCounts.all, tone: "slate" as const },
          { label: t("stalls:filterAvailable"), value: stallCounts.available, tone: "green" as const },
          { label: t("stalls:filterAllocated"), value: stallCounts.allocated, tone: "red" as const },
          { label: t("stalls:reservedMaintenance"), value: stallCounts.reserved, tone: "amber" as const },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 font-heading">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + grid */}
      <Card>
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <CardTitle className="text-base font-medium">{t("stalls:stallMap")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
        {/* Controls */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {([{ id: "all", labelKey: "stalls:filterAll" }, { id: "available", labelKey: "stalls:filterAvailable" }, { id: "allocated", labelKey: "stalls:filterAllocated" }, { id: "reserved", labelKey: "stalls:filterReserved" }] as const).map((tab) => (
              <button key={tab.id} type="button" onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`h-8 rounded-lg px-3 text-xs font-bold transition-colors ${statusFilter === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("stalls:searchStall")} className="h-9 pl-9 w-full border-slate-300 rounded-lg sm:w-52 focus-visible:border-primary focus-visible:ring-0" />
            </div>
            <select aria-label="Filter by row" value={rowFilter} onChange={(e) => setRowFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
              <option value="all">{t("stalls:allRows")}</option>
              {rows.map((row) => <option key={row} value={row}>{t("stalls:row", { letter: row })}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        {filteredStalls.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {t("stalls:noStallsMatch")}
          </div>
        ) : (
          <div className="space-y-5">
            {rows.map((row) => {
              const rowStalls = filteredStalls.filter((s) => s.row === row);
              if (!rowStalls.length) return null;
              return (
                <div key={row} className="grid gap-3 lg:grid-cols-[64px_minmax(0,1fr)] lg:items-start">
                  <p className="text-sm font-bold text-slate-600 pt-2">{t("stalls:row", { letter: row })}</p>
                  <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 xl:grid-cols-6">
                    {rowStalls.map((stall) => (
                      <button key={stall.id} type="button"
                        onClick={() => role === "manager" ? setSelectedStall(stall) : undefined}
                        className={`min-h-[72px] rounded-lg border p-2.5 text-center transition-colors ${statusClasses[stall.status]} ${role === "manager" ? "cursor-pointer" : "cursor-default"}`}>
                        <p className="text-sm font-bold text-slate-900">{stall.name}</p>
                        <p className="mt-1 text-[11px] font-semibold">{t(statusLabelKeys[stall.status])}</p>
                        {stall.vendorName && <p className="mt-0.5 truncate text-[10px] text-slate-500">{stall.vendorName}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-lg bg-emerald-500" />{t("stalls:available")}</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-lg bg-amber-400" />{t("stalls:reserved")}</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-lg bg-red-500" />{t("stalls:allocated")}</span>
        </div>
        </CardContent>
      </Card>

      {/* Stall detail dialog (manager) */}
      <Dialog open={Boolean(selectedStall)} onOpenChange={(open) => !open && setSelectedStall(null)}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">{t("stalls:stallDialog", { name: selectedStall?.name })}</DialogTitle>
            <DialogDescription>{t("stalls:stallDialogDesc")}</DialogDescription>
          </DialogHeader>
          {selectedStall?.original && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: t("stalls:zone"), value: selectedStall.original.zone },
                  { label: t("stalls:size"), value: selectedStall.original.size },
                  { label: t("stalls:monthlyRent"), value: formatCurrency(selectedStall.original.pricePerMonth) },
                  { label: t("common:status"), value: <StatusBadge status={selectedStall.status} /> },
                  { label: t("stalls:assignedTo"), value: selectedStall.original.vendorName || t("stalls:noVendor") },
                  { label: t("stalls:published"), value: selectedStall.original.isPublished ? t("stalls:yes") : t("stalls:hidden") },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {selectedStall.stallStatus !== "active" && (
                  <Button variant="outline" className="w-full rounded-lg border-slate-300 font-bold"
                    onClick={() => updateStall.mutate({ stallId: selectedStall.id, status: selectedStall.stallStatus === "maintenance" ? "inactive" : "maintenance" })}
                    disabled={updateStall.isPending}>
                    {selectedStall.stallStatus === "maintenance" ? t("stalls:restoreAvailability") : t("stalls:markMaintenance")}
                  </Button>
                )}
                <Button variant="outline" className="w-full rounded-lg border-slate-300 font-bold"
                  onClick={() => updateStall.mutate({ stallId: selectedStall.id, isPublished: !selectedStall.original!.isPublished })}
                  disabled={updateStall.isPending}>
                  {selectedStall.original.isPublished ? t("stalls:unpublish") : t("stalls:publish")}
                </Button>
                {selectedStall.stallStatus === "active" && (
                  <p className="text-xs text-slate-500 text-center">{t("stalls:occupiedNote")}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add stall dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">{t("stalls:addStallDialog")}</DialogTitle>
            <DialogDescription>{t("stalls:addStallDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stall-number" className="font-bold text-slate-700">{t("stalls:stallNumber")}</Label>
              <Input id="stall-number" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={stallForm.name} onChange={(e) => setStallForm((c) => ({ ...c, name: e.target.value }))} placeholder={t("stalls:stallNumberPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stall-zone" className="font-bold text-slate-700">{t("stalls:sectionZone")}</Label>
              <Input id="stall-zone" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={stallForm.zone} onChange={(e) => setStallForm((c) => ({ ...c, zone: e.target.value }))} placeholder={t("stalls:sectionZonePlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stall-size" className="font-bold text-slate-700">{t("stalls:size")}</Label>
                <Input id="stall-size" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={stallForm.size} onChange={(e) => setStallForm((c) => ({ ...c, size: e.target.value }))} placeholder={t("stalls:sizePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stall-rent" className="font-bold text-slate-700">{t("stalls:monthlyRentLabel")}</Label>
                <Input id="stall-rent" type="number" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={stallForm.pricePerMonth} onChange={(e) => setStallForm((c) => ({ ...c, pricePerMonth: Number(e.target.value) }))} />
              </div>
            </div>
            <Button className="w-full rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold" disabled={createStall.isPending || !stallForm.name.trim() || !stallForm.zone.trim()} onClick={() => createStall.mutate()}>
              {createStall.isPending ? t("common:saving") : t("stalls:saveStall")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default StallsPage;
