import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import type { Stall } from "@/types";

const emptyStallForm = {
  name: "",
  zone: "",
  size: "",
  pricePerMonth: 0,
};

const StallsPage = () => {
  const { role } = useAuth();
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

  const { data } = useQuery({
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
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to create stall."),
  });

  const updateStall = useMutation({
    mutationFn: (input: Parameters<typeof api.updateStall>[1] & { stallId: string }) =>
      api.updateStall(input.stallId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to update stall."),
  });

  const reserveStall = useMutation({
    mutationFn: () => api.reserveStall(selectedStall!.id, reservationDates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedStall(null);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to submit stall application."),
  });

  const stalls = data?.stalls || [];
  const zones = [...new Set(stalls.map((stall) => stall.zone))];
  const filtered = (filter === "all" ? stalls : stalls.filter((stall) => stall.zone === filter)).filter((stall) =>
    role === "vendor" ? stall.status === "inactive" : true,
  );

  const statusColors: Record<string, string> = {
    inactive: "border-success/40 bg-success/5",
    active: "border-primary/40 bg-primary/5",
    maintenance: "border-muted bg-muted/30",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Stall Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {stalls.filter((stall) => stall.status === "inactive").length} stalls available for application
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
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
          {role === "manager" && <Button onClick={() => setShowCreate(true)}>New Stall</Button>}
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((stall) => (
          <button
            key={stall.id}
            onClick={() => setSelectedStall(stall)}
            className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${statusColors[stall.status] || "border-border"}`}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="font-heading font-bold text-lg">{stall.name}</span>
              <StatusBadge status={stall.status} />
            </div>
            <p className="text-xs text-muted-foreground">{stall.zone}</p>
            <p className="text-xs text-muted-foreground">{stall.size}</p>
            <p className="font-medium text-sm mt-2">UGX {stall.pricePerMonth.toLocaleString()}/mo</p>
            {stall.vendorName && <p className="text-xs text-muted-foreground mt-1">{stall.vendorName}</p>}
          </button>
        ))}
      </div>

      <Dialog open={Boolean(selectedStall)} onOpenChange={() => setSelectedStall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Stall {selectedStall?.name}</DialogTitle>
            <DialogDescription>
              {selectedStall?.zone} - {selectedStall?.size}
            </DialogDescription>
          </DialogHeader>
          {selectedStall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedStall.status} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <p className="font-medium mt-1">UGX {selectedStall.pricePerMonth.toLocaleString()}</p>
                </div>
                {selectedStall.vendorName && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Assigned To</span>
                    <p className="font-medium mt-1">{selectedStall.vendorName}</p>
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
        </DialogContent>
      </Dialog>

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
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-success/30" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary/30" /> Occupied</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted" /> Maintenance</span>
      </div>
    </div>
  );
};

export default StallsPage;
