/**
 * Shared reports page with revenue market breakdown, date range filtering,
 * and CSV export. Accessible to manager and admin roles.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Activity, Download } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/PageLayout";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";

/** Revenue breakdown row for a single market in the reports page. */
interface RevenueMarketRow {
  market: string;
  totalRevenue: number;
  collections: number;
  outstanding: number;
  rate: number;
}

// Dynamic defaults so the report always opens on the current month
const now = new Date();
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

/** ReportsPage - renders the revenue reports dashboard with market breakdown, date filtering, and export. */
const ReportsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [selectedMarketId, setSelectedMarketId] = useState(() => user?.role === "manager" ? user.marketId || "" : "all");

  const marketId = isManager ? user?.marketId || undefined : selectedMarketId === "all" ? undefined : selectedMarketId;
  const marketsQuery = useQuery({ queryKey: ["markets", "revenue-report"], queryFn: () => api.getMarkets() });
  const revenueQuery = useQuery({
    queryKey: ["reports", "revenue", dateFrom, dateTo, marketId || "all"],
    queryFn: () => api.getRevenueReport(dateFrom, dateTo, marketId),
  });
  const duesQuery = useQuery({
    queryKey: ["reports", "dues", dateFrom, dateTo, marketId || "all"],
    queryFn: () => api.getDuesReport(dateFrom, dateTo, marketId),
  });

  const isLoading = marketsQuery.isPending || revenueQuery.isPending || duesQuery.isPending;
  const isError = marketsQuery.isError || revenueQuery.isError || duesQuery.isError;

  const rows = useMemo<RevenueMarketRow[]>(() => {
    const markets = marketsQuery.data?.markets || [];
    const revenueRows = revenueQuery.data?.rows || [];
    const duesRows = duesQuery.data?.rows || [];

    if (revenueRows.length === 0 && duesRows.length === 0) return [];

    const marketNames = new Map(markets.map((market) => [market.id, market.name]));
    const ids = new Set<string>();
    revenueRows.forEach((row) => row.marketId && ids.add(row.marketId));
    duesRows.forEach((row) => row.marketId && ids.add(row.marketId));

    return Array.from(ids).map((id) => {
      const collections = revenueRows.filter((row) => row.marketId === id).reduce((sum, row) => sum + row.amount, 0);
      const outstanding = duesRows.filter((row) => row.marketId === id).reduce((sum, row) => sum + row.outstandingAmount, 0);
      const totalRevenue = collections + outstanding;
      const rate = totalRevenue > 0 ? (collections / totalRevenue) * 100 : 100;
      return {
        market: marketNames.get(id) || revenueRows.find((row) => row.marketId === id)?.marketName || "Market",
        totalRevenue, collections, outstanding, rate,
      };
    });
  }, [duesQuery.data?.rows, marketsQuery.data?.markets, revenueQuery.data?.rows]);

  const totals = rows.reduce(
    (acc, row) => ({ totalRevenue: acc.totalRevenue + row.totalRevenue, collections: acc.collections + row.collections, outstanding: acc.outstanding + row.outstanding }),
    { totalRevenue: 0, collections: 0, outstanding: 0 },
  );
  const collectionRate = totals.totalRevenue > 0 ? (totals.collections / totals.totalRevenue) * 100 : 0;

  const exportCSV = () => {
    const header = `${t("reports:csvHeader")}\n`;
    const body = rows.map((row) => [row.market, row.totalRevenue, row.collections, row.outstanding, `${row.rate.toFixed(2)}%`].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revenue_report_${dateFrom}_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <PageLayout>
        <Alert variant="destructive" className="max-w-xl"><AlertTitle>{t("reports:errorLoading")}</AlertTitle><AlertDescription>{t("reports:errorLoadingDesc")}</AlertDescription></Alert>
      </PageLayout>
    );
  }

  if (isLoading) {
    return <PageLayout><LoadingState rows={6} itemClassName="h-28 rounded-lg" /></PageLayout>;
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow={t("reports:eyebrow")}
        title={t("reports:title")}
        description={t("reports:subtitle")}
        actions={
          <Button onClick={exportCSV} className="h-9 gap-2 rounded-lg shadow-none font-bold">
            <Download className="h-4 w-4" />
            {t("reports:exportCsv")}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("reports:market")}</p>
          {isManager ? (
            <div className="flex h-9 min-w-[220px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              {user?.marketName || t("reports:assignedMarket")}
            </div>
          ) : (
            <select value={selectedMarketId} onChange={(e) => setSelectedMarketId(e.target.value)} className="h-9 min-w-[220px] rounded-lg border-2 border-slate-300 bg-white px-3 text-sm focus:border-primary focus:outline-none">
              <option value="all">{t("reports:allMarkets")}</option>
              {(marketsQuery.data?.markets || []).map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("reports:from")}</p>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[170px] border-2 border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("reports:to")}</p>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[170px] border-2 border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("reports:totalRevenue")} value={formatCurrency(totals.totalRevenue)} sublabel="" icon={<Activity className="h-4 w-4" />} />
        <StatCard label={t("reports:totalCollections")} value={formatCurrency(totals.collections)} sublabel="" icon={<Activity className="h-4 w-4" />} />
        <StatCard label={t("reports:outstanding")} value={formatCurrency(totals.outstanding)} sublabel="" icon={<Activity className="h-4 w-4" />} />
        <StatCard label={t("reports:collectionRate")} value={`${collectionRate.toFixed(2)}%`} sublabel="" icon={<Activity className="h-4 w-4" />} />
      </div>

      {/* Table */}
      <DataTable
        columns={[
          { key: "market", header: t("reports:market"), cell: (row: RevenueMarketRow) => <span className="font-semibold text-slate-900">{row.market}</span> },
          { key: "totalRevenue", header: t("reports:totalRevenueUgx"), cell: (row: RevenueMarketRow) => <span className="tabular-nums">{row.totalRevenue.toLocaleString()}</span>, className: "text-right" },
          { key: "collections", header: t("reports:collectionsUgx"), cell: (row: RevenueMarketRow) => <span className="tabular-nums">{row.collections.toLocaleString()}</span>, className: "text-right" },
          { key: "outstanding", header: t("reports:outstandingUgx"), cell: (row: RevenueMarketRow) => <span className="tabular-nums">{row.outstanding.toLocaleString()}</span>, className: "text-right" },
          { key: "rate", header: t("reports:rate"), cell: (row: RevenueMarketRow) => <Badge variant={row.rate >= 95 ? "success" : "warning"}>{row.rate.toFixed(2)}%</Badge>, className: "text-right" },
        ]}
        data={rows}
        keyExtractor={(row: RevenueMarketRow) => row.market}
        emptyState={
          <EmptyState
            title={t("reports:noData")}
          />
        }
      />
      {/* Totals */}
      <div className="-mt-px rounded-b-xl border border-t-0 border-[#F1F3F5] bg-[#F8F9FA]">
        <div className="grid grid-cols-5 px-4 py-3 text-sm font-bold text-slate-900">
          <span>{t("reports:total")}</span>
          <span className="text-right tabular-nums">{totals.totalRevenue.toLocaleString()}</span>
          <span className="text-right tabular-nums">{totals.collections.toLocaleString()}</span>
          <span className="text-right tabular-nums">{totals.outstanding.toLocaleString()}</span>
          <span className="text-right">{collectionRate.toFixed(2)}%</span>
        </div>
      </div>
    </PageLayout>
  );
};

export default ReportsPage;
