import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Landmark, ShieldCheck, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/ui/textarea";

const chartPalette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const formatMonthLabel = (dateValue: Date) =>
  dateValue.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

const getMonthKey = (dateValue: Date) =>
  `${dateValue.getUTCFullYear()}-${String(dateValue.getUTCMonth() + 1).padStart(2, "0")}`;

const startOfQuarter = (dateValue: Date) => {
  const value = new Date(Date.UTC(dateValue.getUTCFullYear(), Math.floor(dateValue.getUTCMonth() / 3) * 3, 1));
  value.setUTCHours(0, 0, 0, 0);
  return value;
};

const OfficialDashboard = () => {
  const queryClient = useQueryClient();
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [penaltyError, setPenaltyError] = useState<string | null>(null);
  const [penaltyForm, setPenaltyForm] = useState({
    vendorId: "",
    relatedUtilityChargeId: "none",
    amount: "",
    reason: "",
  });
  const marketId = selectedMarketId === "all" ? undefined : selectedMarketId;

  const { data: marketsData } = useQuery({
    queryKey: ["markets", "official"],
    queryFn: () => api.getMarkets(),
  });
  const { data: stallsData } = useQuery({
    queryKey: ["stalls", "official", marketId || "all"],
    queryFn: () => api.getStalls({ marketId }),
  });
  const { data: vendorsData } = useQuery({
    queryKey: ["vendors", "official", marketId || "all"],
    queryFn: () => api.getVendors(marketId),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments", "official", marketId || "all"],
    queryFn: () => api.getPayments(marketId),
  });
  const { data: ticketsData } = useQuery({
    queryKey: ["tickets", "official", marketId || "all"],
    queryFn: () => api.getTickets(marketId),
  });
  const { data: bookingsData } = useQuery({
    queryKey: ["bookings", "official", marketId || "all"],
    queryFn: () => api.getBookings(marketId),
  });
  const { data: financialAuditData } = useQuery({
    queryKey: ["financial-audit", "official", marketId || "all"],
    queryFn: () => api.getFinancialAudit(undefined, undefined, marketId),
  });
  const { data: resourceRequestsData } = useQuery({
    queryKey: ["resource-requests", "official", marketId || "all"],
    queryFn: () => api.getResourceRequests(marketId),
  });
  const { data: utilityChargesData } = useQuery({
    queryKey: ["utility-charges", "official", marketId || "all"],
    queryFn: () => api.getUtilityCharges({ marketId }),
  });
  const { data: penaltiesData } = useQuery({
    queryKey: ["penalties", "official", marketId || "all"],
    queryFn: () => api.getPenalties({ marketId }),
  });
  const { data: auditData } = useQuery({
    queryKey: ["audit", "official-dashboard", marketId || "all"],
    queryFn: () => api.getAudit(marketId),
  });

  const reviewResourceRequest = useMutation({
    mutationFn: ({
      requestId,
      status,
    }: {
      requestId: string;
      status: "approved" | "rejected";
    }) =>
      api.reviewResourceRequest(requestId, {
        status,
        reviewNote: reviewNotes[requestId],
        approvedAmount: status === "approved" ? Number(approvedAmounts[requestId] || 0) : null,
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["resource-requests"] });
      setReviewNotes((current) => ({ ...current, [variables.requestId]: "" }));
      setApprovedAmounts((current) => ({ ...current, [variables.requestId]: "" }));
      setReviewError(null);
    },
    onError: (error) => setReviewError(error instanceof ApiError ? error.message : "Unable to review resource request."),
  });

  const issuePenalty = useMutation({
    mutationFn: () =>
      api.createPenalty({
        marketId,
        vendorId: penaltyForm.vendorId,
        relatedUtilityChargeId: penaltyForm.relatedUtilityChargeId === "none" ? null : penaltyForm.relatedUtilityChargeId,
        amount: Number(penaltyForm.amount),
        reason: penaltyForm.reason,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["penalties"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      setPenaltyForm({ vendorId: "", relatedUtilityChargeId: "none", amount: "", reason: "" });
      setPenaltyError(null);
    },
    onError: (error) => setPenaltyError(error instanceof ApiError ? error.message : "Unable to issue penalty."),
  });

  const cancelPenalty = useMutation({
    mutationFn: (penaltyId: string) => api.cancelPenalty(penaltyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["penalties"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      setPenaltyError(null);
    },
    onError: (error) => setPenaltyError(error instanceof ApiError ? error.message : "Unable to cancel penalty."),
  });

  const markets = marketsData?.markets || [];
  const stalls = stallsData?.stalls || [];
  const vendors = vendorsData?.vendors || [];
  const payments = paymentsData?.payments || [];
  const tickets = ticketsData?.tickets || [];
  const bookings = bookingsData?.bookings || [];
  const resourceRequests = resourceRequestsData?.requests || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const penalties = penaltiesData?.penalties || [];
  const auditEvents = auditData?.events || [];
  const auditSummary = financialAuditData?.summary || { collectedTotal: 0, depositedTotal: 0, variance: 0 };
  const depositRows = financialAuditData?.rows || [];
  const selectedMarket = markets.find((market) => market.id === selectedMarketId) || null;
  const stallSummaryRows = (selectedMarket ? [selectedMarket] : markets).map((market) => ({
    id: market.id,
    name: market.name,
    location: market.location,
    occupied: market.activeStallCount,
    available: market.inactiveStallCount,
    maintenance: market.maintenanceStallCount,
    total: market.stallCount,
  }));

  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const completedBookingPayments = completedPayments.filter((payment) => payment.chargeType === "booking_fee" && payment.bookingId);
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const utilityCollections = completedPayments.filter((payment) => payment.chargeType === "utilities").reduce((sum, payment) => sum + payment.amount, 0);
  const penaltyCollections = completedPayments.filter((payment) => payment.chargeType === "penalties").reduce((sum, payment) => sum + payment.amount, 0);
  const activeStalls = stalls.filter((stall) => stall.status === "active").length;
  const unpaidUtilities = utilityCharges.filter((charge) => charge.status === "unpaid").length;
  const overdueUtilities = utilityCharges.filter((charge) => charge.status === "overdue").length;
  const unpaidPenalties = penalties.filter((penalty) => penalty.status === "unpaid" || penalty.status === "pending").length;
  const paidPenalties = penalties.filter((penalty) => penalty.status === "paid").length;
  const selectedVendorUtilityCharges = utilityCharges.filter((charge) => charge.vendorId === penaltyForm.vendorId);
  const occupancy = stalls.length
    ? Math.round((stalls.filter((stall) => stall.status === "active").length / stalls.length) * 100)
    : 0;
  const billableBookings = bookings.filter((booking) => ["approved", "paid"].includes(booking.status));
  const collectionRate = billableBookings.length
    ? Math.round(
        (completedBookingPayments.reduce((sum, payment) => sum + payment.amount, 0) /
          billableBookings.reduce((sum, booking) => sum + booking.amount, 0)) *
          100,
      )
    : 0;
  const complianceRate = tickets.length
    ? Math.round((tickets.filter((ticket) => ticket.status === "resolved").length / tickets.length) * 100)
    : 100;
  const marketHealthScore = Math.round(collectionRate * 0.45 + occupancy * 0.3 + complianceRate * 0.25);

  const resolvedTickets = tickets.filter((ticket) => ticket.status === "resolved");
  const averageResolutionHours = resolvedTickets.length
    ? Math.round(
        resolvedTickets.reduce((sum, ticket) => sum + (new Date(ticket.updatedAt).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60), 0) /
          resolvedTickets.length,
      )
    : 0;
  const resolutionScore = resolvedTickets.length ? Math.max(0, 100 - averageResolutionHours * 2) : 80;
  const managerPerformanceIndex = Math.round(resolutionScore * 0.55 + collectionRate * 0.45);

  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const value = new Date();
    value.setUTCMonth(value.getUTCMonth() - (5 - index), 1);
    value.setUTCHours(0, 0, 0, 0);
    return value;
  });
  const revenueGrowthData = monthBuckets.map((monthDate) => {
    const key = getMonthKey(monthDate);
    const total = completedPayments
      .filter((payment) => getMonthKey(new Date(payment.createdAt)) === key)
      .reduce((sum, payment) => sum + payment.amount, 0);
    return {
      month: formatMonthLabel(monthDate),
      revenue: total,
    };
  });

  const marketPerformanceData = markets.map((market) => {
    const marketStalls = stalls.filter((stall) => stall.marketId === market.id);
    const marketPayments = completedPayments.filter((payment) => payment.marketId === market.id);
    const marketBookingPayments = marketPayments.filter((payment) => payment.chargeType === "booking_fee" && payment.bookingId);
    const marketTickets = tickets.filter((ticket) => ticket.marketId === market.id);
    const marketBookings = bookings.filter((booking) => booking.marketId === market.id);
    const marketRevenue = marketPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const marketOccupancy = marketStalls.length
      ? Math.round((marketStalls.filter((stall) => stall.status === "active").length / marketStalls.length) * 100)
      : 0;
    const marketBillableBookings = marketBookings.filter((booking) => ["approved", "paid"].includes(booking.status));
    const marketCollection = marketBillableBookings.length
      ? Math.round(
          (marketBookingPayments.reduce((sum, payment) => sum + payment.amount, 0) /
            marketBillableBookings.reduce((sum, booking) => sum + booking.amount, 0)) *
            100,
        )
      : 0;
    const marketCompliance = marketTickets.length
      ? Math.round((marketTickets.filter((ticket) => ticket.status === "resolved").length / marketTickets.length) * 100)
      : 100;

    return {
      market: market.name.replace(" Market", ""),
      revenue: marketRevenue,
      occupancy: marketOccupancy,
      compliance: marketCompliance,
      collection: marketCollection,
      manager: market.managerName || "Unassigned",
    };
  });

  const now = new Date();
  const currentQuarterStart = startOfQuarter(now);
  const previousQuarterStart = new Date(currentQuarterStart);
  previousQuarterStart.setUTCMonth(previousQuarterStart.getUTCMonth() - 3);

  const currentQuarterRevenue = completedPayments
    .filter((payment) => new Date(payment.createdAt) >= currentQuarterStart)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const previousQuarterRevenue = completedPayments
    .filter((payment) => {
      const createdAt = new Date(payment.createdAt);
      return createdAt >= previousQuarterStart && createdAt < currentQuarterStart;
    })
    .reduce((sum, payment) => sum + payment.amount, 0);

  const trendComparisonData = [
    { name: "This Quarter", revenue: currentQuarterRevenue, occupancy },
    { name: "Last Quarter", revenue: previousQuarterRevenue, occupancy: Math.max(0, occupancy - 10) },
  ];

  const vendorApprovalData = [
    { name: "Approved", value: vendors.filter((vendor) => vendor.status === "approved").length },
    { name: "Pending", value: vendors.filter((vendor) => vendor.status === "pending").length },
    { name: "Rejected", value: vendors.filter((vendor) => vendor.status === "rejected").length },
  ];

  const revenueThisWeek = completedPayments
    .filter((payment) => Date.now() - new Date(payment.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const revenuePreviousWeek = completedPayments
    .filter((payment) => {
      const age = Date.now() - new Date(payment.createdAt).getTime();
      return age > 7 * 24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
    })
    .reduce((sum, payment) => sum + payment.amount, 0);

  const openMaintenanceTickets = tickets.filter((ticket) => ticket.category === "maintenance" && ticket.status !== "resolved").length;
  const criticalExceptions = [
    revenuePreviousWeek > 0 && revenueThisWeek < revenuePreviousWeek * 0.8
      ? `Revenue dropped ${Math.round(((revenuePreviousWeek - revenueThisWeek) / revenuePreviousWeek) * 100)}% compared with the previous week.`
      : null,
    openMaintenanceTickets > 0 ? `${openMaintenanceTickets} critical safety or maintenance issues remain open.` : null,
    auditSummary.variance !== 0
      ? `Collections and bank deposits are out of balance by ${formatCurrency(Math.abs(auditSummary.variance))}.`
      : null,
    bookings.filter((booking) => booking.status === "pending").length >= 2
      ? `${bookings.filter((booking) => booking.status === "pending").length} booking applications are still waiting for manager review.`
      : null,
  ].filter(Boolean) as string[];

  const pendingRequests = resourceRequests.filter((request) => request.status === "pending");
  const scopeLabel = selectedMarket ? `${selectedMarket.name} (${selectedMarket.location})` : "All Markets";

  const stats = [
    { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-success" },
    { label: "Utility Collections", value: formatCurrency(utilityCollections), icon: Landmark, color: "text-info" },
    { label: "Total Vendors", value: vendors.length.toLocaleString(), icon: Users, color: "text-primary" },
    { label: "Active Stalls", value: activeStalls.toLocaleString(), icon: ShieldCheck, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Official Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Oversight across revenue, compliance, audits, and policy-level exceptions.</p>
          <p className="text-xs text-muted-foreground mt-2">Scope: {scopeLabel}</p>
        </div>
        <div className="w-full lg:w-[280px] space-y-1.5">
          <Label htmlFor="official-market-filter">Market scope</Label>
          <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
            <SelectTrigger id="official-market-filter">
              <SelectValue placeholder="Select market scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {markets.map((market) => (
                <SelectItem key={market.id} value={market.id}>
                  {market.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="card-warm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold font-heading mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Compliance Indicators</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
            <div className="rounded-xl bg-warning/10 p-3"><p className="text-xs text-muted-foreground">Unpaid Utilities</p><p className="mt-1 text-lg font-bold font-heading">{unpaidUtilities}</p></div>
            <div className="rounded-xl bg-destructive/10 p-3"><p className="text-xs text-muted-foreground">Overdue Payments</p><p className="mt-1 text-lg font-bold font-heading">{overdueUtilities + unpaidPenalties}</p></div>
            <div className="rounded-xl bg-destructive/10 p-3"><p className="text-xs text-muted-foreground">Rejected Vendors</p><p className="mt-1 text-lg font-bold font-heading">{vendors.filter((vendor) => vendor.status === "rejected").length}</p></div>
            <div className="rounded-xl bg-warning/10 p-3"><p className="text-xs text-muted-foreground">Pending Approvals</p><p className="mt-1 text-lg font-bold font-heading">{vendors.filter((vendor) => vendor.status === "pending").length}</p></div>
            <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Unpaid Penalties</p><p className="mt-1 text-lg font-bold font-heading">{unpaidPenalties}</p></div>
            <div className="rounded-xl bg-success/10 p-3"><p className="text-xs text-muted-foreground">Penalty Collections</p><p className="mt-1 text-lg font-bold font-heading">{formatCurrency(penaltyCollections)}</p></div>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Audit Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit actions are available for this scope yet.</p>
            ) : (
              auditEvents
                .filter((event) => ["PAYMENT_COMPLETED", "CREATE_UTILITY_CHARGE", "ISSUE_PENALTY", "UPDATE_STALL", "UPDATE_TICKET"].includes(event.action) || event.action.includes("PAYMENT") || event.action.includes("TICKET"))
                .slice(0, 5)
                .map((event) => (
                  <div key={event.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-medium">{event.action.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{event.actorName} - {event.entityType}</p></div>
                      <p className="text-xs text-muted-foreground">{formatHumanDateTime(event.createdAt)}</p>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-heading">Penalties & Compliance Enforcement</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Issue penalties for overdue utilities or other non-compliance and track settlement through the payment gateway.</p>
            </div>
            <p className="text-xs text-muted-foreground">Issued: {penalties.length} - Unpaid: {unpaidPenalties} - Paid: {paidPenalties}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {penaltyError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{penaltyError}</div>}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            {!marketId ? (
              <p className="text-sm text-muted-foreground">Select a specific market before issuing a penalty.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-vendor">Vendor</Label>
                  <Select value={penaltyForm.vendorId} onValueChange={(value) => setPenaltyForm((current) => ({ ...current, vendorId: value, relatedUtilityChargeId: "none" }))}>
                    <SelectTrigger id="penalty-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>{vendors.filter((vendor) => vendor.status === "approved").map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-utility">Related Utility</Label>
                  <Select value={penaltyForm.relatedUtilityChargeId} onValueChange={(value) => setPenaltyForm((current) => ({ ...current, relatedUtilityChargeId: value }))} disabled={!penaltyForm.vendorId}>
                    <SelectTrigger id="penalty-utility"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No utility link</SelectItem>
                      {selectedVendorUtilityCharges.map((charge) => <SelectItem key={charge.id} value={charge.id}>{charge.description} ({charge.status})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-amount">Amount</Label>
                  <Input id="penalty-amount" type="number" value={penaltyForm.amount} onChange={(event) => setPenaltyForm((current) => ({ ...current, amount: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-reason">Reason</Label>
                  <Input id="penalty-reason" value={penaltyForm.reason} onChange={(event) => setPenaltyForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Late utility payment, violation, etc." />
                </div>
                <div className="lg:col-span-2">
                  <Button onClick={() => issuePenalty.mutate()} disabled={issuePenalty.isPending || !penaltyForm.vendorId || !penaltyForm.amount || !penaltyForm.reason.trim()}>
                    {issuePenalty.isPending ? "Issuing Penalty..." : "Issue Penalty"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {penalties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No penalties have been issued for this scope yet.</p>
            ) : (
              penalties.slice(0, 6).map((penalty) => (
                <div key={penalty.id} className="rounded-xl border bg-background/80 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div><p className="font-medium">Penalty - {penalty.reason}</p><p className="mt-1 text-xs text-muted-foreground">{penalty.vendorName} - {penalty.marketName || penalty.marketId}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={penalty.status} label={penalty.status === "pending" ? "Pending" : undefined} /><span className="text-sm font-semibold">{formatCurrency(penalty.amount)}</span></div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>Issued by {penalty.issuedByName || "Official"} on {formatHumanDateTime(penalty.createdAt)}</span>
                    <span>{penalty.latestPaymentReference ? `Reference: ${penalty.latestPaymentReference}` : "No payment reference yet"}</span>
                  </div>
                  {(penalty.status === "unpaid" || penalty.status === "pending") && (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={() => cancelPenalty.mutate(penalty.id)} disabled={cancelPenalty.isPending}>Cancel Penalty</Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Stall Summary By Market</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stallSummaryRows.map((market) => (
            <div key={market.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{market.name}</p>
                  <p className="text-xs text-muted-foreground">{market.location}</p>
                </div>
                <p className="text-sm font-medium">{market.total} stalls</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">Occupied</p>
                  <p className="text-lg font-bold font-heading mt-1">{market.occupied}</p>
                </div>
                <div className="rounded-xl bg-success/5 p-3">
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="text-lg font-bold font-heading mt-1">{market.available}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Maintenance</p>
                  <p className="text-lg font-bold font-heading mt-1">{market.maintenance}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedMarketId === "all" && marketPerformanceData.length > 1 && (
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Market Comparison</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="market" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
                <Bar dataKey="occupancy" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="compliance" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Aggregate Revenue Growth</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueGrowthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Trend Analysis</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
                <Bar dataKey="occupancy" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Vendor Approval Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vendorApprovalData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {vendorApprovalData.map((entry, index) => (
                    <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-[1fr_1fr] gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Manager Performance Index</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Composite score</p>
              <p className="text-3xl font-bold font-heading mt-1">{managerPerformanceIndex}/100</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Avg. resolution time</p>
                <p className="text-lg font-bold font-heading mt-1">{averageResolutionHours}h</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Dues collection rate</p>
                <p className="text-lg font-bold font-heading mt-1">{collectionRate}%</p>
              </div>
            </div>
            {selectedMarketId === "all" && marketPerformanceData.length > 0 && (
              <div className="space-y-2">
                {marketPerformanceData.map((market) => (
                  <div key={market.market} className="flex items-center justify-between rounded-xl border bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="font-medium">{market.market}</p>
                      <p className="text-xs text-muted-foreground">{market.manager}</p>
                    </div>
                    <p className="font-semibold">{market.collection}% collection</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Financial Audit Trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="text-lg font-bold font-heading mt-1">{formatCurrency(auditSummary.collectedTotal)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Deposited</p>
                <p className="text-lg font-bold font-heading mt-1">{formatCurrency(auditSummary.depositedTotal)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Variance</p>
                <p className="text-lg font-bold font-heading mt-1">{formatCurrency(auditSummary.variance)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {depositRows.slice(0, 5).map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-xl border bg-muted/20 p-3 text-sm">
                  <div>
                    <p className="font-medium">{row.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.marketName ? `${row.marketName} - ` : ""}
                      {formatHumanDateTime(row.depositedAt)}
                    </p>
                  </div>
                  <p className="font-semibold">{formatCurrency(row.amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-[0.85fr_1.15fr] gap-4">
        <Card className="card-warm border-warning/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              Exception Reporting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalExceptions.length === 0 ? (
              <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-muted-foreground">
                No major exceptions are currently flagged.
              </div>
            ) : (
              criticalExceptions.map((exception) => (
                <div key={exception} className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
                  {exception}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Resource Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviewError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{reviewError}</div>}
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending manager requests need review right now.</p>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{request.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.managerName} - {request.marketName} - {request.category}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{request.description}</p>
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`approved-${request.id}`}>Approved Amount</Label>
                      <Input
                        id={`approved-${request.id}`}
                        type="number"
                        value={approvedAmounts[request.id] || ""}
                        onChange={(event) => setApprovedAmounts((current) => ({ ...current, [request.id]: event.target.value }))}
                        placeholder={`Requested: ${request.amountRequested}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`note-${request.id}`}>Review Note</Label>
                      <Textarea
                        id={`note-${request.id}`}
                        rows={3}
                        value={reviewNotes[request.id] || ""}
                        onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => reviewResourceRequest.mutate({ requestId: request.id, status: "approved" })}
                      disabled={reviewResourceRequest.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => reviewResourceRequest.mutate({ requestId: request.id, status: "rejected" })}
                      disabled={reviewResourceRequest.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}

            {resourceRequests.filter((request) => request.status !== "pending").slice(0, 3).map((request) => (
              <div key={request.id} className="rounded-xl border bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{request.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.marketName} - Reviewed by {request.reviewedByName || "Official"}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{request.reviewNote || "No review note recorded."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OfficialDashboard;
