import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  Download, 
  Search, 
  Store, 
  Users, 
  Filter,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Building2,
  CreditCard,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type MarketHealth = "healthy" | "watch" | "attention";
type MarketSort = "name" | "vendors" | "stalls" | "status";

const healthConfig = {
  healthy: { label: "admin:markets.health.healthy", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  watch: { label: "admin:markets.health.watch", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  attention: { label: "admin:markets.health.attention", className: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
};

const AdminMarketsPage = () => {
  const { t } = useTranslation();
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
  
  const isLoading = marketsQuery.isPending || vendorsQuery.isPending || paymentsQuery.isPending || ticketsQuery.isPending || utilitiesQuery.isPending;

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

  const totalVendors = vendors.length;
  const totalMarkets = markets.length;
  const totalRevenue = marketRows.reduce((sum, m) => sum + m.revenue, 0);
  const avgOccupancy = marketRows.length ? Math.round(marketRows.reduce((sum, m) => sum + m.activeRate, 0) / marketRows.length) : 0;

  const handleExport = () => {
    const headers = [t("admin:markets.export.name"), t("admin:markets.export.code"), t("admin:markets.export.location"), t("admin:markets.export.region"), t("admin:markets.export.manager"), t("admin:markets.export.vendors"), t("admin:markets.export.stalls"), t("admin:markets.export.activeStalls"), t("admin:markets.export.occupancy"), t("admin:markets.export.revenue"), t("admin:markets.export.openComplaints"), t("admin:markets.export.health")];
    const rows = filteredMarkets.map((m) => [
      m.name,
      m.code,
      m.location,
      m.regionName ?? "",
      m.managerName ?? "",
      m.vendorCount,
      m.stallCount,
      m.activeStallCount,
      m.activeRate,
      m.revenue,
      m.openComplaints,
      t(healthConfig[m.health].label),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `markets-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (marketsQuery.isError || vendorsQuery.isError || paymentsQuery.isError || ticketsQuery.isError || utilitiesQuery.isError) {
    return (
      <Card className="max-w-xl border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">{t("admin:markets.errorTitle")}</h3>
              <p className="text-sm text-red-700">{t("admin:markets.errorDescription")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (<>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{t("admin:markets.title")}</h1>
                  <Badge className="bg-emerald-100 text-emerald-700">{t("admin:badge")}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {t("admin:markets.subtitle")}
                </p>
              </div>
              <Button 
                variant="outline" 
                className="gap-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                onClick={handleExport}
                disabled={isLoading || filteredMarkets.length === 0}
              >
                <Download className="h-4 w-4" />
                {t("admin:markets.exportData")}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:markets.totalMarkets")}</p>
                    <p className="text-2xl font-bold text-slate-900">{totalMarkets}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:markets.totalVendors")}</p>
                    <p className="text-2xl font-bold text-emerald-600">{totalVendors}</p>
                  </div>
                  <Users className="h-8 w-8 text-emerald-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:markets.totalRevenue")}</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalRevenue)}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:markets.avgOccupancy")}</p>
                    <p className="text-2xl font-bold text-purple-600">{avgOccupancy}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 border-slate-200 focus-visible:border-emerald-500"
                  placeholder={t("admin:markets.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            
            <Select value={healthFilter} onValueChange={(value) => setHealthFilter(value as "all" | MarketHealth)}>
              <SelectTrigger className="w-[180px] border-slate-200">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("admin:markets.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin:markets.allStatuses")}</SelectItem>
                <SelectItem value="healthy">{t("admin:markets.health.healthy")}</SelectItem>
                <SelectItem value="watch">{t("admin:markets.health.watch")}</SelectItem>
                <SelectItem value="attention">{t("admin:markets.health.attention")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as MarketSort)}>
              <SelectTrigger className="w-[180px] border-slate-200">
                <SelectValue placeholder={t("admin:markets.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t("admin:markets.sort.name")}</SelectItem>
                <SelectItem value="vendors">{t("admin:markets.sort.vendors")}</SelectItem>
                <SelectItem value="stalls">{t("admin:markets.sort.stalls")}</SelectItem>
                <SelectItem value="status">{t("common:status")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Markets Grid */}
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
              <p className="mt-2 text-sm text-slate-500">{t("admin:markets.loading")}</p>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-12 text-center">
                <Store className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t("admin:markets.noMarketsFound")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("admin:markets.noMarketsDescription")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredMarkets.map((market) => {
                const HealthIcon = healthConfig[market.health].icon;
                return (
                  <Card
                    key={market.id}
                    className="cursor-pointer border-slate-200 bg-white transition-all hover:shadow-lg hover:-translate-y-1"
                    onClick={() => navigate(`/admin/billing?market=${market.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-lg text-slate-900">{market.name}</CardTitle>
                          <CardDescription className="mt-1 flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {market.location || market.regionName || t("admin:markets.locationPending")} • {market.code}
                          </CardDescription>
                        </div>
                        <Badge className={healthConfig[market.health].className}>
                          <HealthIcon className="mr-1 h-3 w-3" />
                          {t(healthConfig[market.health].label)}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <Users className="mx-auto h-4 w-4 text-emerald-600" />
                          <p className="mt-1 text-lg font-bold text-slate-900">{market.vendorCount}</p>
                          <p className="text-xs text-slate-500">{t("admin:markets.stat.vendors")}</p>
                        </div>
                        <div className="text-center">
                          <Store className="mx-auto h-4 w-4 text-emerald-600" />
                          <p className="mt-1 text-lg font-bold text-slate-900">{market.stallCount}</p>
                          <p className="text-xs text-slate-500">{t("admin:markets.stat.stalls")}</p>
                        </div>
                        <div className="text-center">
                          <TrendingUp className="mx-auto h-4 w-4 text-emerald-600" />
                          <p className="mt-1 text-lg font-bold text-slate-900">{market.activeRate}%</p>
                          <p className="text-xs text-slate-500">{t("admin:markets.stat.active")}</p>
                        </div>
                      </div>

                      {/* Progress Bars */}
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{t("admin:markets.capacityInUse")}</span>
                            <span className="font-semibold text-slate-700">{market.activeStallCount}/{market.stallCount}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div 
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${Math.min(market.activeRate, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{t("admin:markets.vendorShare")}</span>
                            <span className="font-semibold text-slate-700">{market.vendorShare}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div 
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${Math.min(market.vendorShare, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t("admin:markets.manager")}</span>
                          <span className="font-medium text-slate-700">{market.managerName || t("admin:markets.unassigned")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t("admin:markets.collections")}</span>
                          <span className="font-medium text-emerald-600">{formatCurrency(market.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t("admin:markets.openComplaints")}</span>
                          <span className={cn("font-medium", market.openComplaints > 0 ? "text-yellow-600" : "text-slate-700")}>
                            {market.openComplaints}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
  </>);
};

export default AdminMarketsPage;
