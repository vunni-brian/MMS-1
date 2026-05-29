import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/console/ConsolePage";
import { MockupHeader, MockupPage, SelectShell } from "@/components/mockup/MockupUI";
import { toast } from "@/components/ui/sonner";
import type { Stall, StallStatus } from "@/types";

type AllocationStatus = "available" | "reserved" | "allocated";
type StatusFilter = "all" | AllocationStatus;

interface DisplayStall {
  id: string;
  name: string;
  row: string;
  status: AllocationStatus;
  vendorName?: string | null;
  original?: Stall;
}

const emptyStallForm = {
  name: "",
  zone: "",
  size: "",
  pricePerMonth: 0,
};

const fallbackStalls: DisplayStall[] = [
  { id: "A-01", name: "A-01", row: "A", status: "available" },
  { id: "A-02", name: "A-02", row: "A", status: "available" },
  { id: "A-03", name: "A-03", row: "A", status: "reserved" },
  { id: "A-04", name: "A-04", row: "A", status: "available" },
  { id: "A-05", name: "A-05", row: "A", status: "allocated" },
  { id: "A-06", name: "A-06", row: "A", status: "available" },
  { id: "B-01", name: "B-01", row: "B", status: "available" },
  { id: "B-02", name: "B-02", row: "B", status: "available" },
  { id: "B-03", name: "B-03", row: "B", status: "available" },
  { id: "B-04", name: "B-04", row: "B", status: "allocated" },
  { id: "B-05", name: "B-05", row: "B", status: "available" },
  { id: "B-06", name: "B-06", row: "B", status: "available" },
  { id: "C-01", name: "C-01", row: "C", status: "reserved" },
  { id: "C-02", name: "C-02", row: "C", status: "available" },
  { id: "C-03", name: "C-03", row: "C", status: "available" },
  { id: "C-04", name: "C-04", row: "C", status: "available" },
  { id: "C-05", name: "C-05", row: "C", status: "available" },
  { id: "C-06", name: "C-06", row: "C", status: "allocated" },
];

const statusLabel: Record<AllocationStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  allocated: "Allocated",
};

const statusClasses: Record<AllocationStatus, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reserved: "border-amber-200 bg-amber-50 text-amber-700",
  allocated: "border-red-200 bg-red-50 text-red-700",
};

const toAllocationStatus = (status: StallStatus): AllocationStatus => {
  if (status === "active") return "allocated";
  if (status === "maintenance") return "reserved";
  return "available";
};

const rowFromName = (name: string, index: number) => {
  const match = name.match(/^([A-Za-z])/);
  if (match) return match[1].toUpperCase();
  return ["A", "B", "C"][index % 3];
};

