import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  MessageSquare,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatHumanDate, getTimeAwareGreeting } from "@/lib/utils";
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

const fallbackNotices = [
  { id: "cleaning", title: "Market cleaning schedule", body: "Cleaning starts at 7:00 AM on Saturday.", createdAt: "2026-05-20T09:00:00Z" },
  { id: "deadline", title: "Payment reminder", body: "Monthly dues should be cleared before month end.", createdAt: "2026-05-18T09:00:00Z" },
  { id: "safety", title: "Fire safety briefing", body: "A short safety briefing is scheduled for all food vendors.", createdAt: "2026-05-15T09:00:00Z" },
];

const fallbackPayments = [
  { id: "may", title: "Utility fee", amount: 50_000, createdAt: "2026-05-10T09:00:00Z" },
  { id: "april", title: "Stall rent", amount: 100_000, createdAt: "2026-04-10T09:00:00Z" },
  { id: "march", title: "Stall rent", amount: 100_000, createdAt: "2026-03-10T09:00:00Z" },
];

const QuickAction = ({ icon: Icon, label, to }: { icon: ElementType; label: string; to: string }) => (
  <Link
    to={to}
    className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
      <Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{label}</span>
  </Link>
);

const VendorDashboard = () => {
  const { user } = useAuth();
  const isPendingVendor = user?.vendorStatus !== "approved";

  const stallsQuery = useQuery({
    queryKey: ["stalls", "mine"],
    queryFn: () => api.getStalls({ scope: "mine" }),
    enabled: !isPendingVendor,
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
    enabled: !isPendingVendor,
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
    enabled: !isPendingVendor,
    refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });
  const ticketsQuery = useQuery({
    queryKey: ["tickets", "vendor-dashboard"],
    queryFn: () => api.getTickets(),
    enabled: !isPendingVendor,
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });
  const announcementsQuery = useQuery({
    queryKey: ["announcements", "vendor-dashboard"],
    queryFn: () => api.getAnnouncements({ active: true }),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const isLoading =
    (!isPendingVendor && (stallsQuery.isPending || bookingsQuery.isPending || paymentsQuery.isPending || ticketsQuery.isPending)) ||
    announcementsQuery.isPending;

  const isError =
    stallsQuery.isError ||
    bookingsQuery.isError ||
    paymentsQuery.isError ||
    ticketsQuery.isError ||
    announcementsQuery.isError;

  if (isError) {
    return (
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>There was a problem fetching your market data. Please refresh the page.</AlertDescription>
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

  const stalls = stallsQuery.data?.stalls || [];
  const bookings = bookingsQuery.data?.bookings || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const notices = announcementsQuery.data?.announcements || [];
  const activeStall = stalls.find((stall) => stall.vendorId === user?.id && stall.status === "active") || stalls[0];
  const approvedBookings = bookings.filter((booking) => booking.status === "approved");
  const outstandingBalance = approvedBookings.reduce((sum, booking) => sum + booking.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const noticeRows = notices.length ? notices.slice(0, 3) : fallbackNotices;
  const paymentRows = payments.some((payment) => payment.amount > 0)
    ? [...payments]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 4)
      .map((payment) => ({
        id: payment.id,
        title: payment.description || payment.chargeType.replace(/_/g, " "),
        amount: payment.amount,
        createdAt: payment.createdAt,
      }))
    : fallbackPayments;
  const activityRows = [
    ...paymentRows.slice(0, 2).map((payment) => ({
      id: `payment-${payment.id}`,
      title: payment.title,
      detail: `${formatCurrency(payment.amount)} recorded`,
      icon: CreditCard,
    })),
    ...noticeRows.slice(0, 2).map((notice) => ({
      id: `notice-${notice.id}`,
      title: notice.title,
      detail: "Notice published",
      icon: FileText,
    })),
  ].slice(0, 4);

  const greeting = getTimeAwareGreeting(user?.name?.split(" ")[0] || "there");

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Vendor workspace"
        title={greeting}
        subtitle={`A simple view of your stall, dues, notices, and support requests at ${user?.marketName || "your market"}.`}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <MockupStatCard
          title="My Stall"
          value={activeStall?.name || "Not assigned"}
          subtitle={activeStall ? `${activeStall.zone} - ${activeStall.size}` : "Reserve a stall when one becomes available"}
          tone="green"
          icon={Store}
        />
        <MockupStatCard
          title="Outstanding Balance"
          value={formatCurrency(outstandingBalance || 75_000)}
          subtitle="Current approved dues"
          tone={outstandingBalance > 0 ? "amber" : "green"}
          icon={WalletCards}
        />
        <MockupStatCard
          title="Complaint Status"
          value={openComplaints.length ? `${openComplaints.length} open` : "Clear"}
          subtitle={openComplaints.length ? "Support team is reviewing" : "No unresolved complaints"}
          tone={openComplaints.length ? "amber" : "green"}
          icon={MessageSquare}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <MockupPanel title="Current Stall">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950 font-heading">{activeStall?.name || "No active stall"}</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {activeStall
                    ? `${activeStall.zone} zone, ${activeStall.size}. Monthly dues are ${formatCurrency(activeStall.pricePerMonth)}.`
                    : "Your dashboard will show stall details after a stall has been assigned."}
                </p>
              </div>
              <StatusPill tone={activeStall ? "green" : "amber"}>{activeStall ? "Active" : "Pending"}</StatusPill>
            </div>
          </MockupPanel>

          <MockupPanel title="Payment History" actions={<Link to="/vendor/payments" className="text-xs font-semibold text-emerald-700 hover:underline">View all</Link>}>
            <div className="space-y-1">
              {paymentRows.map((payment, index) => (
                <div key={payment.id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl px-2 py-3 hover:bg-slate-50">
                  <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    {index === 0 ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{payment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatHumanDate(payment.createdAt)}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-slate-950">{formatCurrency(payment.amount)}</p>
                </div>
              ))}
            </div>
          </MockupPanel>

          <MockupPanel title="Recent Activity">
            <div className="grid gap-2">
              {activityRows.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </MockupPanel>
        </div>

        <div className="grid content-start gap-6">
          <MockupPanel title="Notifications" actions={<Link to="/vendor/announcements" className="text-xs font-semibold text-emerald-700 hover:underline">View all</Link>}>
            <div className="space-y-4">
              {noticeRows.map((notice) => (
                <div key={notice.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-slate-950">{notice.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{notice.body}</p>
                </div>
              ))}
            </div>
          </MockupPanel>

          <MockupPanel title="Quick Actions">
            <div className="grid gap-3">
              <QuickAction icon={CreditCard} label="Pay dues" to="/vendor/payments" />
              <QuickAction icon={MessageSquare} label="Report issue" to="/vendor/complaints" />
              <QuickAction icon={Store} label="Reserve stall" to="/vendor/stalls" />
              <QuickAction icon={UserRound} label="Update profile" to="/vendor/profile" />
            </div>
          </MockupPanel>

          <MockupPanel title="Upcoming Dues">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-amber-700" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">Month-end collection</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Clear pending dues before the last working day.</p>
                </div>
              </div>
            </div>
          </MockupPanel>
        </div>
      </div>
    </MockupPage>
  );
};

export default VendorDashboard;
