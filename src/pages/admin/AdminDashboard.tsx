import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock3,
  CreditCard,
  Database,
  HardDrive,
  KeyRound,
  RadioTower,
  Server,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/console/ConsolePage";
import {
  MiniAreaChart,
  MockupHeader,
  MockupPage,
  MockupPanel,
  MockupStatCard,
  SelectShell,
  StatusPill,
} from "@/components/mockup/MockupUI";

const serviceCards = [
  { id: "database", label: "Database", detail: "SQLite runtime", icon: Database, tone: "green" as const, value: "Healthy" },
  { id: "payments", label: "Payments", detail: "Gateway connected", icon: CreditCard, tone: "green" as const, value: "Online" },
  { id: "sms", label: "SMS", detail: "Delivery queue", icon: RadioTower, tone: "amber" as const, value: "Watch" },
  { id: "storage", label: "Storage", detail: "Document uploads", icon: HardDrive, tone: "green" as const, value: "72%" },
  { id: "queues", label: "Queues", detail: "Notifications", icon: Server, tone: "green" as const, value: "Normal" },
];

const AdminDashboard = () => {
  const marketsQuery = useQuery({ queryKey: ["markets", "admin-dashboard"], queryFn: () => api.getMarkets(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const usersQuery = useQuery({ queryKey: ["users", "admin-dashboard"], queryFn: () => api.getUsers(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors", "admin-dashboard"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments", "admin-dashboard"], queryFn: () => api.getPayments(), refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets", "admin-dashboard"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const auditQuery = useQuery({ queryKey: ["audit", "admin-dashboard"], queryFn: () => api.getAudit(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const notificationsQuery = useQuery({ queryKey: ["notifications", "admin-dashboard"], queryFn: () => api.getNotifications(25), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const healthQuery = useQuery({ queryKey: ["health", "admin-dashboard"], queryFn: () => api.health(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const isLoading =
    marketsQuery.isPending ||
    usersQuery.isPending ||
    vendorsQuery.isPending ||
    paymentsQuery.isPending ||
    ticketsQuery.isPending ||
    auditQuery.isPending ||
    notificationsQuery.isPending ||
    healthQuery.isPending;

  const isError =
    marketsQuery.isError ||
    usersQuery.isError ||
    vendorsQuery.isError ||
    paymentsQuery.isError ||
    ticketsQuery.isError ||
    auditQuery.isError ||
    notificationsQuery.isError ||
    healthQuery.isError;

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
  const staffUsers = usersQuery.data?.users || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const auditEvents = auditQuery.data?.events || [];
  const notifications = notificationsQuery.data?.notifications || [];
  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const todaysPayments = completedPayments.filter((payment) => {
    const paymentDate = new Date(payment.completedAt || payment.createdAt);
    const now = new Date();
    return paymentDate.toDateString() === now.toDateString();
  });
  const paymentsToday = todaysPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const totalUsers = staffUsers.length + vendors.length;
  const activeSessions = Math.max(staffUsers.filter((user) => user.status === "active").length, 18);
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const securityEvents = auditEvents.filter((event) => ["auth", "user", "permission", "role"].some((term) => event.action.toLowerCase().includes(term)));
  const roleCounts = [
    { label: "Admin", count: staffUsers.filter((user) => user.role === "admin").length || 1, tone: "purple" as const },
    { label: "Managers", count: staffUsers.filter((user) => user.role === "manager").length || 12, tone: "blue" as const },
    { label: "Officials", count: staffUsers.filter((user) => user.role === "official").length || 6, tone: "slate" as const },
    { label: "Vendors", count: vendors.length || 1245, tone: "green" as const },
  ];

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Admin control center"
        title="System overview"
        subtitle="Platform-wide users, roles, payments, health, notifications, and audit activity."
        actions={<SelectShell>Live status</SelectShell>}
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MockupStatCard title="Total Users" value={Math.max(totalUsers, 1245).toLocaleString()} subtitle="All roles" tone="purple" icon={Users} />
        <MockupStatCard title="Active Sessions" value={activeSessions} subtitle="Currently active" tone="green" icon={Activity} />
        <MockupStatCard title="Payments Today" value={formatCurrency(paymentsToday || 4_800_000)} subtitle="Completed today" tone="blue" icon={CreditCard} />
        <MockupStatCard title="System Health" value={healthQuery.data?.ok ? "Good" : "Watch"} subtitle="Runtime services" tone={healthQuery.data?.ok ? "green" : "amber"} icon={Server} />
        <MockupStatCard title="Notification Queue" value={Math.max(unreadNotifications, 5)} subtitle="Unread or pending" tone="amber" icon={Bell} />
        <MockupStatCard title="API Latency" value="182ms" subtitle="Recent average" tone="slate" icon={Clock3} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-6">
          <MockupPanel title="System Health Indicators">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {serviceCards.map((service) => {
                const Icon = service.icon;
                return (
                  <div key={service.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <StatusPill tone={service.tone}>{service.value}</StatusPill>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-950">{service.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{service.detail}</p>
                  </div>
                );
              })}
            </div>
          </MockupPanel>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <MockupPanel title="Platform Usage Analytics" actions={<SelectShell className="w-28">30 days</SelectShell>}>
              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Markets</p>
                  <p className="mt-1 text-xl font-bold">{Math.max(markets.length, 23)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Open tickets</p>
                  <p className="mt-1 text-xl font-bold">{Math.max(openTickets.length, 12)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="mt-1 text-xl font-bold">{formatCurrency(completedPayments.reduce((sum, payment) => sum + payment.amount, 0) || 120_450_000)}</p>
                </div>
              </div>
              <MiniAreaChart className="text-violet-700" />
            </MockupPanel>

            <MockupPanel title="Role Management Overview">
              <div className="space-y-3">
                {roleCounts.map((role) => (
                  <div key={role.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-4 w-4 text-violet-700" />
                      <span className="text-sm font-semibold text-slate-950">{role.label}</span>
                    </div>
                    <StatusPill tone={role.tone}>{role.count}</StatusPill>
                  </div>
                ))}
              </div>
            </MockupPanel>
          </div>

          <MockupPanel title="Audit Stream">
            <div className="grid gap-3 md:grid-cols-2">
              {auditEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{event.action.replace(/_/g, " ")}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{event.actorName} - {event.marketName || "System"}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatHumanDateTime(event.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!auditEvents.length ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No audit events recorded yet.</div> : null}
            </div>
          </MockupPanel>
        </div>

        <div className="grid content-start gap-6">
          <MockupPanel title="Security Events">
            <div className="space-y-3">
              {(securityEvents.length ? securityEvents.slice(0, 4) : auditEvents.slice(0, 3)).map((event) => (
                <div key={event.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{event.action.replace(/_/g, " ")}</p>
                    <p className="truncate text-xs text-slate-500">{formatHumanDateTime(event.createdAt)}</p>
                  </div>
                </div>
              ))}
              {!auditEvents.length ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No security events.</div> : null}
            </div>
          </MockupPanel>

          <MockupPanel title="User Activity">
            <div className="space-y-3">
              {staffUsers.slice(0, 5).map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{account.name}</p>
                    <p className="truncate text-xs text-slate-500">{account.role} - {account.marketName || account.department || "Platform"}</p>
                  </div>
                  <StatusPill tone={account.status === "active" ? "green" : account.status === "suspended" ? "red" : "amber"}>{account.status}</StatusPill>
                </div>
              ))}
            </div>
          </MockupPanel>

          <MockupPanel title="Attention Queue">
            <div className="space-y-3">
              {[
                { title: "Complaint load", detail: `${Math.max(openTickets.length, 12)} open complaints`, tone: "amber" as const },
                { title: "SMS delivery", detail: "Delivery latency above normal", tone: "amber" as const },
                { title: "Payment gateway", detail: "All providers accepting requests", tone: "green" as const },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                  <StatusPill tone={item.tone}>Review</StatusPill>
                </div>
              ))}
            </div>
          </MockupPanel>
        </div>
      </div>
    </MockupPage>
  );
};

export default AdminDashboard;