const StallsPage = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("available");
  const [search, setSearch] = useState("");
  const [rowFilter, setRowFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [stallForm, setStallForm] = useState(emptyStallForm);

  const stallsQuery = useQuery({
    queryKey: ["stalls"],
    queryFn: () => api.getStalls(),
    refetchInterval: 10_000,
  });

  const createStall = useMutation({
    mutationFn: () => api.createStall(stallForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      setShowCreate(false);
      setStallForm(emptyStallForm);
      toast.success("Stall created");
    },
    onError: (error) => {
      toast.error("Stall was not created", {
        description: error instanceof ApiError ? error.message : "Unable to create stall.",
      });
    },
  });

  const displayStalls = useMemo<DisplayStall[]>(() => {
    const realStalls = (stallsQuery.data?.stalls || [])
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 18)
      .map((stall, index) => ({
        id: stall.id,
        name: stall.name,
        row: rowFromName(stall.name, index),
        status: toAllocationStatus(stall.status),
        vendorName: stall.vendorName,
        original: stall,
      }));

    if (realStalls.length >= 18) return realStalls;

    const usedNames = new Set(realStalls.map((stall) => stall.name));
    const filler = fallbackStalls.filter((stall) => !usedNames.has(stall.name)).slice(0, 18 - realStalls.length);
    return [...realStalls, ...filler].sort((left, right) => left.name.localeCompare(right.name));
  }, [stallsQuery.data?.stalls]);

  const rows = Array.from(new Set(displayStalls.map((stall) => stall.row))).sort();
  const filteredStalls = displayStalls.filter((stall) => {
    const statusOk = statusFilter === "all" || stall.status === statusFilter;
    const rowOk = rowFilter === "all" || stall.row === rowFilter;
    const searchOk = !search.trim() || stall.name.toLowerCase().includes(search.trim().toLowerCase());
    return statusOk && rowOk && searchOk;
  });

  if (stallsQuery.isError) {
    return (
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Error loading stalls</AlertTitle>
          <AlertDescription>There was a problem reaching the server.</AlertDescription>
        </Alert>
      </MockupPage>
    );
  }

  if (stallsQuery.isPending) {
    return (
      <MockupPage>
        <LoadingState rows={6} itemClassName="h-28 rounded-lg" />
      </MockupPage>
    );
  }

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Stalls > Allocation"
        title="Stall Allocation"
        subtitle={user?.marketName || "Manage stall availability and assignments."}
        actions={
          role === "manager" ? (
            <Button onClick={() => setShowCreate(true)} className="h-9 gap-2">
              <Plus className="h-4 w-4" />
              Add Stall
            </Button>
          ) : null
        }
      />

      <div className="enterprise-panel rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Stalls" },
              { id: "available", label: "Available" },
              { id: "allocated", label: "Allocated" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`h-9 rounded-md px-3 text-xs font-semibold ${
                  statusFilter === tab.id ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by stall no..."
                className="h-9 w-full pl-9 sm:w-64"
              />
            </div>
            <SelectShell className="w-full sm:w-36">All Sections</SelectShell>
            <select
              value={rowFilter}
              onChange={(event) => setRowFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm"
            >
              <option value="all">All Rows</option>
              {rows.map((row) => (
                <option key={row} value={row}>Row {row}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {rows.map((row) => {
            const rowStalls = filteredStalls.filter((stall) => stall.row === row);
            if (rowStalls.length === 0) return null;

            return (
              <div key={row} className="grid gap-3 lg:grid-cols-[70px_minmax(0,1fr)] lg:items-center">
                <p className="text-sm font-bold text-slate-700">Row {row}</p>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {rowStalls.map((stall) => (
                    <button
                      key={stall.id}
                      type="button"
                      className={`min-h-[76px] rounded-md border p-3 text-center transition-colors ${statusClasses[stall.status]}`}
                    >
                      <p className="text-sm font-bold text-slate-900">{stall.name}</p>
                      <p className="mt-1 text-xs font-semibold">{statusLabel[stall.status]}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Available</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-400" />Reserved</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-500" />Allocated</span>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Stall</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stallName">Stall Number</Label>
              <Input
                id="stallName"
                value={stallForm.name}
                onChange={(event) => setStallForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="A-07"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stallZone">Section</Label>
              <Input
                id="stallZone"
                value={stallForm.zone}
                onChange={(event) => setStallForm((current) => ({ ...current, zone: event.target.value }))}
                placeholder="Row A"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stallSize">Size</Label>
                <Input
                  id="stallSize"
                  value={stallForm.size}
                  onChange={(event) => setStallForm((current) => ({ ...current, size: event.target.value }))}
                  placeholder="3m x 3m"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stallPrice">Monthly Rent</Label>
                <Input
                  id="stallPrice"
                  type="number"
                  value={stallForm.pricePerMonth}
                  onChange={(event) => setStallForm((current) => ({ ...current, pricePerMonth: Number(event.target.value) }))}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={createStall.isPending || !stallForm.name.trim() || !stallForm.zone.trim()}
              onClick={() => createStall.mutate()}
            >
              Save Stall
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MockupPage>
  );
};

export default StallsPage;
