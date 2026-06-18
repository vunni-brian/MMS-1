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
import { LoadingState, PageHeader } from "@/components/console/ConsolePage";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/PageLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        subtitle={t("reports:subtitle")}
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
        <StatCard title={t("reports:totalRevenue")} value={formatCurrency(totals.totalRevenue)} subtitle="" icon={Activity} tone="success" />
        <StatCard title={t("reports:totalCollections")} value={formatCurrency(totals.collections)} subtitle="" icon={Activity} tone="success" />
        <StatCard title={t("reports:outstanding")} value={formatCurrency(totals.outstanding)} subtitle="" icon={Activity} tone={totals.outstanding > 0 ? "warning" : "success"} />
        <StatCard title={t("reports:collectionRate")} value={`${collectionRate.toFixed(2)}%`} subtitle="" icon={Activity} tone={collectionRate >= 90 ? "success" : "warning"} />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <CardTitle className="text-base font-medium">{t("reports:revenueByMarket")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
            {t("reports:noData")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 pr-4">{t("reports:market")}</th>
                  <th className="py-3 pr-4 text-right">{t("reports:totalRevenueUgx")}</th>
                  <th className="py-3 pr-4 text-right">{t("reports:collectionsUgx")}</th>
                  <th className="py-3 pr-4 text-right">{t("reports:outstandingUgx")}</th>
                  <th className="py-3 text-right">{t("reports:rate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.market} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{row.market}</td>
                    <td className="py-3 pr-4 text-right text-slate-600 tabular-nums">{row.totalRevenue.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-slate-600 tabular-nums">{row.collections.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-slate-600 tabular-nums">{row.outstanding.toLocaleString()}</td>
                    <td className="py-3 text-right"><Badge variant={row.rate >= 95 ? "success" : "warning"}>{row.rate.toFixed(2)}%</Badge></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                  <td className="py-3 pr-4">{t("reports:total")}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{totals.totalRevenue.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{totals.collections.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{totals.outstanding.toLocaleString()}</td>
                  <td className="py-3 text-right">{collectionRate.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default ReportsPage;
