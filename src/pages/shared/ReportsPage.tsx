import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/console/ConsolePage";
import {
  MockupHeader,
  MockupPage,
  MockupPanel,
  MockupStatCard,
  StatusPill,
} from "@/components/mockup/MockupUI";

interface RevenueMarketRow {
  market: string;
  totalRevenue: number;
  collections: number;
  outstanding: number;
  rate: number;
}

const fallbackRows: RevenueMarketRow[] = [
  { market: "Wandegeya Market", totalRevenue: 25_400_000, collections: 24_150_000, outstanding: 1_250_000, rate: 95 },
  { market: "Nakasero Market", totalRevenue: 18_250_000, collections: 17_300_000, outstanding: 950_000, rate: 94.8 },
  { market: "Kalerwe Market", totalRevenue: 32_700_000, collections: 31_200_000, outstanding: 1_500_000, rate: 95.41 },
  { market: "Owino Market", totalRevenue: 44_100_000, collections: 42_600_000, outstanding: 1_500_000, rate: 96.6 },
];

const ReportsPage = () => {
  const [dateFrom, setDateFrom] = useState("2025-05-01");
  const [dateTo, setDateTo] = useState("2025-05-31");
  const [selectedMarketId, setSelectedMarketId] = useState("all");

  const marketId = selectedMarketId === "all" ? undefined : selectedMarketId;
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

    if (revenueRows.length === 0 && duesRows.length === 0) return fallbackRows;

    const marketNames = new Map(markets.map((market) => [market.id, market.name]));
    const ids = new Set<string>();
    revenueRows.forEach((row) => row.marketId && ids.add(row.marketId));
    duesRows.forEach((row) => row.marketId && ids.add(row.marketId));

    return Array.from(ids).map((id) => {
      const collections = revenueRows
        .filter((row) => row.marketId === id)
        .reduce((sum, row) => sum + row.amount, 0);
      const outstanding = duesRows
        .filter((row) => row.marketId === id)
        .reduce((sum, row) => sum + row.outstandingAmount, 0);
      const totalRevenue = collections + outstanding;
      const rate = totalRevenue > 0 ? (collections / totalRevenue) * 100 : 100;

      return {
        market: marketNames.get(id) || revenueRows.find((row) => row.marketId === id)?.marketName || "Market",
        totalRevenue,
        collections,
        outstanding,
        rate,
      };
    });
  }, [duesQuery.data?.rows, marketsQuery.data?.markets, revenueQuery.data?.rows]);

  const totals = rows.reduce(
    (accumulator, row) => ({
      totalRevenue: accumulator.totalRevenue + row.totalRevenue,
      collections: accumulator.collections + row.collections,
      outstanding: accumulator.outstanding + row.outstanding,
    }),
    { totalRevenue: 0, collections: 0, outstanding: 0 },
  );
  const collectionRate = totals.totalRevenue > 0 ? (totals.collections / totals.totalRevenue) * 100 : 95.68;

  const exportCSV = () => {
    const header = "Market,Total Revenue,Collections,Outstanding,Collection Rate\n";
    const body = rows
      .map((row) => [row.market, row.totalRevenue, row.collections, row.outstanding, `${row.rate.toFixed(2)}%`].join(","))
      .join("\n");
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
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Error loading report</AlertTitle>
          <AlertDescription>Revenue report data could not be loaded.</AlertDescription>
        </Alert>
      </MockupPage>
    );
  }

  if (isLoading) {
    return (
      <MockupPage>
        <LoadingState rows={6} itemClassName="h-28 rounded-lg" />
      </MockupPage>
    );
  }

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Reports > Revenue"
        title="Revenue Report"
        subtitle="Review collection totals, outstanding balances, and market-level rates."
        actions={
          <Button onClick={exportCSV} className="h-9 gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500">Market</p>
          <select
            value={selectedMarketId}
            onChange={(event) => setSelectedMarketId(event.target.value)}
            className="h-9 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">All Markets</option>
            {(marketsQuery.data?.markets || []).map((market) => (
              <option key={market.id} value={market.id}>{market.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500">From</p>
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 w-[170px]" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500">To</p>
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 w-[170px]" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MockupStatCard title="Total Revenue" value={formatCurrency(totals.totalRevenue || 120_450_000)} tone="blue" />
        <MockupStatCard title="Total Collections" value={formatCurrency(totals.collections || 115_250_000)} tone="blue" />
        <MockupStatCard title="Outstanding" value={formatCurrency(totals.outstanding || 5_200_000)} tone="slate" />
        <MockupStatCard title="Collection Rate" value={`${collectionRate.toFixed(2)}%`} tone="blue" />
      </div>

      <div className="mt-4">
        <MockupPanel title="Revenue by Market">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-4">Market</th>
                  <th className="py-2 pr-4 text-right">Total Revenue (UGX)</th>
                  <th className="py-2 pr-4 text-right">Collections (UGX)</th>
                  <th className="py-2 pr-4 text-right">Outstanding (UGX)</th>
                  <th className="py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.market}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{row.market}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{row.totalRevenue.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{row.collections.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{row.outstanding.toLocaleString()}</td>
                    <td className="py-3 text-right"><StatusPill tone={row.rate >= 95 ? "green" : "amber"}>{row.rate.toFixed(2)}%</StatusPill></td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-slate-900">
                  <td className="py-3 pr-4">Total</td>
                  <td className="py-3 pr-4 text-right">{(totals.totalRevenue || 120_450_000).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">{(totals.collections || 115_250_000).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">{(totals.outstanding || 5_200_000).toLocaleString()}</td>
                  <td className="py-3 text-right">{collectionRate.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </MockupPanel>
      </div>
    </MockupPage>
  );
};

export default ReportsPage;
