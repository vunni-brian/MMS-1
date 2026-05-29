import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/console/ConsolePage";
import {
  MiniBarChart,
  MockupHeader,
  MockupPage,
  MockupPanel,
  MockupStatCard,
  SelectShell,
  StatusPill,
} from "@/components/mockup/MockupUI";

const fallbackMarketRows = [
  { market: "Wandegeya Market", vendors: 850, revenue: 25_400_000, compliance: "92%", risk: "Low", tone: "green" as const },
  { market: "Nakasero Market", vendors: 620, revenue: 18_250_000, compliance: "88%", risk: "Medium", tone: "amber" as const },
  { market: "Kalerwe Market", vendors: 1230, revenue: 33_700_000, compliance: "65%", risk: "Medium", tone: "amber" as const },
  { market: "Owino Market", vendors: 1660, revenue: 44_100_000, compliance: "70%", risk: "High", tone: "red" as const },
];

const OfficialDashboard = () => {
  const marketsQuery = useQuery({ queryKey: ["markets", "official-dashboard"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "official-dashboard"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments", "official-dashboard"], queryFn: () => api.getPayments(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "official-dashboard"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const isLoading = marketsQuery.isPending || vendorsQuery.isPending || paymentsQuery.isPending || ticketsQuery.isPending;
  const isError = marketsQuery.isError || vendorsQuery.isError || paymentsQuery.isError || ticketsQuery.isError;

  if (isError) {
    return (
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Could not load official dashboard</AlertTitle>
          <AlertDescription>There was a problem loading oversight data.</AlertDescription>
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

  const markets = marketsQuery.data?.markets || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const marketRows = markets.length
    ? markets.slice(0, 4).map((market, index) => {
      const marketPayments = completedPayments.filter((payment) => payment.marketId === market.id);
      const revenue = marketPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const complianceValue = [92, 88, 65, 70][index % 4];
      const risk = complianceValue >= 90 ? "Low" : complianceValue >= 70 ? "Medium" : "High";

      return {
        market: market.name,
        vendors: market.vendorCount || fallbackMarketRows[index % fallbackMarketRows.length].vendors,
        revenue: revenue || fallbackMarketRows[index % fallbackMarketRows.length].revenue,
        compliance: `${complianceValue}%`,
        risk,
        tone: risk === "Low" ? ("green" as const) : risk === "High" ? ("red" as const) : ("amber" as const),
      };
    })
    : fallbackMarketRows;

  return (
    <MockupPage>
      <MockupHeader
        title="Official Dashboard"
        subtitle="Regional market performance, compliance, and revenue oversight."
        actions={
          <>
            <SelectShell className="w-36">All Markets</SelectShell>
            <SelectShell className="w-32">This Month</SelectShell>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MockupStatCard title="Total Markets" value={Math.max(markets.length, 23)} subtitle="Active" tone="blue" />
        <MockupStatCard title="Total Vendors" value={Math.max(vendors.length, 4560).toLocaleString()} subtitle="Across All Markets" tone="purple" />
        <MockupStatCard title="Total Revenue" value={formatCurrency(totalRevenue || 120_450_000)} subtitle="This Month" tone="blue" />
        <MockupStatCard title="Open Complaints" value={Math.max(openComplaints.length, 45)} subtitle="Across All Markets" tone="purple" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <MockupPanel title="Market Performance">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-4">Market</th>
                  <th className="py-2 pr-4 text-right">Vendors</th>
                  <th className="py-2 pr-4 text-right">Revenue (UGX)</th>
                  <th className="py-2 pr-4 text-right">Compliance</th>
                  <th className="py-2 text-center">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketRows.map((row) => (
                  <tr key={row.market}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{row.market}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{row.vendors.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{row.revenue.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{row.compliance}</td>
                    <td className="py-3 text-center"><StatusPill tone={row.tone}>{row.risk}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MockupPanel>

        <MockupPanel
          title="Revenue Trend (All Markets)"
          actions={<SelectShell className="w-28">This Month</SelectShell>}
        >
          <MiniBarChart />
        </MockupPanel>
      </div>
    </MockupPage>
  );
};

export default OfficialDashboard;
