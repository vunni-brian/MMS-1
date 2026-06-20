import { useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { StatusBadge } from "@/components/StatusBadge";
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
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneClasses}`}>
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
    <Skeleton className="h-24 w-full rounded-lg" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <Skeleton key={item} className="h-28 rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
  </div>
);

const ErrorState = ({ title }: { title: string }) => {
  const { t } = useTranslation();
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1">{t("common:errorLoading")}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const riskBadgeVariant = (risk: RiskLevel) =>
  risk === "High" ? "destructive" : risk === "Medium" ? "secondary" : "default";

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getMonthKey = (value: string, t: (key: string) => string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("common:notAvailable");
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(date);
};

const useOfficialOversightData = () => {
  const { t } = useTranslation();
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

  const markets = useMemo(() => marketsQuery.data?.markets ?? [], [marketsQuery.data]);
  const vendors = useMemo(() => vendorsQuery.data?.vendors ?? [], [vendorsQuery.data]);
  const stalls = useMemo(() => stallsQuery.data?.stalls ?? [], [stallsQuery.data]);
  const payments = useMemo(() => paymentsQuery.data?.payments ?? [], [paymentsQuery.data]);
  const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data]);
  const utilityCharges = useMemo(() => utilitiesQuery.data?.utilityCharges ?? [], [utilitiesQuery.data]);
  const penalties = useMemo(() => penaltiesQuery.data?.penalties ?? [], [penaltiesQuery.data]);
  const auditEvents = useMemo(() => auditQuery.data?.events ?? [], [auditQuery.data]);
  const resourceRequests = useMemo(() => resourcesQuery.data?.requests ?? [], [resourcesQuery.data]);

  const marketHealth = useMemo(
    () => buildMarketHealth(markets, vendors, stalls, payments, tickets, utilityCharges, penalties, t),
    [markets, vendors, stalls, payments, tickets, utilityCharges, penalties, t],
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
    t,
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
  t: (key: string, options?: Record<string, unknown>) => string,
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
      escalatedComplaints.length ? t("official:markets.escalatedComplaints", { n: escalatedComplaints.length }) : null,
      sanitationComplaints.length ? t("official:markets.sanitationIssues", { n: sanitationComplaints.length }) : null,
      maintenanceStalls ? t("official:markets.stallsMaintenance", { n: maintenanceStalls }) : null,
      overdueObligations ? t("official:markets.overdueObligations", { n: overdueObligations }) : null,
    ].filter(Boolean) as string[];

    const risk: RiskLevel = complianceScore < 65 || escalatedComplaints.length > 2
      ? "High"
      : complianceScore < 80 || alerts.length > 0
        ? "Medium"
        : "Low";

    return {
      id: market.id,
      name: market.name,
      location: market.locationName || market.location || market.subAreaName || t("common:notSet"),
      managerName: market.managerName || t("common:notAssigned"),
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
  const { t, isLoading, isError, marketHealth, vendors, stalls, tickets, payments } = useOfficialOversightData();
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
  if (isError) return <ErrorState title={t("official:markets.errorTitle")} />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("official:markets.eyebrow")}
        title={t("official:markets.title")}
        subtitle={t("official:markets.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("official:markets.marketsMonitored")} value={marketHealth.length} subtitle={t("official:markets.kccaScope")} icon={Landmark} tone="blue" />
        <MetricCard title={t("official:markets.registeredVendors")} value={vendors.length.toLocaleString()} subtitle={t("official:markets.allMarkets")} icon={Users} tone="teal" />
        <MetricCard title={t("official:markets.stallOccupancy")} value={`${occupancyRate}%`} subtitle={t("official:markets.occupiedFraction", { occupied: occupiedStalls, total: stalls.length })} icon={Store} tone="green" />
        <MetricCard title={t("official:markets.openComplaints")} value={openComplaints} subtitle={formatCurrency(totalRevenue)} icon={AlertTriangle} tone={openComplaints ? "amber" : "green"} />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t("official:markets.performanceRegister")}</CardTitle>
            <CardDescription>{t("official:markets.performanceDesc")}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("official:markets.searchMarkets")} className="h-9 w-full pl-9 sm:w-64" />
            </div>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as "all" | RiskLevel)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t("official:markets.allRiskLevels")}</option>
              <option value="High">{t("official:markets.highRisk")}</option>
              <option value="Medium">{t("official:markets.mediumRisk")}</option>
              <option value="Low">{t("official:markets.lowRisk")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">{t("official:markets.market")}</th>
                  <th className="py-3 pr-4 font-semibold">{t("official:markets.manager")}</th>
                  <th className="py-3 pr-4 text-right font-semibold">{t("official:markets.vendors")}</th>
                  <th className="py-3 pr-4 text-right font-semibold">{t("official:markets.occupancy")}</th>
                  <th className="py-3 pr-4 text-right font-semibold">{t("official:markets.revenue")}</th>
                  <th className="py-3 pr-4 text-right font-semibold">{t("official:markets.openIssues")}</th>
                  <th className="py-3 pr-4 text-right font-semibold">{t("official:markets.score")}</th>
                  <th className="py-3 font-semibold">{t("official:markets.risk")}</th>
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
  const { t, isLoading, isError, markets, vendors } = useOfficialOversightData();
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
    const header = `${t("official:vendors.vendor")},${t("common:phone")},${t("common:email")},${t("common:market")},${t("official:vendors.business")},${t("official:vendors.district")},${t("common:status")},${t("official:vendors.documents")}\n`;
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
  if (isError) return <ErrorState title={t("official:vendors.errorTitle")} />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("official:vendors.eyebrow")}
        title={t("official:vendors.title")}
        subtitle={t("official:vendors.subtitle")}
        actions={
          <Button onClick={exportCsv} className="h-9 gap-2 rounded-lg">
            <Download className="h-4 w-4" />
            {t("common:exportCsv")}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("official:vendors.totalVendors")} value={vendors.length.toLocaleString()} subtitle={t("official:vendors.registeredRecords")} icon={Users} tone="blue" />
        <MetricCard title={t("official:vendors.approved")} value={approved} subtitle={t("official:vendors.activeMarketAccess")} icon={CheckCircle2} tone="green" />
        <MetricCard title={t("official:vendors.pending")} value={pending} subtitle={t("official:vendors.awaitingReview")} icon={FileSearch} tone="amber" />
        <MetricCard title={t("official:vendors.rejected")} value={rejected} subtitle={t("official:vendors.notCleared")} icon={ShieldAlert} tone={rejected ? "red" : "slate"} />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t("official:vendors.readOnlyRegistry")}</CardTitle>
            <CardDescription>{t("official:vendors.recordsMatch", { n: filtered.length })}</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("official:vendors.searchVendors")} className="h-9 pl-9" />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value as "all" | VendorProfile["status"])} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="all">{t("official:vendors.allStatuses")}</option>
              <option value="approved">{t("common:approved")}</option>
              <option value="pending">{t("common:pending")}</option>
              <option value="rejected">{t("common:rejected")}</option>
            </select>
            <select value={marketId} onChange={(event) => setMarketId(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="all">{t("common:allMarkets")}</option>
              {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">{t("official:vendors.vendor")}</th>
                  <th className="py-3 pr-4 font-semibold">{t("common:market")}</th>
                  <th className="py-3 pr-4 font-semibold">{t("official:vendors.business")}</th>
                  <th className="py-3 pr-4 font-semibold">{t("official:vendors.district")}</th>
                  <th className="py-3 pr-4 font-semibold">{t("official:vendors.documents")}</th>
                  <th className="py-3 font-semibold">{t("common:status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((vendor) => {
                  const documentsComplete = vendor.documentValidation?.nationalIdPresent && vendor.documentValidation?.lcLetterPresent;
                  return (
                    <tr key={vendor.id} className="hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{vendor.name}</p>
                        <p className="text-xs text-muted-foreground">{vendor.phone} | {vendor.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{vendor.marketName || t("official:vendors.unassigned")}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{vendor.productSection || t("common:notSet")}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{vendor.district || t("common:notSet")}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={documentsComplete ? "default" : "secondary"}>
                          {documentsComplete ? t("official:vendors.complete") : t("official:vendors.incomplete")}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <StatusBadge status={vendor.status} context="vendor" />
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
  const { t, isLoading, isError, marketHealth, tickets, stalls, utilityCharges, penalties, resourceRequests } = useOfficialOversightData();

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
  if (isError) return <ErrorState title={t("official:compliance.errorTitle")} />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("official:compliance.eyebrow")}
        title={t("official:compliance.title")}
        subtitle={t("official:compliance.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("official:compliance.avgScore")} value={`${avgScore}%`} subtitle={t("official:compliance.scoreBreakdown", { green, amber, red })} icon={ShieldCheck} tone={avgScore >= 80 ? "green" : avgScore >= 65 ? "amber" : "red"} />
        <MetricCard title={t("official:compliance.escalatedComplaints")} value={escalated.length} subtitle={t("official:compliance.slaBreach")} icon={AlertTriangle} tone={escalated.length ? "red" : "green"} />
        <MetricCard title={t("official:compliance.sanitationIssues")} value={openSanitation.length} subtitle={t("official:compliance.openSanitationTickets")} icon={ShieldAlert} tone={openSanitation.length ? "amber" : "green"} />
        <MetricCard title={t("official:compliance.overdueObligations")} value={overdueUtilityCharges.length + unpaidPenalties.length} subtitle={t("official:compliance.utilitiesPenalties")} icon={ReceiptText} tone={overdueUtilityCharges.length + unpaidPenalties.length ? "amber" : "green"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{t("official:compliance.complianceScorecard")}</CardTitle>
            <CardDescription>{t("official:compliance.scorecardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {marketHealth.map((row) => (
                <div key={row.id} className="rounded-lg border border-border p-4">
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
                    {(row.alerts.length ? row.alerts : [t("official:compliance.noAlerts")]).map((alert) => (
                      <span key={alert} className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{alert}</span>
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
              <CardTitle>{t("official:compliance.attentionQueue")}</CardTitle>
              <CardDescription>{t("official:compliance.attentionDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: t("official:compliance.pendingResourceRequests"), value: pendingResources.length, tone: pendingResources.length ? "text-amber-700" : "text-emerald-700" },
                { label: t("official:compliance.stallsInMaintenance"), value: maintenanceStalls.length, tone: maintenanceStalls.length ? "text-amber-700" : "text-emerald-700" },
                { label: t("official:compliance.overdueUtilityCharges"), value: overdueUtilityCharges.length, tone: overdueUtilityCharges.length ? "text-red-700" : "text-emerald-700" },
                { label: t("official:compliance.unpaidPenalties"), value: unpaidPenalties.length, tone: unpaidPenalties.length ? "text-red-700" : "text-emerald-700" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-bold ${item.tone}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("official:compliance.recentEscalations")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {escalated.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold text-foreground">{ticket.ticketNumber} - {ticket.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ticket.marketName || t("common:market")} | {formatHumanDateTime(ticket.updatedAt)}</p>
                </div>
              ))}
              {!escalated.length ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("official:compliance.noEscalations")}
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
  const { t, isLoading, isError, marketHealth, vendors, payments } = useOfficialOversightData();

  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const revenueByMonth = Object.values(
    completedPayments.reduce<Record<string, { period: string; amount: number; transactions: number }>>((acc, payment) => {
      const key = getMonthKey(payment.createdAt, t);
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
  if (isError) return <ErrorState title={t("official:analytics.errorTitle")} />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("official:analytics.eyebrow")}
        title={t("official:analytics.title")}
        subtitle={t("official:analytics.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("official:analytics.collectedRevenue")} value={formatCurrency(totalRevenue)} subtitle={t("official:analytics.completedPayments", { n: completedPayments.length })} icon={TrendingUp} tone="green" />
        <MetricCard title={t("official:analytics.paymentCompletion")} value={`${paymentCompletionRate}%`} subtitle={t("official:analytics.totalPaymentRecords", { n: payments.length })} icon={ReceiptText} tone={paymentCompletionRate >= 90 ? "green" : "amber"} />
        <MetricCard title={t("official:analytics.avgCompliance")} value={`${avgCompliance}%`} subtitle={t("official:analytics.acrossMonitoredMarkets")} icon={ShieldCheck} tone={avgCompliance >= 80 ? "green" : "amber"} />
        <MetricCard title={t("official:analytics.vendorCategories")} value={vendorCategories.length} subtitle={t("official:analytics.vendorRecords", { n: vendors.length })} icon={BarChart3} tone="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("official:analytics.monthlyCollections")}</CardTitle>
            <CardDescription>{t("official:analytics.monthlyCollectionsDesc")}</CardDescription>
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
                  <Tooltip formatter={(value: number) => [formatCurrency(value), t("official:analytics.revenueLabel")]} />
                  <Area type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={2} fill="url(#officialRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{t("official:analytics.noPaymentData")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("official:analytics.paymentMethods")}</CardTitle>
            <CardDescription>{t("official:analytics.paymentMethodsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMethod.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByMethod}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), t("official:analytics.revenueLabel")]} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {revenueByMethod.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{t("official:analytics.noPaymentMethodData")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("official:analytics.revenueByMarket")}</CardTitle>
            <CardDescription>{t("official:analytics.revenueByMarketDesc")}</CardDescription>
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
              {!topMarkets.length ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("official:analytics.noMarketRevenue")}</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("official:analytics.vendorDistribution")}</CardTitle>
            <CardDescription>{t("official:analytics.vendorDistributionDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vendorCategories.map((item, index) => {
                const width = vendors.length ? Math.max(4, Math.round((item.count / vendors.length) * 100)) : 0;
                return (
                  <div key={item.category}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{item.category}</span>
                      <span className="shrink-0 text-muted-foreground">{t("official:analytics.vendorSuffix", { n: item.count })}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: chartColors[index % chartColors.length] }} />
                    </div>
                  </div>
                );
              })}
              {!vendorCategories.length ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("official:analytics.noVendorCategories")}</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
