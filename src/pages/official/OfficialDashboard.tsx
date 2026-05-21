import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ClipboardList,
  Landmark,
  MessageSquare,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Button } from "@/components/ui/button";
import {
  ConsolePage,
  EmptyState,
  KpiStrip,
  LoadingState,
  PageHeader,
  Panel,
  RecordCard,
} from "@/components/console/ConsolePage";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Market, ResourceRequest, Ticket, UtilityCharge } from "@/types";

const obligationStatuses = new Set(["unpaid", "pending", "pending_payment", "overdue"]);

type MarketRisk = "Stable" | "Watch" | "Escalate";

const riskClassName = (risk: MarketRisk) => {
  if (risk === "Stable") {
    return "status-badge border-success/20 bg-success/15 text-success";
  }

  if (risk === "Watch") {
    return "status-badge border-warning/25 bg-warning/15 text-warning";
  }

  return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
};

const getComplaintPriority = (ticket: Ticket) => {
  if (ticket.category === "dispute") return "High";
  if (ticket.category === "billing" || ticket.category === "maintenance") return "Medium";
  return "Normal";
};

const getMarketRisk = ({
  openComplaints,
  overdueObligations,
  pendingRequests,
  failedPayments,
}: {
  openComplaints: number;
  overdueObligations: number;
  pendingRequests: number;
  failedPayments: number;
}): MarketRisk => {
  const { ESCALATE_COMPLAINTS, ESCALATE_OVERDUE, ESCALATE_FAILED_PAYMENTS } = DASHBOARD_CONFIG.MARKET_RISK_THRESHOLDS;
  if (openComplaints >= ESCALATE_COMPLAINTS || overdueObligations >= ESCALATE_OVERDUE || failedPayments >= ESCALATE_FAILED_PAYMENTS) {
    return "Escalate";
  }

  if (openComplaints > 0 || overdueObligations > 0 || pendingRequests > 0 || failedPayments > 0) {
    return "Watch";
  }

  return "Stable";
};

