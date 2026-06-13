import { useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileSearch,
  Landmark,
  ReceiptText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Market,
  Payment,
  Penalty,
  Stall,
  Ticket,
  UtilityCharge,
  VendorProfile,
} from "@/types";

const chartColors = ["#0f766e", "#2563eb", "#f59e0b", "#7c3aed", "#dc2626", "#0891b2"];

type RiskLevel = "Low" | "Medium" | "High";

interface MarketHealthRow {
  id: string;
  name: string;
  location: string;
  managerName: string;
  vendors: number;
  approvedVendors: number;
  stalls: number;
  occupiedStalls: number;
  maintenanceStalls: number;
  occupancyRate: number;
  revenue: number;
  pendingRevenue: number;
  openComplaints: number;
  escalatedComplaints: number;
  sanitationComplaints: number;
  complianceScore: number;
  risk: RiskLevel;
  alerts: string[];
}

const PageIntro = ({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  value: ReactNode;
  subtitle: string;
  icon: ElementType;
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "teal";
}) => {
  const toneClasses = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    teal: "bg-teal-100 text-teal-700",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingGrid = () => (
  <div className="space-y-6">
    <Skeleton className="h-24 w-full rounded-sm" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <Skeleton key={item} className="h-28 rounded-sm" />
      ))}
    </div>
    <Skeleton className="h-96 w-full rounded-sm" />
  </div>
);

const ErrorState = ({ title }: { title: string }) => (
  <Card className="border-red-200 bg-red-50">
    <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1">Oversight data could not be loaded. Refresh the page or check the API connection.</p>
      </div>
    </CardContent>
  </Card>
);

const riskBadgeVariant = (risk: RiskLevel) =>
  risk === "High" ? "destructive" : risk === "Medium" ? "secondary" : "default";

const statusBadgeVariant = (status: VendorProfile["status"]) =>
  status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getMonthKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(date);
};

const useOfficialOversightData = () => {
  const marketsQuery = useQuery({ queryKey: ["markets", "official-oversight"], queryFn: () => api.getMarkets() });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "official-oversight"], queryFn: () => api.getVendors() });
  const stallsQuery = useQuery({ queryKey: ["stalls", "official-oversight"], queryFn: () => api.getStalls() });
  const paymentsQuery = useQuery({ queryKey: ["payments", "official-oversight"], queryFn: () => api.getPayments() });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "official-oversight"], queryFn: () => api.getTickets() });
  const utilitiesQuery = useQuery({ queryKey: ["utility-charges", "official-oversight"], queryFn: () => api.getUtilityCharges() });
  const penaltiesQuery = useQuery({ queryKey: ["penalties", "official-oversight"], queryFn: () => api.getPenalties() });
  const auditQuery = useQuery({ queryKey: ["audit", "official-oversight"], queryFn: () => api.getAudit() });
  const resourcesQuery = useQuery({ queryKey: ["resource-requests", "official-oversight"], queryFn: () => api.getResourceRequests() });

  const queries = [
    marketsQuery,
    vendorsQuery,
    stallsQuery,
    paymentsQuery,
    ticketsQuery,
    utilitiesQuery,
    penaltiesQuery,
    auditQuery,
    resourcesQuery,
  ];

  const markets = marketsQuery.data?.markets ?? [];
  const vendors = vendorsQuery.data?.vendors ?? [];
  const stalls = stallsQuery.data?.stalls ?? [];
  const payments = paymentsQuery.data?.payments ?? [];
  const tickets = ticketsQuery.data?.tickets ?? [];
  const utilityCharges = utilitiesQuery.data?.utilityCharges ?? [];
  const penalties = penaltiesQuery.data?.penalties ?? [];
  const auditEvents = auditQuery.data?.events ?? [];
  const resourceRequests = resourcesQuery.data?.requests ?? [];

  const marketHealth = useMemo(
    () => buildMarketHealth(markets, vendors, stalls, payments, tickets, utilityCharges, penalties),
    [markets, vendors, stalls, payments, tickets, utilityCharges, penalties],
  );

  return {
    isLoading: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
    markets,
    vendors,
    stalls,
    payments,
    tickets,
    utilityCharges,
    penalties,
    auditEvents,
    resourceRequests,
    marketHealth,
  };
};

