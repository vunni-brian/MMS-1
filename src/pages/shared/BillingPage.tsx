import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Lock, PlusCircle, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { UtilityCalculationMethod, UtilityType } from "@/types";

// ─── Constants ───────────────────────────────────────────
const utilityTypeOptions: { value: UtilityType; label: string }[] = [
  { value: "electricity", label: "Electricity" }, { value: "water", label: "Water" },
  { value: "sanitation", label: "Sanitation" }, { value: "garbage", label: "Garbage" },
  { value: "other", label: "Other" },
];

const calculationOptions: { value: UtilityCalculationMethod; label: string }[] = [
  { value: "metered", label: "Metered" }, { value: "estimated", label: "Estimated" }, { value: "fixed", label: "Fixed" },
];

const formatDate = (value: string | null, fallback = "Not available") =>
  formatHumanDate(value ? `${value}T00:00:00` : null, fallback);

const formatDateTime = (value: string | null, fallback = "Not available") =>
  formatHumanDateTime(value, fallback);

// ─── Field row helper ─────────────────────────────────────
const FieldRow = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
    <p className="text-xs text-slate-400">{label}</p>
    <div className={`mt-1 break-words text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────
const BillingPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isManager = user?.role === "manager";
  const canManageChargeTypes = user?.role === "admin";
  const canManageUtilities = user?.role === "manager";

  const [searchParams] = useSearchParams();

  const [selectedMarketId, setSelectedMarketId] = useState(() => {
    if (isManager) return user?.marketId || "";
    const fromUrl = searchParams.get("market");
    return fromUrl || "all";
  });

  const [form, setForm] = useState({
    marketId: isManager ? user?.marketId || "" : "",
    vendorId: "", bookingId: "none",
    utilityType: "electricity" as UtilityType,
    description: "", billingPeriod: "",
    calculationMethod: "metered" as UtilityCalculationMethod,
    usageQuantity: "", unit: "", ratePerUnit: "", amount: "", dueDate: "",
  });

  const [error, setError] = useState<string | null>(null);

  const utilityMarketId = isManager ? user?.marketId || undefined : selectedMarketId === "all" ? undefined : selectedMarketId;

  useEffect(() => {
    if (isManager) { setSelectedMarketId(user?.marketId || ""); setForm((c) => ({ ...c, marketId: user?.marketId || "" })); return; }
    setForm((c) => ({ ...c, marketId: selectedMarketId === "all" ? "" : selectedMarketId, vendorId: "", bookingId: "none" }));
  }, [isManager, selectedMarketId, user?.marketId]);

  const { data: chargeTypesData, error: chargeTypesError, isPending: chargeTypesPending } = useQuery({
    queryKey: ["charge-types", user?.role, utilityMarketId || "all"],
    queryFn: () => api.getChargeTypes(isManager ? user?.marketId || undefined : utilityMarketId),
    enabled: Boolean(user),
  });
  const { data: marketsData, isPending: marketsPending } = useQuery({
    queryKey: ["markets", "billing"], queryFn: () => api.getMarkets(), enabled: Boolean(user && !isManager),
  });
  const { data: utilityChargesData, error: utilityChargesError, isPending: utilityChargesPending } = useQuery({
    queryKey: ["utility-charges", "billing", utilityMarketId || "all"],
    queryFn: () => api.getUtilityCharges({ marketId: utilityMarketId }), enabled: Boolean(user),
  });
  const { data: vendorsData } = useQuery({
    queryKey: ["vendors", "billing", utilityMarketId || "all"],
    queryFn: () => api.getVendors(utilityMarketId), enabled: Boolean(canManageUtilities && utilityMarketId),
  });
  const { data: bookingsData } = useQuery({
    queryKey: ["bookings", "billing", utilityMarketId || "all"],
    queryFn: () => api.getBookings(utilityMarketId), enabled: Boolean(canManageUtilities && utilityMarketId && form.vendorId),
  });

  const updateChargeType = useMutation({
    mutationFn: ({ chargeTypeId, isEnabled }: { chargeTypeId: string; isEnabled: boolean }) => api.updateChargeType(chargeTypeId, isEnabled),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["charge-types"] }); await queryClient.invalidateQueries({ queryKey: ["payments"] }); setError(null); toast.success(t("billing:toastSwitchUpdated")); },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : t("billing:unableToUpdateSwitch"); setError(msg); toast.error(t("billing:toastSwitchNotUpdated"), { description: msg }); },
  });

  const createUtilityCharge = useMutation({
    mutationFn: () => api.createUtilityCharge({
      marketId: form.marketId || undefined, vendorId: form.vendorId, bookingId: form.bookingId === "none" ? null : form.bookingId,
      utilityType: form.utilityType, description: form.description, billingPeriod: form.billingPeriod,
      usageQuantity: form.calculationMethod === "fixed" || !form.usageQuantity ? null : Number(form.usageQuantity),
      unit: form.calculationMethod === "fixed" ? null : form.unit || null,
      ratePerUnit: form.calculationMethod === "fixed" || !form.ratePerUnit ? null : Number(form.ratePerUnit),
      calculationMethod: form.calculationMethod, amount: form.amount ? Number(form.amount) : null, dueDate: form.dueDate,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["utility-charges"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setForm((c) => ({ ...c, vendorId: "", bookingId: "none", description: "", billingPeriod: "", usageQuantity: "", unit: "", ratePerUnit: "", amount: "", dueDate: "" }));
      setError(null);
      toast.success(t("billing:toastChargeCreated"), { description: t("billing:toastChargeCreatedDesc") });
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : t("billing:unableToCreateCharge"); setError(msg); toast.error(t("billing:toastChargeNotCreated"), { description: msg }); },
  });

  const cancelUtilityCharge = useMutation({
    mutationFn: (id: string) => api.cancelUtilityCharge(id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["utility-charges"] }); await queryClient.invalidateQueries({ queryKey: ["notifications"] }); setError(null); toast.success(t("billing:toastChargeCancelled")); },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : t("billing:unableToCancelCharge"); setError(msg); toast.error(t("billing:toastChargeNotCancelled"), { description: msg }); },
  });

  const chargeTypes = chargeTypesData?.chargeTypes || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const markets = marketsData?.markets || [];
  const vendors = (vendorsData?.vendors || []).filter((v) => v.status === "approved");
  const bookings = (bookingsData?.bookings || []).filter((b) => b.vendorId === form.vendorId);
  const selectedVendor = vendors.find((v) => v.id === form.vendorId) || null;
  const isPageLoading = chargeTypesPending || utilityChargesPending || (!isManager && marketsPending);
  const loadError = chargeTypesError instanceof ApiError ? chargeTypesError.message : utilityChargesError instanceof ApiError ? utilityChargesError.message : null;
  const unpaidCharges = utilityCharges.filter((c) => ["unpaid", "overdue", "pending_payment"].includes(c.status));
  const overdueCharges = utilityCharges.filter((c) => c.status === "overdue");
  const paidCharges = utilityCharges.filter((c) => c.status === "paid");
  const outstandingTotal = unpaidCharges.reduce((sum, c) => sum + c.amount, 0);
  const paidTotal = paidCharges.reduce((sum, c) => sum + c.amount, 0);
  const latestCharge = [...utilityCharges].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <PageLayout>
      <PageHeader
        eyebrow={t("billing:eyebrow")}
        title={t("billing:title")}
        description={t("billing:subtitle")}
        actions={
          !isManager ? (
            <select value={selectedMarketId} onChange={(e) => setSelectedMarketId(e.target.value)} className="h-9 rounded-lg border-2 border-slate-300 bg-white px-3 text-sm focus:border-primary focus:outline-none">
              <option value="all">{t("billing:allMarkets")}</option>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : (
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              {user?.marketName || t("billing:assignedMarket")}
            </div>
          )
        }
      />

      {!canManageUtilities && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 shadow-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-400 shrink-0" />
          <span>{t("billing:readOnlyNotice")}</span>
        </div>
      )}

      {(error || loadError) && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || loadError}</div>}

      {isPageLoading ? (
        <LoadingState rows={5} itemClassName="h-32 rounded-lg" />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t("billing:outstandingUtilities")} value={formatCurrency(outstandingTotal)} sublabel={t("billing:openCharges", { count: unpaidCharges.length })} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
            <StatCard label={t("billing:overdue")} value={overdueCharges.length} sublabel={overdueCharges.length ? t("billing:requiresFollowUp") : t("billing:noneOverdue")} icon={<Clock className="h-4 w-4" />} tone="red" />
            <StatCard label={t("billing:paidCharges")} value={formatCurrency(paidTotal)} sublabel={t("billing:paidInRegister", { count: paidCharges.length })} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label={t("billing:latestActivity")} value={latestCharge ? formatHumanDate(latestCharge.createdAt) : t("billing:none")} sublabel={latestCharge?.description || t("billing:noActivity")} icon={<ShieldCheck className="h-4 w-4" />} />
          </div>

          {/* Main layout */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

            {/* Dues register */}
            <Card>
              <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <CardTitle className="text-base font-medium">{t("billing:duesRegister")}</CardTitle>
                <span className="text-xs text-slate-400">{t("billing:charges", { count: utilityCharges.length })}</span>
              </CardHeader>
              <CardContent className="p-4">
              {utilityCharges.length === 0 ? (
                <EmptyState title={t("billing:duesRegisterEmpty")} />
              ) : (
                <div className="space-y-3">
                  {utilityCharges.map((charge) => (
                    <div key={charge.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{charge.description}</p>
                          <p className="mt-1 text-xs text-slate-500">{charge.vendorName} · {charge.marketName || charge.marketId} · {charge.billingPeriod}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={charge.status} context="obligation" />
                          <span className="font-bold text-slate-900">{formatCurrency(charge.amount)}</span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <FieldRow label={t("billing:dueDateField")} value={formatDate(charge.dueDate)} />
                        <FieldRow label={t("billing:calculation")} value={`${charge.calculationMethod}${charge.unit ? ` (${charge.unit})` : ""}`} />
                        <FieldRow label={t("billing:paymentAttempts")} value={charge.paymentCount} />
                        <FieldRow label={t("billing:latestReference")} value={charge.latestPaymentReference || t("billing:awaitingPayment")} mono={Boolean(charge.latestPaymentReference)} />
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-400">
                          {t("billing:createdBy", { name: charge.createdByName || t("billing:system"), date: formatDateTime(charge.createdAt) })}
                          {charge.paidAt ? t("billing:paidOn", { date: formatDateTime(charge.paidAt) }) : ""}
                        </p>
                        {canManageUtilities && (charge.status === "unpaid" || charge.status === "overdue") && (
                          <Button variant="outline" size="sm" className="rounded-lg border-slate-300 font-bold" onClick={() => cancelUtilityCharge.mutate(charge.id)} disabled={cancelUtilityCharge.isPending}>
                            {t("billing:cancelCharge")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>

            {/* Right column */}
            <div className="space-y-4">
              {/* Billing switches */}
              <Card>
                <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                  <CardTitle className="text-base font-medium">{t("billing:revenueCollectionPolicies")}</CardTitle>
                  <span className="text-xs text-slate-400">{t("billing:switches", { count: chargeTypes.length })}</span>
                </CardHeader>
                <CardContent className="p-4">
                {chargeTypes.length === 0 ? (
                  <EmptyState title={t("billing:noSwitches")} />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {chargeTypes.map((chargeType) => (
                      <div key={chargeType.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{chargeType.displayName}</p>
                            <Badge variant={chargeType.isEnabled ? "success" : "error"}>
                              {chargeType.isEnabled ? t("billing:enabled") : t("billing:disabled")}
                            </Badge>
                            {!chargeType.isEnabled && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                <Lock className="h-3 w-3" />{t("billing:adminLocked")}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {t("billing:scopeUpdated", { scope: chargeType.scope, name: chargeType.updatedByName || t("billing:system") })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className={`shrink-0 rounded-lg shadow-none font-bold ${chargeType.isEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                          variant={chargeType.isEnabled ? "default" : "outline"}
                          disabled={!canManageChargeTypes || updateChargeType.isPending}
                          onClick={() => updateChargeType.mutate({ chargeTypeId: chargeType.id, isEnabled: !chargeType.isEnabled })}
                        >
                          {chargeType.isEnabled ? t("billing:enabled") : t("billing:disabled")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                </CardContent>
              </Card>

              {/* Create utility charge */}
              {canManageUtilities && (
                <Card>
                  <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                    <CardTitle className="text-base font-medium">{t("billing:createUtilityCharge")}</CardTitle>
                    <PlusCircle className="h-4 w-4 text-slate-400" />
                  </CardHeader>
                  <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-vendor" className="font-bold text-slate-700">{t("billing:vendor")}</Label>
                      <Select value={form.vendorId} onValueChange={(v) => setForm((c) => ({ ...c, vendorId: v, bookingId: "none" }))} disabled={!utilityMarketId}>
                        <SelectTrigger id="billing-vendor" className="border-slate-300 rounded-lg"><SelectValue placeholder={utilityMarketId ? t("billing:selectVendor") : t("billing:selectMarketFirst")} /></SelectTrigger>
                        <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-booking" className="font-bold text-slate-700">{t("billing:bookingReference")}</Label>
                      <Select value={form.bookingId} onValueChange={(v) => setForm((c) => ({ ...c, bookingId: v }))} disabled={!selectedVendor}>
                        <SelectTrigger id="billing-booking" className="border-slate-300 rounded-lg"><SelectValue placeholder={t("billing:optional")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("billing:noBookingLink")}</SelectItem>
                          {bookings.map((b) => <SelectItem key={b.id} value={b.id}>{b.stallName} ({b.id})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-utility-type" className="font-bold text-slate-700">{t("billing:utilityType")}</Label>
                      <Select value={form.utilityType} onValueChange={(v: UtilityType) => setForm((c) => ({ ...c, utilityType: v }))}>
                        <SelectTrigger id="billing-utility-type" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{utilityTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-method" className="font-bold text-slate-700">{t("billing:method")}</Label>
                      <Select value={form.calculationMethod} onValueChange={(v: UtilityCalculationMethod) => setForm((c) => ({ ...c, calculationMethod: v }))}>
                        <SelectTrigger id="billing-method" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{calculationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-period" className="font-bold text-slate-700">{t("billing:billingPeriod")}</Label>
                      <Input id="billing-period" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={form.billingPeriod} onChange={(e) => setForm((c) => ({ ...c, billingPeriod: e.target.value }))} placeholder={t("billing:billingPeriodPlaceholder")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-description" className="font-bold text-slate-700">{t("billing:description")}</Label>
                      <Textarea id="billing-description" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" rows={2} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder={t("billing:descriptionPlaceholder")} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-due-date" className="font-bold text-slate-700">{t("billing:dueDate")}</Label>
                      <Input id="billing-due-date" type="date" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={form.dueDate} onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-amount" className="font-bold text-slate-700">{t("billing:amount")}</Label>
                      <Input id="billing-amount" type="number" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} placeholder={t("billing:amountPlaceholder")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-usage-qty" className="font-bold text-slate-700">{t("billing:usageQty")}</Label>
                      <Input id="billing-usage-qty" type="number" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={form.usageQuantity} disabled={form.calculationMethod === "fixed"} onChange={(e) => setForm((c) => ({ ...c, usageQuantity: e.target.value }))} placeholder={t("billing:usageQtyPlaceholder")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-rate" className="font-bold text-slate-700">{t("billing:ratePerUnit")}</Label>
                      <Input id="billing-rate" type="number" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={form.ratePerUnit} disabled={form.calculationMethod === "fixed"} onChange={(e) => setForm((c) => ({ ...c, ratePerUnit: e.target.value }))} placeholder={t("billing:ratePlaceholder")} />
                      </div>
                    </div>

                    {/* Live amount preview */}
                    {(() => {
                      const qty = parseFloat(form.usageQuantity);
                      const rate = parseFloat(form.ratePerUnit);
                      const manual = parseFloat(form.amount);
                      const calculated = form.calculationMethod !== "fixed" && !isNaN(qty) && !isNaN(rate) ? qty * rate : null;
                      const preview = !isNaN(manual) && manual > 0 ? manual : calculated;
                      if (!preview) return null;
                      return (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                          <span className="text-slate-500">{!isNaN(manual) && manual > 0 ? t("billing:manualAmount") : t("billing:calculated")}</span>
                          <span className="font-bold text-emerald-800">{formatCurrency(preview)}</span>
                          {calculated && !isNaN(manual) && manual > 0 && Math.abs(manual - calculated) > 0.01 && (
                            <span className="ml-auto text-xs text-amber-600">{t("billing:autoCalc")} {formatCurrency(calculated)}</span>
                          )}
                        </div>
                      );
                    })()}

                    <Button
                      className="w-full rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold"
                      onClick={() => createUtilityCharge.mutate()}
                      disabled={createUtilityCharge.isPending || !form.vendorId || !form.description.trim() || !form.billingPeriod.trim() || !form.dueDate || !form.marketId}
                    >
                      {createUtilityCharge.isPending ? t("billing:creating") : t("billing:createChargeButton")}
                    </Button>
                  </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
};

export default BillingPage;
