import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ConsolePage,
  DetailSheet,
  EmptyState,
  EvidenceField,
  PageHeader,
} from "@/components/console/ConsolePage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
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
      toast.success("Stall created", {
        description: "The stall is now part of the market inventory.",
      });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Unable to create stall.";
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
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Unable to update stall.";
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
      const message =
        mutationError instanceof ApiError
          ? mutationError.message
          : "Unable to submit stall application.";
      setError(message);
      toast.error("Application was not submitted", { description: message });
    },
  });

  const stalls = data?.stalls || [];
  const zones = [...new Set(stalls.map((stall) => stall.zone))];

  const filtered = (filter === "all" ? stalls : stalls.filter((stall) => stall.zone === filter))
    .filter((stall) => (role === "vendor" ? stall.status === "inactive" : true));

  const availableStalls = stalls.filter((stall) => stall.status === "inactive").length;

  const statusColors: Record<string, string> = {
    inactive: "border-success/30 bg-success/5",   // available — green makes sense here
    active:   "border-primary/25 bg-primary/5",   // occupied — blue/primary, not plain
    maintenance: "border-warning/30 bg-warning/5", // maintenance — amber
  };

  return (
    <ConsolePage>
      <PageHeader
        eyebrow={role === "vendor" ? "Stall marketplace" : "Market inventory"}
        title="Stalls"
        description={role === "vendor" ? "Available stalls, pricing, and application status." : "Inventory, allocation, and availability controls."}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[190px]">
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
        }
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">
              Market: {user?.marketName || "Current scope"}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">
              {availableStalls} available for application
            </span>
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading stalls</AlertTitle>
          <AlertDescription>
            There was a problem reaching the server. Please check your connection.
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <section className="stall-inventory-surface">
          <div className="stall-inventory-grid">
            {filtered.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  title="No stalls match this view"
                  description={
                    role === "vendor"
                      ? "Try another zone or check back after the manager publishes more stalls."
                      : "Adjust the zone filter or create a new stall for this market."
                  }
                />
              </div>
            ) : (
              filtered.map((stall) => (
                <button
                  key={stall.id}
                  onClick={() => setSelectedStall(stall)}
                  className={`group rounded-lg border p-3 text-left transition-colors duration-150 hover:bg-muted/30 ${statusColors[stall.status] || "border-border bg-card"
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold font-heading">{stall.name}</p>
                    <StatusBadge status={stall.status} />
                  </div>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {stall.zone} - {stall.marketName || "Market"}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {stall.size}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <p className="truncate text-base font-bold font-heading">
                      {formatCurrency(stall.pricePerMonth)}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">/month</span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {stall.vendorName ? (
                      <span className="truncate">{stall.vendorName}</span>
                    ) : (
                      <span className="font-medium text-success">Available</span>
                    )}

                    {!stall.isPublished && (
                      <span className="shrink-0 rounded border border-border/70 px-2 py-0.5 text-[10px]">
                        Hidden
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      <DetailSheet
        open={Boolean(selectedStall)}
        onOpenChange={(open) => !open && setSelectedStall(null)}
        title={`Stall ${selectedStall?.name || ""}`}
        description={selectedStall ? `${selectedStall.zone} - ${selectedStall.size}` : undefined}
      >
        {selectedStall && (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <EvidenceField label="Status" value={<StatusBadge status={selectedStall.status} />} />
              <EvidenceField
                label="Monthly Rent"
                value={formatCurrency(selectedStall.pricePerMonth)}
              />
              <EvidenceField label="Market" value={selectedStall.marketName || "Current market"} />
              <EvidenceField
                label="Publication"
                value={selectedStall.isPublished ? "Published" : "Unpublished"}
              />
              {selectedStall.vendorName && (
                <div className="sm:col-span-2">
                  <EvidenceField label="Assigned To" value={selectedStall.vendorName} />
                </div>
              )}
            </div>

            {role === "vendor" && selectedStall.status === "inactive" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Submit an application. The market manager will review it before the stall becomes
                  active on your dashboard.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={reservationDates.startDate}
                      onChange={(event) =>
                        setReservationDates((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={reservationDates.endDate}
                      onChange={(event) =>
                        setReservationDates((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => reserveStall.mutate()}
                  disabled={reserveStall.isPending}
                >
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
                    {selectedStall.status === "maintenance"
                      ? "Restore Availability"
                      : "Mark as Maintenance"}
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
                    Occupied stalls are released through booking review outcomes or vendor transfer,
                    not manual status changes.
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
              <Input
                id="stallName"
                value={stallForm.name}
                onChange={(event) =>
                  setStallForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

          <div className="space-y-1.5">
              <Label htmlFor="stallZone">Zone</Label>
              {zones.length > 0 ? (
                <Select
                  value={stallForm.zone}
                  onValueChange={(value) =>
                    setStallForm((current) => ({ ...current, zone: value === "__new__" ? "" : value }))
                  }
                >
                  <SelectTrigger id="stallZone">
                    <SelectValue placeholder="Select or type a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ New zone…</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {(zones.length === 0 || stallForm.zone === "" || !zones.includes(stallForm.zone)) && (
                <Input
                  id={zones.length > 0 ? "stallZoneNew" : "stallZone"}
                  placeholder={zones.length > 0 ? "Type new zone name" : "e.g. Zone A"}
                  value={stallForm.zone}
                  onChange={(event) =>
                    setStallForm((current) => ({ ...current, zone: event.target.value }))
                  }
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stallSize">Size</Label>
                <Input
                  id="stallSize"
                  value={stallForm.size}
                  onChange={(event) =>
                    setStallForm((current) => ({ ...current, size: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stallPrice">Monthly Price</Label>
                <Input
                  id="stallPrice"
                  type="number"
                  value={stallForm.pricePerMonth}
                  onChange={(event) =>
                    setStallForm((current) => ({
                      ...current,
                      pricePerMonth: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <Button onClick={() => createStall.mutate()} disabled={createStall.isPending}>
              Save Stall
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConsolePage>
  );
};

export default StallsPage;
