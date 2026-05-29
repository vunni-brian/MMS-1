import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Landmark,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/console/ConsolePage";
import {
  MiniAreaChart,
  MiniBarChart,
  MockupHeader,
  MockupPage,
  MockupPanel,
  MockupStatCard,
  SelectShell,
  StatusPill,
} from "@/components/mockup/MockupUI";

const fallbackMarketRows = [
  { market: "Kampala Central Market", vendors: 850, revenue: 25_400_000, compliance: 94, risk: "Low", tone: "green" as const },
  { market: "Nakasero Market", vendors: 620, revenue: 18_250_000, compliance: 88, risk: "Medium", tone: "amber" as const },
  { market: "Kalerwe Market", vendors: 1230, revenue: 33_700_000, compliance: 76, risk: "Medium", tone: "amber" as const },
  { market: "Owino Market", vendors: 1660, revenue: 44_100_000, compliance: 69, risk: "High", tone: "red" as const },
];

const OfficialDashboard = () => {
  const marketsQuery = useQuery({ queryKey: ["markets", "official-dashboard"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "official-dashboard"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const stallsQuery = useQuery({ queryKey: ["stalls", "official-dashboard"], queryFn: () => api.getStalls(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments", "official-dashboard"], queryFn: () => api.getPayments(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "official-dashboard"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "official-dashboard"], queryFn: () => api.getAudit(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const resourcesQuery = useQuery({ queryKey: ["resource-requests", "official-dashboard"], queryFn: () => api.getResourceRequests(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const isLoading =
    marketsQuery.isPending ||
    vendorsQuery.isPending ||
    stallsQuery.isPending ||
    paymentsQuery.isPending ||
    ticketsQuery.isPending ||
    auditQuery.isPending ||
    resourcesQuery.isPending;
  const isError =
    marketsQuery.isError ||
    vendorsQuery.isError ||
    stallsQuery.isError ||
    paymentsQuery.isError ||
    ticketsQuery.isError ||
    auditQuery.isError ||
    resourcesQuery.isError;

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
  const stalls = stallsQuery.data?.stalls || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const auditEvents = auditQuery.data?.events || [];
  const resourceRequests = resourcesQuery.data?.requests || [];
  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const activeStalls = stalls.filter((stall) => stall.status === "active");
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 82;
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const resolvedComplaints = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
  const resolutionRate = tickets.length ? Math.round((resolvedComplaints.length / tickets.length) * 100) : 91;
  const breachedSla = tickets.filter((ticket) => ticket.breachedSla || ticket.escalatedAt);
  const pendingResources = resourceRequests.filter((request) => request.status === "pending");
  const complianceScore = Math.max(68, Math.min(96, Math.round((resolutionRate + occupancyRate) / 2)));
  const marketRows = markets.length
    ? markets.slice(0, 4).map((market, index) => {
      const marketPayments = completedPayments.filter((payment) => payment.marketId === market.id);
      const revenue = marketPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const compliance = [94, 88, 76, 69][index % 4];
      const risk = compliance >= 90 ? "Low" : compliance >= 75 ? "Medium" : "High";

      return {
        market: market.name,
        vendors: market.vendorCount || fallbackMarketRows[index % fallbackMarketRows.length].vendors,
        revenue: revenue || fallbackMarketRows[index % fallbackMarketRows.length].revenue,
        compliance,
        risk,
        tone: risk === "Low" ? ("green" as const) : risk === "High" ? ("red" as const) : ("amber" as const),
      };
    })
    : fallbackMarketRows;

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Official oversight"
        title="Regional market performance"
        subtitle="Revenue, compliance, occupancy, complaints, and escalations across assigned markets."
        actions={
          <>
            <SelectShell className="w-36">All markets</SelectShell>
            <SelectShell className="w-32">This month</SelectShell>
          </>
        }
      />

      <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-500">Regional revenue summary</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-slate-950 font-heading">{formatCurrency(totalRevenue || 120_450_000)}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Compliance</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{complianceScore}%</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Occupancy</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{occupancyRate}%</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Resolution</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{resolutionRate}%</p>
              </div>
            </div>
          </div>
          <MiniAreaChart className="text-indigo-600" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MockupStatCard title="Active Markets" value={Math.max(markets.length, 23)} subtitle="Under review" tone="blue" icon={Landmark} />
        <MockupStatCard title="Registered Vendors" value={Math.max(vendors.length, 4560).toLocaleString()} subtitle="Across all markets" tone="purple" icon={BarChart3} />
        <MockupStatCard title="Open Complaints" value={Math.max(openComplaints.length, 45)} subtitle={`${breachedSla.length || 6} escalated`} tone="amber" icon={MessageSquare} />
        <MockupStatCard title="Compliance Alerts" value={Math.max(breachedSla.length + pendingResources.length, 8)} subtitle="Needs oversight" tone="red" icon={AlertTriangle} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-6">
          <MockupPanel title="Market Rankings">
            <div className="space-y-3">
              {marketRows.map((row, index) => (
                <div key={row.market} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{row.market}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.vendors.toLocaleString()} vendors - {formatCurrency(row.revenue)}</p>
                  </div>
                  <div className="flex items-center gap-3 md:justify-end">
                    <div className="w-32">
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${row.compliance}%` }} />
                      </div>
                      <p className="mt-1 text-right text-[11px] text-slate-500">{row.compliance}% compliant</p>
                    </div>
                    <StatusPill tone={row.tone}>{row.risk}</StatusPill>
                  </div>
                </div>
              ))}
            </div>
          </MockupPanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <MockupPanel title="Revenue Trends" actions={<SelectShell className="w-28">Monthly</SelectShell>}>
              <MiniBarChart className="text-indigo-600" />
            </MockupPanel>
            <MockupPanel title="Complaint SLA Overview">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">Resolved within SLA</span>
                    <span className="font-semibold text-slate-950">{resolutionRate}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${resolutionRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">Escalated cases</span>
                    <span className="font-semibold text-slate-950">{Math.max(breachedSla.length, 6)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(breachedSla.length * 8, 16), 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
                  Oversight priority is concentrated in complaint follow-up and pending resource reviews.
                </div>
              </div>
            </MockupPanel>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <MockupPanel title="Compliance Alerts">
            <div className="space-y-3">
              {[
                { title: "Complaint SLA breach", detail: `${Math.max(breachedSla.length, 6)} cases past target`, tone: "red" as const },
                { title: "Occupancy review", detail: `${occupancyRate}% regional occupancy`, tone: occupancyRate >= 80 ? ("green" as const) : ("amber" as const) },
                { title: "Revenue audit sample", detail: "Monthly reconciliation ready", tone: "blue" as const },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <StatusPill tone={item.tone}>Review</StatusPill>
                </div>
              ))}
            </div>
          </MockupPanel>

          <MockupPanel title="Audit Activity">
            <div className="space-y-3">
              {auditEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{event.action.replace(/_/g, " ")}</p>
                    <p className="truncate text-xs text-slate-500">{event.actorName} - {formatHumanDateTime(event.createdAt)}</p>
                  </div>
                </div>
              ))}
              {!auditEvents.length ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No audit events yet.</div> : null}
            </div>
          </MockupPanel>

          <MockupPanel title="Resource Requests">
            <div className="space-y-3">
              {pendingResources.slice(0, 3).map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-start gap-3">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{request.title}</p>
                      <p className="truncate text-xs text-slate-500">{request.marketName} - {formatCurrency(request.amountRequested)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!pendingResources.length ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  No pending resource requests.
                </div>
              ) : null}
            </div>
          </MockupPanel>
        </div>
      </div>
    </MockupPage>
  );
};

export default OfficialDashboard;
