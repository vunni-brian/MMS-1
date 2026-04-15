import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import type { UtilityCalculationMethod, UtilityType } from "@/types";

const utilityTypeOptions: { value: UtilityType; label: string }[] = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "sanitation", label: "Sanitation" },
  { value: "garbage", label: "Garbage" },
  { value: "other", label: "Other" },
];

const calculationOptions: { value: UtilityCalculationMethod; label: string }[] = [
  { value: "metered", label: "Metered" },
  { value: "estimated", label: "Estimated" },
  { value: "fixed", label: "Fixed" },
];

const formatDate = (value: string | null, fallback = "Not available") => {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
};

const formatDateTime = (value: string | null, fallback = "Not available") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
};

const BillingPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.role === "manager";
  const canManageChargeTypes = user?.role === "admin";
  const canManageUtilities = user?.role === "manager" || user?.role === "admin";
  const [selectedMarketId, setSelectedMarketId] = useState(isManager ? user?.marketId || "" : "all");
  const [form, setForm] = useState({
    marketId: isManager ? user?.marketId || "" : "",
    vendorId: "",
    bookingId: "none",
    utilityType: "electricity" as UtilityType,
    description: "",
    billingPeriod: "",
    calculationMethod: "metered" as UtilityCalculationMethod,
    usageQuantity: "",
    unit: "",
    ratePerUnit: "",
    amount: "",
    dueDate: "",
  });
  const [error, setError] = useState<string | null>(null);

  const utilityMarketId = isManager ? user?.marketId || undefined : selectedMarketId === "all" ? undefined : selectedMarketId;

  useEffect(() => {
    if (isManager) {
      setSelectedMarketId(user?.marketId || "");
      setForm((current) => ({ ...current, marketId: user?.marketId || "" }));
      return;
    }
    setForm((current) => ({ ...current, marketId: selectedMarketId === "all" ? "" : selectedMarketId, vendorId: "", bookingId: "none" }));
  }, [isManager, selectedMarketId, user?.marketId]);

  const { data: chargeTypesData, error: chargeTypesError } = useQuery({
    queryKey: ["charge-types", user?.role, utilityMarketId || "all"],
    queryFn: () => api.getChargeTypes(isManager ? user?.marketId || undefined : utilityMarketId),
    enabled: Boolean(user),
  });
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "billing"],
    queryFn: () => api.getMarkets(),
    enabled: Boolean(user && !isManager),
  });
  const { data: utilityChargesData, error: utilityChargesError } = useQuery({
    queryKey: ["utility-charges", "billing", utilityMarketId || "all"],
    queryFn: () => api.getUtilityCharges({ marketId: utilityMarketId }),
    enabled: Boolean(user),
  });
  const { data: vendorsData } = useQuery({
    queryKey: ["vendors", "billing", utilityMarketId || "all"],
    queryFn: () => api.getVendors(utilityMarketId),
    enabled: Boolean(canManageUtilities && utilityMarketId),
  });
  const { data: bookingsData } = useQuery({
    queryKey: ["bookings", "billing", utilityMarketId || "all"],
    queryFn: () => api.getBookings(utilityMarketId),
    enabled: Boolean(canManageUtilities && utilityMarketId && form.vendorId),
  });

  const updateChargeType = useMutation({
    mutationFn: ({ chargeTypeId, isEnabled }: { chargeTypeId: string; isEnabled: boolean }) => api.updateChargeType(chargeTypeId, isEnabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["charge-types"] });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to update billing switch."),
  });

  const createUtilityCharge = useMutation({
    mutationFn: () =>
      api.createUtilityCharge({
        marketId: form.marketId || undefined,
        vendorId: form.vendorId,
        bookingId: form.bookingId === "none" ? null : form.bookingId,
        utilityType: form.utilityType,
        description: form.description,
        billingPeriod: form.billingPeriod,
        usageQuantity: form.calculationMethod === "fixed" || !form.usageQuantity ? null : Number(form.usageQuantity),
        unit: form.calculationMethod === "fixed" ? null : form.unit || null,
        ratePerUnit: form.calculationMethod === "fixed" || !form.ratePerUnit ? null : Number(form.ratePerUnit),
        calculationMethod: form.calculationMethod,
        amount: form.amount ? Number(form.amount) : null,
        dueDate: form.dueDate,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["utility-charges"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setForm((current) => ({
        ...current,
        vendorId: "",
        bookingId: "none",
        description: "",
        billingPeriod: "",
        usageQuantity: "",
        unit: "",
        ratePerUnit: "",
        amount: "",
        dueDate: "",
      }));
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to create utility charge."),
  });

  const cancelUtilityCharge = useMutation({
    mutationFn: (utilityChargeId: string) => api.cancelUtilityCharge(utilityChargeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["utility-charges"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setError(null);
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Unable to cancel utility charge."),
  });

  const chargeTypes = chargeTypesData?.chargeTypes || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const markets = marketsData?.markets || [];
  const vendors = (vendorsData?.vendors || []).filter((vendor) => vendor.status === "approved");
  const bookings = (bookingsData?.bookings || []).filter((booking) => booking.vendorId === form.vendorId);
  const selectedVendor = vendors.find((vendor) => vendor.id === form.vendorId) || null;
  const loadError = chargeTypesError instanceof ApiError
    ? chargeTypesError.message
    : utilityChargesError instanceof ApiError
      ? utilityChargesError.message
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Billing Controls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage billing switches and utility charges with a clean separation between billable charges and payment transactions.
          </p>
        </div>
        {!isManager && (
          <div className="w-full lg:w-[260px] space-y-1.5">
            <Label htmlFor="billing-market-filter">Market</Label>
            <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
              <SelectTrigger id="billing-market-filter">
                <SelectValue placeholder="All markets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {markets.map((market) => <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!canManageUtilities && (
        <Card className="card-warm border-info/20 bg-info/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-info" />
            <div className="text-sm text-muted-foreground">This view is read-only for your role. Utility charges and switches are shown for oversight only.</div>
          </CardContent>
        </Card>
      )}

      {(error || loadError) && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error || loadError}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {chargeTypes.map((chargeType) => (
          <Card key={chargeType.id} className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-heading">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                {chargeType.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Scope</p><p className="mt-1 font-medium capitalize">{chargeType.scope}</p></div>
                <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Status</p><p className={`mt-1 font-medium ${chargeType.isEnabled ? "text-success" : "text-destructive"}`}>{chargeType.isEnabled ? "Enabled" : "Disabled"}</p></div>
              </div>
              <div className="rounded-xl bg-muted/20 p-3 text-muted-foreground">Last updated by {chargeType.updatedByName || "system"} on {new Date(chargeType.updatedAt).toLocaleString()}.</div>
              <Button variant={chargeType.isEnabled ? "destructive" : "default"} disabled={!canManageChargeTypes || updateChargeType.isPending} onClick={() => updateChargeType.mutate({ chargeTypeId: chargeType.id, isEnabled: !chargeType.isEnabled })}>
                {chargeType.isEnabled ? "Disable Charge Type" : "Enable Charge Type"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {canManageUtilities && (
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <PlusCircle className="h-4 w-4 text-primary" />
              Create Utility Charge
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="utility-vendor">Vendor</Label>
              <Select value={form.vendorId} onValueChange={(value) => setForm((current) => ({ ...current, vendorId: value, bookingId: "none" }))} disabled={!utilityMarketId}>
                <SelectTrigger id="utility-vendor"><SelectValue placeholder={utilityMarketId ? "Select vendor" : "Select market first"} /></SelectTrigger>
                <SelectContent>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-booking">Booking Reference</Label>
              <Select value={form.bookingId} onValueChange={(value) => setForm((current) => ({ ...current, bookingId: value }))} disabled={!selectedVendor}>
                <SelectTrigger id="utility-booking"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No booking link</SelectItem>
                  {bookings.map((booking) => <SelectItem key={booking.id} value={booking.id}>{booking.stallName} ({booking.id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-type">Utility Type</Label>
              <Select value={form.utilityType} onValueChange={(value: UtilityType) => setForm((current) => ({ ...current, utilityType: value }))}>
                <SelectTrigger id="utility-type"><SelectValue /></SelectTrigger>
                <SelectContent>{utilityTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-period">Billing Period</Label>
              <Input id="utility-period" value={form.billingPeriod} onChange={(event) => setForm((current) => ({ ...current, billingPeriod: event.target.value }))} placeholder="e.g. April 2026" />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="utility-description">Description</Label>
              <Textarea id="utility-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what the vendor is being billed for." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-method">Calculation Method</Label>
              <Select value={form.calculationMethod} onValueChange={(value: UtilityCalculationMethod) => setForm((current) => ({ ...current, calculationMethod: value }))}>
                <SelectTrigger id="utility-method"><SelectValue /></SelectTrigger>
                <SelectContent>{calculationOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-due-date">Due Date</Label>
              <Input id="utility-due-date" type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-usage">Usage Quantity</Label>
              <Input id="utility-usage" type="number" value={form.usageQuantity} disabled={form.calculationMethod === "fixed"} onChange={(event) => setForm((current) => ({ ...current, usageQuantity: event.target.value }))} placeholder="Optional for fixed" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-unit">Unit</Label>
              <Input id="utility-unit" value={form.unit} disabled={form.calculationMethod === "fixed"} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="kWh, litres, units" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-rate">Rate Per Unit</Label>
              <Input id="utility-rate" type="number" value={form.ratePerUnit} disabled={form.calculationMethod === "fixed"} onChange={(event) => setForm((current) => ({ ...current, ratePerUnit: event.target.value }))} placeholder="Optional if amount is entered" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-amount">Amount</Label>
              <Input id="utility-amount" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Leave blank to auto-calculate" />
            </div>
            <div className="lg:col-span-2">
              <Button className="w-full lg:w-auto" onClick={() => createUtilityCharge.mutate()} disabled={createUtilityCharge.isPending || !form.vendorId || !form.description.trim() || !form.billingPeriod.trim() || !form.dueDate || !form.marketId}>
                {createUtilityCharge.isPending ? "Creating Charge..." : "Create Utility Charge"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Utility Charge Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {utilityCharges.length === 0 ? <p className="text-sm text-muted-foreground">No utility charges have been recorded for the selected scope yet.</p> : utilityCharges.map((charge) => (
            <div key={charge.id} className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium">{charge.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{charge.vendorName} - {charge.marketName || charge.marketId} - {charge.billingPeriod}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={charge.status} label={charge.status === "pending" ? "Pending" : undefined} />
                  <span className="text-sm font-semibold">UGX {charge.amount.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Due Date</p><p className="mt-1 text-sm font-medium">{formatDate(charge.dueDate)}</p></div>
                <div className="rounded-xl bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Calculation</p><p className="mt-1 text-sm font-medium">{charge.calculationMethod} {charge.unit ? `(${charge.unit})` : ""}</p></div>
                <div className="rounded-xl bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Payment Attempts</p><p className="mt-1 text-sm font-medium">{charge.paymentCount}</p></div>
                <div className="rounded-xl bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Latest Reference</p><p className="mt-1 break-words text-sm font-medium">{charge.latestPaymentReference || "Awaiting payment"}</p></div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Created by {charge.createdByName || "system"} on {formatDateTime(charge.createdAt)}. {charge.paidAt ? `Paid on ${formatDateTime(charge.paidAt)}.` : ""}
                </div>
                {canManageUtilities && (charge.status === "unpaid" || charge.status === "overdue") && (
                  <Button variant="outline" onClick={() => cancelUtilityCharge.mutate(charge.id)} disabled={cancelUtilityCharge.isPending}>
                    Cancel Charge
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPage;
