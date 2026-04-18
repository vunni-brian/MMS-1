import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Grid3X3, Store, Wrench, AlertCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConsolePage, DetailSheet, EmptyState, EvidenceField, KpiStrip, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import type { Stall } from "@/types";

const emptyStallForm = {
  name: "",
  zone: "",
  size: "",
  pricePerMonth: 0,
};

const StallsPage = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [stallForm, setStallForm] = useState(emptyStallForm);
  const [reservationDates, setReservationDates] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
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
      setError(null);
      toast.success("Stall created", { description: "The stall is now part of the market inventory." });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof ApiError ? mutationError.message : "Unable to create stall.";
      setError(message);
      toast.error("Stall was not created", { description: message });
    },
  });

  const updateStall = useMutation({
    mutationFn: (input: Parameters<typeof api.updateStall>[1] & { stallId: string }) =>
      api.updateStall(input.stallId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setError(null);
      toast.success("Stall updated");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof ApiError ? mutationError.message : "Unable to update stall.";
      setError(message);
      toast.error("Stall was not updated", { description: message });
    },
  });

  const reserveStall = useMutation({
    mutationFn: () => api.reserveStall(selectedStall!.id, reservationDates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedStall(null);
      setError(null);
      toast.success("Application submitted", {
        description: "The market manager will review the stall application.",
      });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof ApiError ? mutationError.message : "Unable to submit stall application.";
      setError(message);
      toast.error("Application was not submitted", { description: message });
    },
  });

  const stalls = data?.stalls || [];
  const zones = [...new Set(stalls.map((stall) => stall.zone))];
  const filtered = (filter === "all" ? stalls : stalls.filter((stall) => stall.zone === filter)).filter((stall) =>
    role === "vendor" ? stall.status === "inactive" : true,
  );
  const availableStalls = stalls.filter((stall) => stall.status === "inactive").length;
  const occupiedStalls = stalls.filter((stall) => stall.status === "active").length;
  const maintenanceStalls = stalls.filter((stall) => stall.status === "maintenance").length;
  const visibleInventoryValue = filtered.reduce((sum, stall) => sum + stall.pricePerMonth, 0);
  const stallKpis = [
    { label: "Available", value: availableStalls, detail: "Open for vendor application", icon: CheckCircle2, tone: "success" as const },
    { label: "Occupied", value: occupiedStalls, detail: "Currently assigned stalls", icon: Store, tone: "info" as const },
    { label: "Maintenance", value: maintenanceStalls, detail: "Not available for booking", icon: Wrench, tone: maintenanceStalls ? "warning" as const : "default" as const },
    { label: "Visible Monthly Value", value: formatCurrency(visibleInventoryValue), detail: "Based on current filter", icon: Grid3X3, tone: "default" as const },
  ];

  const statusColors: Record<string, string> = {
    inactive: "border-border bg-card",
    active: "border-border bg-card",
    maintenance: "border-muted bg-muted/30",
  };

  return (
    <ConsolePage>
      <PageHeader
        eyebrow={role === "vendor" ? "Stall marketplace" : "Market inventory"}
        title="Stall Management"
        description={role === "vendor" ? "Find available stalls, inspect the rent and location, then submit an application for manager review." : "Manage stall availability, publication, maintenance state, and vendor allocation from one inventory workspace."}
        actions={role === "manager" && <Button onClick={() => setShowCreate(true)}>New Stall</Button>}
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">Market: {user?.marketName || "Current scope"}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{availableStalls} available for application</span>
          </>
        }
      />

      <ScopeBar>
        <ScopeItem label="Zone filter" className="w-full sm:w-[220px]">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ScopeItem>
        <ScopeItem label="Role context">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm capitalize">{role}</div>
        </ScopeItem>
        <ScopeItem label="Primary action">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">{role === "vendor" ? "Apply for an available stall" : "Keep stall inventory accurate"}</div>
        </ScopeItem>
      </ScopeBar>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {isError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading stalls</AlertTitle>
          <AlertDescription>There was a problem reaching the server. Please check your connection.</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <>
          <KpiStrip items={stallKpis} />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.length === 0 ? (
              <div className="col-span-full">
                <EmptyState title="No stalls match this view" description={role === "vendor" ? "Try another zone or check back after the manager publishes more stalls." : "Adjust the zone filter or create a new stall for this market."} />
              </div>
            ) : filtered.map((stall) => (
              <button
                key={stall.id}
                onClick={() => setSelectedStall(stall)}
                className={`text-left p-4 rounded-lg border transition-colors duration-150 hover:bg-muted/40 ${statusColors[stall.status] || "border-border"}`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-heading font-bold text-lg">{stall.name}</span>
                  <StatusBadge status={stall.status} />
                </div>
                <p className="text-xs text-muted-foreground">{stall.zone}</p>
                {stall.marketName && <p className="text-xs text-muted-foreground">{stall.marketName}</p>}
                <p className="text-xs text-muted-foreground">{stall.size}</p>
                <p className="font-medium text-sm mt-2">{formatCurrency(stall.pricePerMonth)}/mo</p>
                {stall.vendorName && <p className="text-xs text-muted-foreground mt-1">{stall.vendorName}</p>}
              </button>
            ))}
          </div>
        </>
      )}

      <DetailSheet
        open={Boolean(selectedStall)}
        onOpenChange={(open) => !open && setSelectedStall(null)}
        title={`Stall ${selectedStall?.name || ""}`}
        description={selectedStall ? `${selectedStall.zone} - ${selectedStall.size}` : undefined}
      >
          {selectedStall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <EvidenceField label="Status" value={<StatusBadge status={selectedStall.status} />} />
                <EvidenceField label="Monthly Rent" value={formatCurrency(selectedStall.pricePerMonth)} />
                <EvidenceField label="Market" value={selectedStall.marketName || "Current market"} />
                <EvidenceField label="Publication" value={selectedStall.isPublished ? "Published" : "Unpublished"} />
                {selectedStall.vendorName && (
                  <div className="col-span-2">
                    <EvidenceField label="Assigned To" value={selectedStall.vendorName} />
                  </div>
                )}
              </div>

              {role === "vendor" && selectedStall.status === "inactive" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Submit an application. The market manager will review it before the stall becomes active on your dashboard.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={reservationDates.startDate}
                        onChange={(event) => setReservationDates((current) => ({ ...current, startDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={reservationDates.endDate}
                        onChange={(event) => setReservationDates((current) => ({ ...current, endDate: event.target.value }))}
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => reserveStall.mutate()} disabled={reserveStall.isPending}>
                    Apply for This Stall
                  </Button>
                </div>
              )}

              {role === "manager" && (
                <div className="space-y-2">
                  {selectedStall.status !== "active" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        updateStall.mutate({
                          stallId: selectedStall.id,
                          status: selectedStall.status === "maintenance" ? "inactive" : "maintenance",
                        })
                      }
                    >
                      {selectedStall.status === "maintenance" ? "Restore Availability" : "Mark as Maintenance"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      updateStall.mutate({
                        stallId: selectedStall.id,
                        isPublished: !selectedStall.isPublished,
                      })
                    }
                  >
                    {selectedStall.isPublished ? "Unpublish Stall" : "Publish Stall"}
                  </Button>
                  {selectedStall.status === "active" && (
                    <p className="text-xs text-muted-foreground">
                      Occupied stalls are released through booking review outcomes or vendor transfer, not manual status changes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
      </DetailSheet>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Create Stall</DialogTitle>
            <DialogDescription>Add a stall to the market inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stallName">Stall Name</Label>
              <Input id="stallName" value={stallForm.name} onChange={(event) => setStallForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stallZone">Zone</Label>
              <Input id="stallZone" value={stallForm.zone} onChange={(event) => setStallForm((current) => ({ ...current, zone: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stallSize">Size</Label>
                <Input id="stallSize" value={stallForm.size} onChange={(event) => setStallForm((current) => ({ ...current, size: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stallPrice">Monthly Price</Label>
                <Input
                  id="stallPrice"
                  type="number"
                  value={stallForm.pricePerMonth}
                  onChange={(event) => setStallForm((current) => ({ ...current, pricePerMonth: Number(event.target.value) }))}
                />
              </div>
            </div>
            <Button onClick={() => createStall.mutate()} disabled={createStall.isPending}>
              Save Stall
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-success/60" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted-foreground/35" /> Occupied</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted" /> Maintenance</span>
      </div>
    </ConsolePage>
  );
};

export default StallsPage;
