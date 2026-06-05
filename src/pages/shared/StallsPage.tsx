import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/console/ConsolePage";
import { MockupHeader, MockupPage, MockupPanel, StatusPill } from "@/components/mockup/MockupUI";
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

const statusLabel: Record<AllocationStatus, string> = {
  available: "Available", reserved: "Reserved", allocated: "Allocated",
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

  const createStall = useMutation({
    mutationFn: () => api.createStall(stallForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      setShowCreate(false);
      setStallForm(emptyStallForm);
      toast.success("Stall created", { description: "The stall is now part of the market inventory." });
    },
    onError: (error) => toast.error("Stall was not created", { description: error instanceof ApiError ? error.message : "Unable to create stall." }),
  });

  const updateStall = useMutation({
    mutationFn: (input: Parameters<typeof api.updateStall>[1] & { stallId: string }) => api.updateStall(input.stallId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      setSelectedStall(null);
      toast.success("Stall updated");
    },
    onError: (error) => toast.error("Stall was not updated", { description: error instanceof ApiError ? error.message : "Unable to update stall." }),
  });

  const reserveStall = useMutation({
    mutationFn: ({ stallId, startDate, endDate }: { stallId: string; startDate: string; endDate: string }) =>
      api.reserveStall(stallId, { startDate, endDate }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedStall(null);
      toast.success("Application submitted", { description: "The market manager will review the stall application." });
    },
    onError: (error) => toast.error("Application was not submitted", { description: error instanceof ApiError ? error.message : "Unable to submit stall application." }),
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
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl rounded-sm">
          <AlertTitle>Error loading stalls</AlertTitle>
          <AlertDescription>There was a problem reaching the server.</AlertDescription>
        </Alert>
      </MockupPage>
    );
  }

  if (stallsQuery.isPending) {
    return <MockupPage><LoadingState rows={6} itemClassName="h-28 rounded-sm" /></MockupPage>;
  }

  // ── Vendor view ───────────────────────────────────────
  if (role === "vendor") {
    const myStall = (stallsQuery.data?.stalls || []).find((s) => s.vendorName === user?.name && s.status === "active");

    return (
      <MockupPage>
        <MockupHeader eyebrow="My Stall" title="My Stall" subtitle="Your current stall assignment, dues, and availability." />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <MockupPanel title="Current Stall">
            {myStall ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-bold text-slate-950">{myStall.name}</h2>
                    <StatusPill tone="green">Active</StatusPill>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{myStall.zone} — {myStall.size}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Monthly dues</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{formatCurrency(myStall.pricePerMonth)}</p>
                </div>
                <div className="grid gap-2 sm:w-52">
                  <Button className="rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold" onClick={() => navigate("/vendor/payments")}>Pay Dues</Button>
                  <Button variant="outline" className="rounded-sm border-slate-300 font-bold" onClick={() => navigate("/vendor/complaints")}>Report Issue</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No active stall assignment</p>
                <p className="mt-2 text-sm text-slate-500">Browse available stalls and submit an application to get started.</p>
                <Button className="mt-4 rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold" asChild>
                  <Link to="/vendor/stalls">Browse Available Stalls</Link>
                </Button>
              </div>
            )}
          </MockupPanel>

          <MockupPanel title="Stall Information">
            {myStall ? (
              <div className="space-y-3 text-sm">
                {[
                  { label: "Stall", value: myStall.name },
                  { label: "Zone", value: myStall.zone },
                  { label: "Size", value: myStall.size },
                  { label: "Market", value: myStall.marketName || user?.marketName || "Assigned market" },
                  { label: "Monthly dues", value: formatCurrency(myStall.pricePerMonth) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-sm border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
                <div className="mt-2 rounded-sm border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Assignment is active and eligible for monthly dues payment.
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Stall details will appear here once you have an active assignment.</p>
            )}
          </MockupPanel>
        </div>
      </MockupPage>
    );
  }

  // ── Manager / official view ───────────────────────────
  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Stalls > Allocation"
        title="Stall Allocation"
        subtitle={user?.marketName || "Manage stall availability and assignments."}
        actions={
          role === "manager" ? (
            <Button onClick={() => setShowCreate(true)} className="h-9 gap-2 rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold">
              <Plus className="h-4 w-4" />
              Add Stall
            </Button>
          ) : undefined
        }
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total stalls", value: stallCounts.all, tone: "slate" as const },
          { label: "Available", value: stallCounts.available, tone: "green" as const },
          { label: "Allocated", value: stallCounts.allocated, tone: "red" as const },
          { label: "Reserved / maintenance", value: stallCounts.reserved, tone: "amber" as const },
        ].map((item) => (
          <div key={item.label} className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 font-heading">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + grid */}
      <MockupPanel title="Stall Map">
        {/* Controls */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-sm border border-slate-200 bg-slate-50 p-1">
            {([{ id: "all", label: "All" }, { id: "available", label: "Available" }, { id: "allocated", label: "Allocated" }, { id: "reserved", label: "Reserved" }] as const).map((tab) => (
              <button key={tab.id} type="button" onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`h-8 rounded-sm px-3 text-xs font-bold transition-colors ${statusFilter === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stall..." className="h-9 pl-9 w-full border-slate-300 rounded-sm sm:w-52 focus-visible:border-primary focus-visible:ring-0" />
            </div>
            <select value={rowFilter} onChange={(e) => setRowFilter(e.target.value)} className="h-9 rounded-sm border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
              <option value="all">All Rows</option>
              {rows.map((row) => <option key={row} value={row}>Row {row}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        {filteredStalls.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
            No stalls match the current filters.
          </div>
        ) : (
          <div className="space-y-5">
            {rows.map((row) => {
              const rowStalls = filteredStalls.filter((s) => s.row === row);
              if (!rowStalls.length) return null;
              return (
                <div key={row} className="grid gap-3 lg:grid-cols-[64px_minmax(0,1fr)] lg:items-start">
                  <p className="text-sm font-bold text-slate-600 pt-2">Row {row}</p>
                  <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 xl:grid-cols-6">
                    {rowStalls.map((stall) => (
                      <button key={stall.id} type="button"
                        onClick={() => role === "manager" ? setSelectedStall(stall) : undefined}
                        className={`min-h-[72px] rounded-sm border p-2.5 text-center transition-colors ${statusClasses[stall.status]} ${role === "manager" ? "cursor-pointer" : "cursor-default"}`}>
                        <p className="text-sm font-bold text-slate-900">{stall.name}</p>
                        <p className="mt-1 text-[11px] font-semibold">{statusLabel[stall.status]}</p>
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
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Available</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-400" />Reserved</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-500" />Allocated</span>
        </div>
      </MockupPanel>

      {/* Stall detail dialog (manager) */}
      <Dialog open={Boolean(selectedStall)} onOpenChange={(open) => !open && setSelectedStall(null)}>
        <DialogContent className="rounded-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">Stall {selectedStall?.name}</DialogTitle>
            <DialogDescription>Manage availability and publication for this stall.</DialogDescription>
          </DialogHeader>
          {selectedStall?.original && (
            <div className="space-y-4">
              <div className="rounded-sm border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: "Zone", value: selectedStall.original.zone },
                  { label: "Size", value: selectedStall.original.size },
                  { label: "Monthly rent", value: formatCurrency(selectedStall.original.pricePerMonth) },
                  { label: "Status", value: <StatusPill tone={selectedStall.status === "available" ? "green" : selectedStall.status === "allocated" ? "red" : "amber"}>{statusLabel[selectedStall.status]}</StatusPill> },
                  { label: "Assigned to", value: selectedStall.original.vendorName || "—" },
                  { label: "Published", value: selectedStall.original.isPublished ? "Yes" : "Hidden" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {selectedStall.stallStatus !== "active" && (
                  <Button variant="outline" className="w-full rounded-sm border-slate-300 font-bold"
                    onClick={() => updateStall.mutate({ stallId: selectedStall.id, status: selectedStall.stallStatus === "maintenance" ? "inactive" : "maintenance" })}
                    disabled={updateStall.isPending}>
                    {selectedStall.stallStatus === "maintenance" ? "Restore Availability" : "Mark as Maintenance"}
                  </Button>
                )}
                <Button variant="outline" className="w-full rounded-sm border-slate-300 font-bold"
                  onClick={() => updateStall.mutate({ stallId: selectedStall.id, isPublished: !selectedStall.original!.isPublished })}
                  disabled={updateStall.isPending}>
                  {selectedStall.original.isPublished ? "Unpublish Stall" : "Publish Stall"}
                </Button>
                {selectedStall.stallStatus === "active" && (
                  <p className="text-xs text-slate-400 text-center">Occupied stalls are released through booking review outcomes, not manual changes.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add stall dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">Add Stall</DialogTitle>
            <DialogDescription>Add a stall to the market inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Stall Number</Label>
              <Input className="border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" value={stallForm.name} onChange={(e) => setStallForm((c) => ({ ...c, name: e.target.value }))} placeholder="A-07" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Section / Zone</Label>
              <Input className="border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" value={stallForm.zone} onChange={(e) => setStallForm((c) => ({ ...c, zone: e.target.value }))} placeholder="Row A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Size</Label>
                <Input className="border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" value={stallForm.size} onChange={(e) => setStallForm((c) => ({ ...c, size: e.target.value }))} placeholder="3m × 3m" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Monthly Rent</Label>
                <Input type="number" className="border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" value={stallForm.pricePerMonth} onChange={(e) => setStallForm((c) => ({ ...c, pricePerMonth: Number(e.target.value) }))} />
              </div>
            </div>
            <Button className="w-full rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold" disabled={createStall.isPending || !stallForm.name.trim() || !stallForm.zone.trim()} onClick={() => createStall.mutate()}>
              {createStall.isPending ? "Saving..." : "Save Stall"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MockupPage>
  );
};

export default StallsPage;