const buildMarketHealth = (
  markets: Market[],
  vendors: VendorProfile[],
  stalls: Stall[],
  payments: Payment[],
  tickets: Ticket[],
  utilityCharges: UtilityCharge[],
  penalties: Penalty[],
): MarketHealthRow[] => {
  return markets.map((market) => {
    const marketVendors = vendors.filter((vendor) => vendor.marketId === market.id);
    const marketStalls = stalls.filter((stall) => stall.marketId === market.id);
    const marketPayments = payments.filter((payment) => payment.marketId === market.id);
    const marketTickets = tickets.filter((ticket) => ticket.marketId === market.id);
    const marketUtilityCharges = utilityCharges.filter((charge) => charge.marketId === market.id);
    const marketPenalties = penalties.filter((penalty) => penalty.marketId === market.id);

    const completedPayments = marketPayments.filter((payment) => payment.status === "completed");
    const pendingPayments = marketPayments.filter((payment) => payment.status === "pending");
    const openComplaints = marketTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
    const escalatedComplaints = openComplaints.filter((ticket) => ticket.escalatedAt || ticket.breachedSla);
    const sanitationComplaints = openComplaints.filter((ticket) => ticket.category === "sanitation");
    const resolvedComplaints = marketTickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
    const maintenanceStalls = marketStalls.filter((stall) => stall.status === "maintenance").length;
    const occupiedStalls = marketStalls.filter((stall) => stall.vendorId || stall.activeBooking).length;
    const occupancyRate = marketStalls.length ? Math.round((occupiedStalls / marketStalls.length) * 100) : 0;
    const approvedVendors = marketVendors.filter((vendor) => vendor.status === "approved").length;
    const vendorApprovalRate = marketVendors.length ? (approvedVendors / marketVendors.length) * 100 : 100;
    const complaintResolutionRate = marketTickets.length ? (resolvedComplaints.length / marketTickets.length) * 100 : 100;
    const paymentCompletionRate = marketPayments.length ? (completedPayments.length / marketPayments.length) * 100 : 100;
    const maintenancePenalty = marketStalls.length ? (maintenanceStalls / marketStalls.length) * 100 : 0;
    const overdueObligations = marketUtilityCharges.filter((charge) => charge.status === "overdue").length +
      marketPenalties.filter((penalty) => penalty.status === "unpaid").length;

    const complianceScore = clampScore(
      vendorApprovalRate * 0.25 +
      complaintResolutionRate * 0.3 +
      paymentCompletionRate * 0.25 +
      Math.min(occupancyRate, 100) * 0.1 +
      (100 - Math.min(maintenancePenalty + overdueObligations * 3, 45)) * 0.1,
    );

    const alerts = [
      escalatedComplaints.length ? `${escalatedComplaints.length} escalated complaint(s)` : null,
      sanitationComplaints.length ? `${sanitationComplaints.length} sanitation complaint(s)` : null,
      maintenanceStalls ? `${maintenanceStalls} stall(s) in maintenance` : null,
      overdueObligations ? `${overdueObligations} overdue obligation(s)` : null,
    ].filter(Boolean) as string[];

    const risk: RiskLevel = complianceScore < 65 || escalatedComplaints.length > 2
      ? "High"
      : complianceScore < 80 || alerts.length > 0
        ? "Medium"
        : "Low";

    return {
      id: market.id,
      name: market.name,
      location: market.locationName || market.location || market.subAreaName || "Location not set",
      managerName: market.managerName || "Unassigned",
      vendors: marketVendors.length || market.vendorCount || 0,
      approvedVendors,
      stalls: marketStalls.length || market.stallCount || 0,
      occupiedStalls,
      maintenanceStalls,
      occupancyRate,
      revenue: completedPayments.reduce((sum, payment) => sum + payment.amount, 0),
      pendingRevenue: pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
      openComplaints: openComplaints.length,
      escalatedComplaints: escalatedComplaints.length,
      sanitationComplaints: sanitationComplaints.length,
      complianceScore,
      risk,
      alerts,
    };
  }).sort((a, b) => a.complianceScore - b.complianceScore || b.openComplaints - a.openComplaints);
};

