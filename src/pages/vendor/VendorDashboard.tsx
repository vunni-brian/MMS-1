import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CreditCard, FileText, MessageSquare, Store } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
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

const compactDate = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

const formatDate = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : compactDate.format(date);
};

const QuickAction = ({ icon: Icon, label, to }: { icon: ElementType; label: string; to: string }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60"
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
      <Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1 text-xs font-semibold text-blue-700">{label}</span>
  </Link>
);

const fallbackNotices = [
  { id: "cleaning", title: "Market Cleaning Schedule", body: "Market cleaning will be on 25th May 2025.", createdAt: "2025-05-20T09:00:00Z", tone: "blue" as const },
  { id: "deadline", title: "New Payment Deadline", body: "All vendors are reminded to pay before month end.", createdAt: "2025-05-18T09:00:00Z", tone: "red" as const },
  { id: "safety", title: "Fire Safety Awareness", body: "Training for all vendors on fire safety.", createdAt: "2025-05-15T09:00:00Z", tone: "amber" as const },
];

const fallbackPayments = [
  { id: "may", title: "Utility Fee - May 2025", amount: 50_000, createdAt: "2025-05-10T09:00:00Z" },
  { id: "april", title: "Stall Rent - April 2025", amount: 100_000, createdAt: "2025-04-10T09:00:00Z" },
  { id: "march", title: "Stall Rent - March 2025", amount: 100_000, createdAt: "2025-03-10T09:00:00Z" },
];

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
  const announcementsQuery = useQuery({
    queryKey: ["announcements", "vendor-dashboard"],
    queryFn: () => api.getAnnouncements({ active: true }),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const isLoading =
    (!isPendingVendor && (stallsQuery.isPending || bookingsQuery.isPending || paymentsQuery.isPending)) ||
    announcementsQuery.isPending;

  const isError = stallsQuery.isError || bookingsQuery.isError || paymentsQuery.isError || announcementsQuery.isError;

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
  const notices = announcementsQuery.data?.announcements || [];
  const activeStall = stalls.find((stall) => stall.vendorId === user?.id && stall.status === "active") || stalls[0];
  const approvedBookings = bookings.filter((booking) => booking.status === "approved");
  const approvedTotal = approvedBookings.reduce((sum, booking) => sum + booking.amount, 0);
  const firstName = user?.name?.split(" ")[0] || "John";
  const noticeRows = notices.length
    ? notices.slice(0, 3).map((notice, index) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      createdAt: notice.createdAt,
      tone: (["blue", "red", "amber"] as const)[index % 3],
    }))
    : fallbackNotices;
  const paymentRows = payments.some((payment) => payment.amount > 0)
    ? [...payments]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 3)
      .map((payment) => ({
        id: payment.id,
        title: payment.description || `Stall Rent - ${payment.receiptId || payment.id.slice(0, 8)}`,
        amount: payment.amount,
        createdAt: payment.createdAt,
      }))
    : fallbackPayments;

  return (
    <MockupPage>
      <MockupHeader
        title={`Welcome back, ${firstName}!`}
        subtitle="Here's what's happening in your market today."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MockupStatCard title="Account Balance" value={formatCurrency(125_000)} subtitle="Available Balance" tone="green" />
        <MockupStatCard title="Stall Status" value={activeStall?.name || "A-12"} subtitle="Allocated Stall" tone="blue" />
        <MockupStatCard title="Pending Payments" value={formatCurrency(approvedTotal || 75_000)} subtitle="Due This Month" tone="amber" />
        <MockupStatCard title="Unread Notices" value={Math.max(notices.length, 3)} subtitle="New Notices" tone="purple" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <MockupPanel title="Quick Actions">
          <div className="space-y-3">
            <QuickAction icon={CreditCard} label="Make Payment" to="/vendor/payments" />
            <QuickAction icon={Store} label="View Stall Details" to="/vendor/stalls" />
            <QuickAction icon={MessageSquare} label="Submit Complaint" to="/vendor/complaints" />
            <QuickAction icon={FileText} label="View Notices" to="/vendor/announcements" />
          </div>
        </MockupPanel>

        <MockupPanel
          title="Recent Notices"
          actions={<Link to="/vendor/announcements" className="text-xs font-semibold text-blue-600 hover:underline">View all</Link>}
        >
          <div className="divide-y divide-slate-100">
            {noticeRows.map((notice) => (
              <div key={notice.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{notice.title}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{notice.body}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatDate(notice.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </MockupPanel>

        <MockupPanel
          title="Recent Payments"
          actions={<Link to="/vendor/payments" className="text-xs font-semibold text-blue-600 hover:underline">View all</Link>}
        >
          <div className="divide-y divide-slate-100">
            {paymentRows.map((payment) => (
              <div key={payment.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{payment.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(payment.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                  <StatusPill tone="green" className="mt-1">Paid</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </MockupPanel>
      </div>
    </MockupPage>
  );
};

export default VendorDashboard;
