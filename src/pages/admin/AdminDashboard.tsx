import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, Database, UserPlus } from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/console/ConsolePage";
import {
  MockupHeader,
  MockupPage,
  MockupPanel,
  MockupStatCard,
  StatusPill,
} from "@/components/mockup/MockupUI";

const fallbackActivity = [
  { id: "user", icon: UserPlus, title: "New vendor registered", detail: "Peter Ssali - Nakasero Market", time: "2 mins ago", tone: "blue" as const },
  { id: "payment", icon: CreditCard, title: "Payment received", detail: "UGX 250,000 from John Mugabi", time: "5 mins ago", tone: "green" as const },
  { id: "approved", icon: UserPlus, title: "Vendor approved", detail: "Nabbuga Grace - Wandegeya Market", time: "10 mins ago", tone: "blue" as const },
  { id: "backup", icon: Database, title: "System backup completed", detail: "Database backup successful", time: "30 mins ago", tone: "green" as const },
];

const AdminDashboard = () => {
  const marketsQuery = useQuery({ queryKey: ["markets", "admin-dashboard"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "admin-dashboard"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments", "admin-dashboard"], queryFn: () => api.getPayments(), refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "admin-dashboard"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "admin-dashboard"], queryFn: () => api.getAudit(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const isLoading =
    marketsQuery.isPending ||
    vendorsQuery.isPending ||
    paymentsQuery.isPending ||
    ticketsQuery.isPending ||
    auditQuery.isPending;

  const isError =
    marketsQuery.isError ||
    vendorsQuery.isError ||
    paymentsQuery.isError ||
    ticketsQuery.isError ||
    auditQuery.isError;

  if (isError) {
    return (
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Could not load system overview</AlertTitle>
          <AlertDescription>There was a problem loading system administration data.</AlertDescription>
        </Alert>
      </MockupPage>
    );
  }

  if (isLoading) {
    return (
      <MockupPage>
        <LoadingState rows={7} itemClassName="h-28 rounded-lg" />
      </MockupPage>
    );
  }

  const markets = marketsQuery.data?.markets || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const auditEvents = auditQuery.data?.events || [];
  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const recentActivity = auditEvents.length
    ? auditEvents.slice(0, 4).map((event, index) => ({
      id: event.id,
      icon: index % 2 === 0 ? UserPlus : CreditCard,
      title: event.action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
      detail: `${event.actorName} - ${event.marketName || "System"}`,
      time: formatHumanDateTime(event.createdAt),
      tone: index % 2 === 0 ? ("blue" as const) : ("green" as const),
    }))
    : fallbackActivity;
  const alertRows = [
    { id: "complaints", title: "High complaint volume", detail: `${Math.max(openTickets.length, 4)} open complaints`, tone: "amber" as const },
    { id: "payments", title: "Payment gateway warning", detail: "MTN Mobile Money experiencing delay", tone: "amber" as const },
    { id: "storage", title: "Storage usage", detail: "Database storage at 72%", tone: "blue" as const },
  ];

  return (
    <MockupPage>
      <MockupHeader
        title="System Overview"
        subtitle="Monitor markets, users, payments, and system health."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MockupStatCard title="Total Users" value={Math.max(vendors.length, 1245).toLocaleString()} subtitle="All Roles" tone="blue" />
        <MockupStatCard title="Active Markets" value={Math.max(markets.length, 23)} subtitle="Markets" tone="red" />
        <MockupStatCard title="System Health" value="Good" subtitle="All Systems Operational" tone="green" />
        <MockupStatCard title="Total Revenue" value={formatCurrency(totalRevenue || 120_450_000)} subtitle="This Month" tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <MockupPanel title="Recent Activity" actions={<span className="text-xs font-semibold text-blue-600">View all</span>}>
          <div className="space-y-3">
            {recentActivity.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.id} className="flex items-start gap-3 rounded-md border border-slate-100 bg-white p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <Icon className="h-4 w-4 text-blue-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{item.time}</span>
                </div>
              );
            })}
          </div>
        </MockupPanel>

        <MockupPanel title="System Alerts">
          <div className="space-y-3">
            {alertRows.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-white p-3">
                <div className="flex min-w-0 items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.detail}</p>
                  </div>
                </div>
                <StatusPill tone={item.tone}>Review</StatusPill>
              </div>
            ))}
          </div>
        </MockupPanel>
      </div>
    </MockupPage>
  );
};

export default AdminDashboard;
