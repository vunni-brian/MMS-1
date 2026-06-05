import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Download, Search, Store, Users } from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { api } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 ConsolePage,
 EmptyState,
 LoadingState,
 WorkspacePage,
} from "@/components/console/ConsolePage";

type MarketHealth = "healthy" | "watch" | "attention";
type MarketSort = "name" | "vendors" | "stalls" | "status";

const healthLabels: Record<MarketHealth, string> = {
 healthy: "Healthy",
 watch: "Watch",
 attention: "Attention",
};

const healthClassName = (health: MarketHealth) => {
 if (health === "healthy") return "status-badge border-success/20 bg-success/15 text-success";
 if (health === "watch") return "status-badge border-warning/25 bg-warning/15 text-warning";
 return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
};

const getMarketHealth = ({
 failedPayments,
 openComplaints,
 unpaidUtilityAmount,
}: {
 failedPayments: number;
 openComplaints: number;
 unpaidUtilityAmount: number;
}): MarketHealth => {
 if (failedPayments > 1 || openComplaints > 4 || unpaidUtilityAmount >= 2_000_000) return "attention";
 if (failedPayments > 0 || openComplaints > 0 || unpaidUtilityAmount > 0) return "watch";
 return "healthy";
};

const AdminMarketsPage = () => {
 const navigate = useNavigate();
 const [search, setSearch] = useState("");
 const [healthFilter, setHealthFilter] = useState<"all" | MarketHealth>("all");
 const [sortBy, setSortBy] = useState<MarketSort>("name");

 const marketsQuery = useQuery({
 queryKey: ["markets", "admin-markets-page"],
 queryFn: () => api.getMarkets(),
 gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
 });

 const vendorsQuery = useQuery({
 queryKey: ["vendors", "admin-markets-page"],
 queryFn: () => api.getVendors(),
 gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
 });

 const paymentsQuery = useQuery({
 queryKey: ["payments", "admin-markets-page"],
 queryFn: () => api.getPayments(),
 refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
 gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
 });

 const ticketsQuery = useQuery({
 queryKey: ["tickets", "admin-markets-page"],
 queryFn: () => api.getTickets(),
 gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
 });

 const utilitiesQuery = useQuery({
 queryKey: ["utility-charges", "admin-markets-page"],
 queryFn: () => api.getUtilityCharges(),
 gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
 });

 const markets = useMemo(() => marketsQuery.data?.markets ?? [], [marketsQuery.data?.markets]);
 const vendors = useMemo(() => vendorsQuery.data?.vendors ?? [], [vendorsQuery.data?.vendors]);
 const payments = useMemo(() => paymentsQuery.data?.payments ?? [], [paymentsQuery.data?.payments]);
 const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data?.tickets]);
 const utilityCharges = useMemo(() => utilitiesQuery.data?.utilityCharges ?? [], [utilitiesQuery.data?.utilityCharges]);
 const isLoading =
 marketsQuery.isPending ||
 vendorsQuery.isPending ||
 paymentsQuery.isPending ||
 ticketsQuery.isPending ||
 utilitiesQuery.isPending;

 const marketRows = useMemo(() => {
 return markets.map((market) => {
 const marketPayments = payments.filter((payment) => payment.marketId === market.id);
 const marketTickets = tickets.filter((ticket) => ticket.marketId === market.id && ticket.status !== "resolved");
 const marketUtilities = utilityCharges.filter((charge) => charge.marketId === market.id);
 const revenue = marketPayments
 .filter((payment) => payment.status === "completed")
 .reduce((sum, payment) => sum + payment.amount, 0);
 const failedPayments = marketPayments.filter((payment) => payment.status === "failed").length;
 const unpaidUtilityAmount = marketUtilities
 .filter((charge) => ["unpaid", "pending", "pending_payment", "overdue"].includes(charge.status))
 .reduce((sum, charge) => sum + charge.amount, 0);
 const activeRate = market.stallCount ? Math.round((market.activeStallCount / market.stallCount) * 100) : 0;
 const vendorShare = vendors.length ? Math.round((market.vendorCount / vendors.length) * 100) : 0;
 const health = getMarketHealth({
 failedPayments,
 openComplaints: marketTickets.length,
 unpaidUtilityAmount,
 });

 return {
 ...market,
 activeRate,
 vendorShare,
 revenue,
 failedPayments,
 unpaidUtilityAmount,
 openComplaints: marketTickets.length,
 health,
 };
 });
 }, [markets, payments, tickets, utilityCharges, vendors.length]);

 const filteredMarkets = useMemo(() => {
 const term = search.trim().toLowerCase();

 return [...marketRows]
 .filter((market) => {
 const matchesHealth = healthFilter === "all" || market.health === healthFilter;
 const matchesSearch =
 !term ||
 [market.name, market.code, market.location, market.managerName || "", market.regionName || ""]
 .join(" ")
 .toLowerCase()
 .includes(term);

 return matchesHealth && matchesSearch;
 })
 .sort((left, right) => {
 if (sortBy === "vendors") return right.vendorCount - left.vendorCount;
 if (sortBy === "stalls") return right.stallCount - left.stallCount;
 if (sortBy === "status") return left.health.localeCompare(right.health);
 return left.name.localeCompare(right.name);
 });
 }, [healthFilter, marketRows, search, sortBy]);

 const attentionCount = marketRows.filter((market) => market.health === "attention").length;
 const context = `${markets.length} markets - ${vendors.length} vendors - ${attentionCount} need attention`;

 return (
 <ConsolePage>
 <WorkspacePage
 title="Markets"
 subtitle="Manage market setup, capacity, managers, and operating health."
 context={context}
 actions={
 <Button variant="outline" className="gap-2">
 <Download className="h-4 w-4" />
 Export
 </Button>
 }
 filters={
 <>
 <div className="w-full min-w-[220px] flex-1 lg:max-w-[420px]">
 <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 className="pl-9"
 placeholder="Search market, region, code, manager..."
 value={search}
 onChange={(event) => setSearch(event.target.value)}
 />
 </div>
 </div>
 <div className="w-full sm:w-[180px]">
 <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
 <Select value={healthFilter} onValueChange={(value) => setHealthFilter(value as "all" | MarketHealth)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All statuses</SelectItem>
 <SelectItem value="healthy">Healthy</SelectItem>
 <SelectItem value="watch">Watch</SelectItem>
 <SelectItem value="attention">Attention</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="w-full sm:w-[180px]">
 <label className="mb-1 block text-xs font-medium text-muted-foreground">Sort</label>
 <Select value={sortBy} onValueChange={(value) => setSortBy(value as MarketSort)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="name">Name</SelectItem>
 <SelectItem value="vendors">Vendors</SelectItem>
 <SelectItem value="stalls">Stalls</SelectItem>
 <SelectItem value="status">Status</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </>
 }
 >
 {isLoading ? (
 <div className="p-4">
 <LoadingState rows={8} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" itemClassName="h-[190px] rounded-sm" />
 </div>
 ) : filteredMarkets.length === 0 ? (
 <div className="p-4">
 <EmptyState title="No markets found" description="Try a different search, status, or sort option." />
 </div>
 ) : (
 <div className="admin-market-grid p-4">
 {filteredMarkets.map((market) => (
 <article
 key={market.id}
 className="admin-market-card cursor-pointer transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 onClick={() => navigate(`/admin/billing?market=${market.id}`)}
 title={`View billing for ${market.name}`}
 tabIndex={0}
 role="button"
 onKeyDown={(e) => e.key === "Enter" && navigate(`/admin/billing?market=${market.id}`)}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate text-base font-semibold font-heading">{market.name}</p>
 <p className="mt-1 truncate text-xs text-muted-foreground">
 {market.location || market.regionName || "Location pending"} - {market.code}
 </p>
 </div>
 <span className={healthClassName(market.health)}>{healthLabels[market.health]}</span>
 </div>

 <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
 <div className="admin-market-metric">
 <Users className="h-4 w-4 text-primary" />
 <span>{market.vendorCount}</span>
 <small>Vendors</small>
 </div>
 <div className="admin-market-metric">
 <Store className="h-4 w-4 text-primary" />
 <span>{market.stallCount}</span>
 <small>Stalls</small>
 </div>
 <div className="admin-market-metric">
 <span className="text-sm font-bold text-primary">{market.activeRate}%</span>
 <small>Active</small>
 </div>
 </div>

 <div className="mt-4 space-y-3">
 <div>
 <div className="mb-1 flex items-center justify-between text-xs">
 <span className="text-muted-foreground">Capacity in use</span>
 <span className="font-semibold">{market.activeStallCount}/{market.stallCount}</span>
 </div>
 <div className="admin-progress-track">
 <span style={{ width: `${Math.min(market.activeRate, 100)}%` }} />
 </div>
 </div>
 <div>
 <div className="mb-1 flex items-center justify-between text-xs">
 <span className="text-muted-foreground">Vendor share</span>
 <span className="font-semibold">{market.vendorShare}%</span>
 </div>
 <div className="admin-progress-track is-muted">
 <span style={{ width: `${Math.min(market.vendorShare, 100)}%` }} />
 </div>
 </div>
 </div>

 <div className="mt-4 grid gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
 <div className="flex justify-between gap-3">
 <span>Manager</span>
 <strong className="truncate text-foreground">{market.managerName || "Unassigned"}</strong>
 </div>
 <div className="flex justify-between gap-3">
 <span>Collections</span>
 <strong className="text-foreground">{formatCurrency(market.revenue)}</strong>
 </div>
 <div className="flex justify-between gap-3">
 <span>Open complaints</span>
 <strong className={cn("text-foreground", market.openComplaints > 0 && "text-warning")}>
 {market.openComplaints}
 </strong>
 </div>
 </div>
 </article>
 ))}
 </div>
 )}
 </WorkspacePage>
 </ConsolePage>
 );
};

export default AdminMarketsPage;