const sortByCreatedAtDesc = <T extends { createdAt: string }>(rows: T[]) =>
  [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const OfficialDashboard = () => {
  const [selectedMarketId, setSelectedMarketId] = useState("all");

  const marketsQuery = useQuery({
    queryKey: ["markets", "official-dashboard"],
    queryFn: () => api.getMarkets(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const stallsQuery = useQuery({
    queryKey: ["stalls", "official-dashboard"],
    queryFn: () => api.getStalls(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "official-dashboard"],
    queryFn: () => api.getVendors(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "official-dashboard"],
    queryFn: () => api.getPayments(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "official-dashboard"],
    queryFn: () => api.getTickets(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const utilityChargesQuery = useQuery({
    queryKey: ["utility-charges", "official-dashboard"],
    queryFn: () => api.getUtilityCharges(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const penaltiesQuery = useQuery({
    queryKey: ["penalties", "official-dashboard"],
    queryFn: () => api.getPenalties(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const resourceRequestsQuery = useQuery({
    queryKey: ["resource-requests", "official-dashboard"],
    queryFn: () => api.getResourceRequests(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const isLoading =
    marketsQuery.isPending ||
    stallsQuery.isPending ||
    vendorsQuery.isPending ||
    paymentsQuery.isPending ||
    ticketsQuery.isPending ||
    utilityChargesQuery.isPending ||
    penaltiesQuery.isPending ||
    resourceRequestsQuery.isPending;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingState rows={1} itemClassName="h-28 rounded-xl" />
        <LoadingState rows={4} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" itemClassName="h-24 rounded-xl" />
        <LoadingState rows={2} className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" itemClassName="h-[380px] rounded-xl" />
      </div>
    );
  }

  const allMarkets = marketsQuery.data?.markets || [];
  const markets =
    selectedMarketId === "all"
      ? allMarkets
      : allMarkets.filter((market) => market.id === selectedMarketId);
  const stalls = stallsQuery.data?.stalls || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const utilityCharges = utilityChargesQuery.data?.utilityCharges || [];
  const penalties = penaltiesQuery.data?.penalties || [];
  const resourceRequests = resourceRequestsQuery.data?.requests || [];

  const scopedMarketIds = new Set(markets.map((market) => market.id));
  const inScope = (marketId: string | null | undefined) => Boolean(marketId && scopedMarketIds.has(marketId));

  const scopedStalls = stalls.filter((stall) => inScope(stall.marketId));
  const scopedVendors = vendors.filter((vendor) => inScope(vendor.marketId));
  const scopedPayments = payments.filter((payment) => inScope(payment.marketId));
  const scopedTickets = tickets.filter((ticket) => inScope(ticket.marketId));
  const scopedUtilityCharges = utilityCharges.filter((charge) => inScope(charge.marketId));
  const scopedPenalties = penalties.filter((penalty) => inScope(penalty.marketId));
  const scopedResourceRequests = resourceRequests.filter((request) => inScope(request.marketId));

  const openComplaints = scopedTickets.filter((ticket) => ticket.status !== "resolved");
  const highPriorityComplaints = openComplaints.filter((ticket) => getComplaintPriority(ticket) === "High");
  const pendingResourceRequests = scopedResourceRequests.filter((request) => request.status === "pending");
  const overdueUtilityCharges = scopedUtilityCharges.filter((charge) => charge.status === "overdue");
  const openPenalties = scopedPenalties.filter((penalty) => obligationStatuses.has(penalty.status));
  const failedPayments = scopedPayments.filter((payment) => payment.status === "failed");
  const completedPayments = scopedPayments.filter((payment) => payment.status === "completed");

  const totalRevenue = completedPayments.reduce((total, payment) => total + payment.amount, 0);
  const overdueTotal =
    overdueUtilityCharges.reduce((total, charge) => total + charge.amount, 0) +
    openPenalties.reduce((total, penalty) => total + penalty.amount, 0);
  const occupancyRate = scopedStalls.length
    ? Math.round((scopedStalls.filter((stall) => stall.status === "active").length / scopedStalls.length) * 100)
    : 0;

  const kpis = [
    {
      label: "Pending Reviews",
      value: pendingResourceRequests.length,
      detail: "Resource requests awaiting decision",
      icon: ClipboardList,
      tone: pendingResourceRequests.length ? ("warning" as const) : ("default" as const),
    },
    {
      label: "Open Complaints",
      value: openComplaints.length,
      detail: `${highPriorityComplaints.length} high priority`,
      icon: MessageSquare,
      tone: highPriorityComplaints.length ? ("destructive" as const) : ("default" as const),
    },
    {
      label: "Overdue Obligations",
      value: formatCurrency(overdueTotal),
      detail: `${overdueUtilityCharges.length + openPenalties.length} active cases`,
      icon: AlertCircle,
      tone: overdueTotal > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: "Markets Monitored",
      value: markets.length,
      detail: `${occupancyRate}% stall occupancy`,
      icon: Landmark,
      tone: "info" as const,
    },
  ];

  const marketRows = markets.map((market: Market) => {
    const marketStalls = scopedStalls.filter((stall) => stall.marketId === market.id);
    const marketPayments = scopedPayments.filter((payment) => payment.marketId === market.id);
    const marketUtilities = scopedUtilityCharges.filter((charge) => charge.marketId === market.id);
    const marketPenalties = scopedPenalties.filter((penalty) => penalty.marketId === market.id);
    const marketComplaints = scopedTickets.filter((ticket) => ticket.marketId === market.id && ticket.status !== "resolved");
    const marketRequests = scopedResourceRequests.filter((request) => request.marketId === market.id && request.status === "pending");
    const marketFailedPayments = marketPayments.filter((payment) => payment.status === "failed").length;
    const marketOverdue =
      marketUtilities.filter((charge) => charge.status === "overdue").length +
      marketPenalties.filter((penalty) => obligationStatuses.has(penalty.status)).length;
    const activeStalls = marketStalls.filter((stall) => stall.status === "active").length;
    const marketOccupancy = marketStalls.length ? Math.round((activeStalls / marketStalls.length) * 100) : 0;

    return {
      id: market.id,
      name: market.name,
      manager: market.managerName || "Unassigned",
      vendors: market.vendorCount || scopedVendors.filter((vendor) => vendor.marketId === market.id).length,
      occupancy: marketOccupancy,
      complaints: marketComplaints.length,
      overdue: marketOverdue,
      requests: marketRequests.length,
      risk: getMarketRisk({
        openComplaints: marketComplaints.length,
        overdueObligations: marketOverdue,
        pendingRequests: marketRequests.length,
        failedPayments: marketFailedPayments,
      }),
    };
  });

  const priorityResourceRows = sortByCreatedAtDesc(pendingResourceRequests).slice(0, DASHBOARD_CONFIG.RESOURCE_REQUEST_PREVIEW_LIMIT);
  const priorityComplaintRows = sortByCreatedAtDesc(openComplaints).slice(0, DASHBOARD_CONFIG.COMPLAINT_PREVIEW_LIMIT);
  const priorityUtilityRows = [...overdueUtilityCharges]
    .sort((left, right) => Number(right.amount) - Number(left.amount))
    .slice(0, DASHBOARD_CONFIG.UTILITY_PREVIEW_LIMIT);

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Official workspace"
        title="Oversight Desk"
        description="Review requests, market risk, complaints, and payment exceptions across active markets."
        actions={
          <Button asChild>
            <Link to="/official/coordination">Open Requests</Link>
          </Button>
        }
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">{pendingResourceRequests.length} requests</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{openComplaints.length} complaints</span>
          </>
        }
      />

      <KpiStrip items={kpis} columns="grid-cols-2 xl:grid-cols-4" />

      <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Priority Review Queue"
          description="Request decisions, complaint escalation, and overdue obligations."
          className="min-h-[340px]"
          actions={
            <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Filter scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {allMarkets.map((market) => (
                  <SelectItem key={market.id} value={market.id}>
                    {market.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <div className="space-y-3">
            {priorityResourceRows.length === 0 &&
            priorityComplaintRows.length === 0 &&
            priorityUtilityRows.length === 0 ? (
              <EmptyState
                title="No priority actions"
                description="Requests, escalated complaints, and overdue obligations will appear here."
              />
            ) : (
              <>
                {priorityResourceRows.map((request: ResourceRequest) => (
                  <RecordCard key={request.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="status-badge border-warning/25 bg-warning/15 text-warning">Request</span>
                          <p className="truncate text-sm font-semibold">{request.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.marketName} - {request.managerName} - {formatCurrency(request.amountRequested)}
                        </p>
                      </div>
                      <Button asChild size="sm" className="h-8">
                        <Link to="/official/coordination">Review</Link>
                      </Button>
                    </div>
                  </RecordCard>
                ))}

                {priorityComplaintRows.map((ticket: Ticket) => (
                  <RecordCard key={ticket.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="status-badge border-info/20 bg-info/15 text-info">Complaint</span>
                          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ticket.marketName || "Assigned market"} - {ticket.vendorName} - {formatHumanDate(ticket.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={ticket.status} context="ticket" />
                    </div>
                  </RecordCard>
                ))}

                {priorityUtilityRows.map((charge: UtilityCharge) => (
                  <RecordCard key={charge.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="status-badge border-destructive/20 bg-destructive/15 text-destructive">Overdue</span>
                          <p className="truncate text-sm font-semibold">{charge.vendorName}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {charge.marketName || "Assigned market"} - {charge.description}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(charge.amount)}</p>
                    </div>
                  </RecordCard>
                ))}
              </>
            )}
          </div>
        </Panel>

        <Panel
          title="Financial & Occupancy Snapshot"
          description="Operational health indicators across monitored markets."
          className="min-h-[340px]"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">Confirmed Revenue</p>
              <p className="mt-1 text-lg font-bold font-heading">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">Occupancy</p>
              <p className="mt-1 text-lg font-bold font-heading">{occupancyRate}%</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">Failed Payments</p>
              <p className="mt-1 text-lg font-bold font-heading">{failedPayments.length}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">Active Vendors</p>
              <p className="mt-1 text-lg font-bold font-heading">{scopedVendors.length}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Market Risk Register"
        description="A compact operating view for deciding where official attention is needed."
        contentClassName="max-h-[320px] overflow-auto p-0"
      >
        {marketRows.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title="No markets available"
              description="Registered markets will appear here after setup."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Vendors</TableHead>
                <TableHead className="text-right">Occupancy</TableHead>
                <TableHead className="text-right">Complaints</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketRows.map((market) => (
                <TableRow key={market.id}>
                  <TableCell className="font-medium">{market.name}</TableCell>
                  <TableCell className="text-muted-foreground">{market.manager}</TableCell>
                  <TableCell className="text-right">{market.vendors}</TableCell>
                  <TableCell className="text-right">{market.occupancy}%</TableCell>
                  <TableCell className="text-right">{market.complaints}</TableCell>
                  <TableCell className="text-right">{market.overdue}</TableCell>
                  <TableCell className="text-right">{market.requests}</TableCell>
                  <TableCell>
                    <span className={riskClassName(market.risk)}>{market.risk}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </ConsolePage>
  );
};

export default OfficialDashboard;