export const OfficialMarketsPage = () => {
  const { isLoading, isError, marketHealth, vendors, stalls, tickets, payments } = useOfficialOversightData();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

  const rows = marketHealth.filter((row) => {
    const matchesSearch = `${row.name} ${row.location} ${row.managerName}`.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === "all" || row.risk === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const totalRevenue = payments.filter((payment) => payment.status === "completed").reduce((sum, payment) => sum + payment.amount, 0);
  const occupiedStalls = stalls.filter((stall) => stall.vendorId || stall.activeBooking).length;
  const occupancyRate = stalls.length ? Math.round((occupiedStalls / stalls.length) * 100) : 0;
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;

  if (isLoading) return <LoadingGrid />;
  if (isError) return <ErrorState title="Could not load market monitoring" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="KCCA oversight"
        title="Market monitoring"
        subtitle="Read-only supervision across markets, stall occupancy, revenue movement, complaints, and compliance risk."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Markets monitored" value={marketHealth.length} subtitle="KCCA scope" icon={Landmark} tone="blue" />
        <MetricCard title="Registered vendors" value={vendors.length.toLocaleString()} subtitle="All markets" icon={Users} tone="teal" />
        <MetricCard title="Stall occupancy" value={`${occupancyRate}%`} subtitle={`${occupiedStalls}/${stalls.length} occupied`} icon={Store} tone="green" />
        <MetricCard title="Open complaints" value={openComplaints} subtitle={formatCurrency(totalRevenue)} icon={AlertTriangle} tone={openComplaints ? "amber" : "green"} />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Market performance register</CardTitle>
            <CardDescription>Ranked by current compliance risk so officials see problem markets first.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search markets..." className="h-9 w-full pl-9 sm:w-64" />
            </div>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as "all" | RiskLevel)}
              className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
            >
              <option value="all">All risk levels</option>
              <option value="High">High risk</option>
              <option value="Medium">Medium risk</option>
              <option value="Low">Low risk</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Market</th>
                  <th className="py-3 pr-4 font-semibold">Manager</th>
                  <th className="py-3 pr-4 text-right font-semibold">Vendors</th>
                  <th className="py-3 pr-4 text-right font-semibold">Occupancy</th>
                  <th className="py-3 pr-4 text-right font-semibold">Revenue</th>
                  <th className="py-3 pr-4 text-right font-semibold">Open Issues</th>
                  <th className="py-3 pr-4 text-right font-semibold">Score</th>
                  <th className="py-3 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.location}</p>
                      {row.alerts.length ? <p className="mt-1 text-xs text-amber-700">{row.alerts[0]}</p> : null}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.managerName}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{row.vendors}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{row.occupancyRate}%</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(row.revenue)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{row.openComplaints}</td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">{row.complianceScore}%</td>
                    <td className="py-3">
                      <Badge variant={riskBadgeVariant(row.risk)}>{row.risk}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const OfficialVendorDirectoryPage = () => {
  const { isLoading, isError, markets, vendors } = useOfficialOversightData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | VendorProfile["status"]>("all");
  const [marketId, setMarketId] = useState("all");

  const filtered = vendors.filter((vendor) => {
    const haystack = `${vendor.name} ${vendor.phone} ${vendor.email} ${vendor.marketName} ${vendor.productSection} ${vendor.district}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesStatus = status === "all" || vendor.status === status;
    const matchesMarket = marketId === "all" || vendor.marketId === marketId;
    return matchesSearch && matchesStatus && matchesMarket;
  });

  const approved = vendors.filter((vendor) => vendor.status === "approved").length;
  const pending = vendors.filter((vendor) => vendor.status === "pending").length;
  const rejected = vendors.filter((vendor) => vendor.status === "rejected").length;

  const exportCsv = () => {
    const header = "Name,Phone,Email,Market,Product Section,District,Status,Documents\n";
    const body = filtered.map((vendor) => [
      vendor.name,
      vendor.phone,
      vendor.email,
      vendor.marketName || "",
      vendor.productSection || "",
      vendor.district || "",
      vendor.status,
      vendor.documentValidation.nationalIdPresent && vendor.documentValidation.lcLetterPresent ? "complete" : "incomplete",
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "official_vendor_directory.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingGrid />;
  if (isError) return <ErrorState title="Could not load vendor listings" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="KCCA oversight"
        title="Vendor listings"
        subtitle="Read-only vendor registry for search, filtering, and export. Officials can inspect records without approving or modifying them."
        actions={
          <Button onClick={exportCsv} className="h-9 gap-2 rounded-sm">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total vendors" value={vendors.length.toLocaleString()} subtitle="Registered records" icon={Users} tone="blue" />
        <MetricCard title="Approved" value={approved} subtitle="Active market access" icon={CheckCircle2} tone="green" />
        <MetricCard title="Pending" value={pending} subtitle="Awaiting manager review" icon={FileSearch} tone="amber" />
        <MetricCard title="Rejected" value={rejected} subtitle="Not cleared" icon={ShieldAlert} tone={rejected ? "red" : "slate"} />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Read-only registry</CardTitle>
            <CardDescription>{filtered.length} vendor record(s) match the current filters.</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendors..." className="h-9 pl-9" />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value as "all" | VendorProfile["status"])} className="h-9 rounded-sm border border-input bg-background px-3 text-sm">
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={marketId} onChange={(event) => setMarketId(event.target.value)} className="h-9 rounded-sm border border-input bg-background px-3 text-sm">
              <option value="all">All markets</option>
              {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Vendor</th>
                  <th className="py-3 pr-4 font-semibold">Market</th>
                  <th className="py-3 pr-4 font-semibold">Business</th>
                  <th className="py-3 pr-4 font-semibold">District</th>
                  <th className="py-3 pr-4 font-semibold">Documents</th>
                  <th className="py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((vendor) => {
                  const documentsComplete = vendor.documentValidation.nationalIdPresent && vendor.documentValidation.lcLetterPresent;
                  return (
                    <tr key={vendor.id} className="hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{vendor.name}</p>
                        <p className="text-xs text-muted-foreground">{vendor.phone} | {vendor.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{vendor.marketName || "Unassigned"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{vendor.productSection || "Not set"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{vendor.district || "Not set"}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={documentsComplete ? "default" : "secondary"}>
                          {documentsComplete ? "Complete" : "Incomplete"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={statusBadgeVariant(vendor.status)} className="capitalize">{vendor.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const OfficialCompliancePage = () => {
  const { isLoading, isError, marketHealth, tickets, stalls, utilityCharges, penalties, resourceRequests } = useOfficialOversightData();

  const green = marketHealth.filter((row) => row.complianceScore >= 80).length;
  const amber = marketHealth.filter((row) => row.complianceScore >= 65 && row.complianceScore < 80).length;
  const red = marketHealth.filter((row) => row.complianceScore < 65).length;
  const avgScore = marketHealth.length
    ? Math.round(marketHealth.reduce((sum, row) => sum + row.complianceScore, 0) / marketHealth.length)
    : 0;
  const openSanitation = tickets.filter((ticket) => ticket.category === "sanitation" && !["resolved", "closed"].includes(ticket.status));
  const escalated = tickets.filter((ticket) => ticket.escalatedAt || ticket.breachedSla);
  const maintenanceStalls = stalls.filter((stall) => stall.status === "maintenance");
  const overdueUtilityCharges = utilityCharges.filter((charge) => charge.status === "overdue");
  const unpaidPenalties = penalties.filter((penalty) => penalty.status === "unpaid");
  const pendingResources = resourceRequests.filter((request) => request.status === "pending");

  if (isLoading) return <LoadingGrid />;
  if (isError) return <ErrorState title="Could not load compliance reporting" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Governance"
        title="Compliance reporting"
        subtitle="Operational compliance indicators covering complaint SLA, sanitation issues, overdue dues, maintenance, and unresolved resource needs."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Average score" value={`${avgScore}%`} subtitle={`${green} green, ${amber} medium, ${red} high risk`} icon={ShieldCheck} tone={avgScore >= 80 ? "green" : avgScore >= 65 ? "amber" : "red"} />
        <MetricCard title="Escalated complaints" value={escalated.length} subtitle="SLA breach or escalated" icon={AlertTriangle} tone={escalated.length ? "red" : "green"} />
        <MetricCard title="Sanitation issues" value={openSanitation.length} subtitle="Open sanitation tickets" icon={ShieldAlert} tone={openSanitation.length ? "amber" : "green"} />
        <MetricCard title="Overdue obligations" value={overdueUtilityCharges.length + unpaidPenalties.length} subtitle="Utilities and penalties" icon={ReceiptText} tone={overdueUtilityCharges.length + unpaidPenalties.length ? "amber" : "green"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Market compliance scorecard</CardTitle>
            <CardDescription>Scores combine vendor verification, payment completion, complaint resolution, occupancy, and maintenance signals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {marketHealth.map((row) => (
                <div key={row.id} className="rounded-sm border border-border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.location}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{row.complianceScore}%</span>
                      <Badge variant={riskBadgeVariant(row.risk)}>{row.risk}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${row.complianceScore >= 80 ? "bg-emerald-500" : row.complianceScore >= 65 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${row.complianceScore}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(row.alerts.length ? row.alerts : ["No active compliance alerts"]).map((alert) => (
                      <span key={alert} className="rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">{alert}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attention queue</CardTitle>
              <CardDescription>Items requiring official follow-up.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Pending resource requests", value: pendingResources.length, tone: pendingResources.length ? "text-amber-700" : "text-emerald-700" },
                { label: "Stalls in maintenance", value: maintenanceStalls.length, tone: maintenanceStalls.length ? "text-amber-700" : "text-emerald-700" },
                { label: "Overdue utility charges", value: overdueUtilityCharges.length, tone: overdueUtilityCharges.length ? "text-red-700" : "text-emerald-700" },
                { label: "Unpaid penalties", value: unpaidPenalties.length, tone: unpaidPenalties.length ? "text-red-700" : "text-emerald-700" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-sm bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-bold ${item.tone}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent escalations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {escalated.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="rounded-sm border border-border p-3 text-sm">
                  <p className="font-semibold text-foreground">{ticket.ticketNumber} - {ticket.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ticket.marketName || "Market"} | {formatHumanDateTime(ticket.updatedAt)}</p>
                </div>
              ))}
              {!escalated.length ? (
                <div className="flex items-center gap-2 rounded-sm bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  No escalated complaints.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const OfficialAnalyticsPage = () => {
  const { isLoading, isError, marketHealth, vendors, payments } = useOfficialOversightData();

  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const revenueByMonth = Object.values(
    completedPayments.reduce<Record<string, { period: string; amount: number; transactions: number }>>((acc, payment) => {
      const key = getMonthKey(payment.createdAt);
      acc[key] = acc[key] || { period: key, amount: 0, transactions: 0 };
      acc[key].amount += payment.amount;
      acc[key].transactions += 1;
      return acc;
    }, {}),
  ).slice(-8);

  const revenueByMethod = Object.values(
    completedPayments.reduce<Record<string, { method: string; amount: number }>>((acc, payment) => {
      const key = payment.method;
      acc[key] = acc[key] || { method: key.toUpperCase(), amount: 0 };
      acc[key].amount += payment.amount;
      return acc;
    }, {}),
  );

  const vendorCategories = Object.values(
    vendors.reduce<Record<string, { category: string; count: number }>>((acc, vendor) => {
      const key = vendor.productSection || "Unspecified";
      acc[key] = acc[key] || { category: key, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count).slice(0, 6);

  const topMarkets = [...marketHealth].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const paymentCompletionRate = payments.length ? Math.round((completedPayments.length / payments.length) * 100) : 100;
  const avgCompliance = marketHealth.length ? Math.round(marketHealth.reduce((sum, row) => sum + row.complianceScore, 0) / marketHealth.length) : 0;

  if (isLoading) return <LoadingGrid />;
  if (isError) return <ErrorState title="Could not load revenue analytics" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Analytics"
        title="Revenue analytics"
        subtitle="Revenue, payment method, vendor distribution, and market performance trends for decision support."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Collected revenue" value={formatCurrency(totalRevenue)} subtitle={`${completedPayments.length} completed payment(s)`} icon={TrendingUp} tone="green" />
        <MetricCard title="Payment completion" value={`${paymentCompletionRate}%`} subtitle={`${payments.length} total payment records`} icon={ReceiptText} tone={paymentCompletionRate >= 90 ? "green" : "amber"} />
        <MetricCard title="Average compliance" value={`${avgCompliance}%`} subtitle="Across monitored markets" icon={ShieldCheck} tone={avgCompliance >= 80 ? "green" : "amber"} />
        <MetricCard title="Vendor categories" value={vendorCategories.length} subtitle={`${vendors.length} vendor records`} icon={BarChart3} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly collections</CardTitle>
            <CardDescription>Completed payments grouped by month.</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMonth.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueByMonth}>
                  <defs>
                    <linearGradient id="officialRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                  <Area type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={2} fill="url(#officialRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-sm border border-dashed text-sm text-muted-foreground">No completed payment data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Completed revenue split by channel.</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMethod.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByMethod}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {revenueByMethod.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-sm border border-dashed text-sm text-muted-foreground">No payment method data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by market</CardTitle>
            <CardDescription>Highest revenue markets in the current dataset.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topMarkets.map((row, index) => {
                const width = totalRevenue ? Math.max(4, Math.round((row.revenue / totalRevenue) * 100)) : 0;
                return (
                  <div key={row.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{index + 1}. {row.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
              {!topMarkets.length ? <div className="rounded-sm border border-dashed p-8 text-center text-sm text-muted-foreground">No market revenue yet.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor category distribution</CardTitle>
            <CardDescription>Most common product sections in the registry.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vendorCategories.map((item, index) => {
                const width = vendors.length ? Math.max(4, Math.round((item.count / vendors.length) * 100)) : 0;
                return (
                  <div key={item.category}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{item.category}</span>
                      <span className="shrink-0 text-muted-foreground">{item.count} vendor(s)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: chartColors[index % chartColors.length] }} />
                    </div>
                  </div>
                );
              })}
              {!vendorCategories.length ? <div className="rounded-sm border border-dashed p-8 text-center text-sm text-muted-foreground">No vendor categories yet.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
