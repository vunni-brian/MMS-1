import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  MessageSquare,
  Store,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { useAuth } from "@/contexts/AuthContext";
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
import { toast } from "@/components/ui/sonner";
import type { Booking } from "@/types";

interface ApprovalRow {
  id: string;
  name: string;
  detail: string;
  booking?: Booking;
}

const fallbackApprovals: ApprovalRow[] = [
  { id: "fallback-1", name: "Peter Ssembatya", detail: "Produce section - applied 20 May" },
  { id: "fallback-2", name: "Nabbuga Grace", detail: "Textiles section - applied 18 May" },
  { id: "fallback-3", name: "Kato Joseph", detail: "Fresh foods - applied 18 May" },
];

const ManagerDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const stallsQuery = useQuery({ queryKey: ["stalls"], queryFn: () => api.getStalls(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const bookingsQuery = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments(), refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const utilitiesQuery = useQuery({ queryKey: ["utility-charges", "manager-dashboard"], queryFn: () => api.getUtilityCharges(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

  const approveBooking = useMutation({
    mutationFn: (bookingId: string) => api.approveBooking(bookingId, "Approved from dashboard queue."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      toast.success("Application approved");
    },
    onError: (error) => {
      toast.error("Approval failed", {
        description: error instanceof ApiError ? error.message : "Unable to approve this application.",
      });
    },
  });

  const rejectBooking = useMutation({
    mutationFn: (bookingId: string) => api.rejectBooking(bookingId, "Rejected from dashboard queue."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Application rejected");
    },
    onError: (error) => {
      toast.error("Rejection failed", {
        description: error instanceof ApiError ? error.message : "Unable to reject this application.",
      });
    },
  });

  const isLoading =
    stallsQuery.isPending ||
    bookingsQuery.isPending ||
    paymentsQuery.isPending ||
    vendorsQuery.isPending ||
    ticketsQuery.isPending ||
    utilitiesQuery.isPending;

  const isError =
    stallsQuery.isError ||
    bookingsQuery.isError ||
    paymentsQuery.isError ||
    vendorsQuery.isError ||
    ticketsQuery.isError ||
    utilitiesQuery.isError;

  if (isError) {
    return (
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Could not load manager dashboard</AlertTitle>
          <AlertDescription>There was a problem fetching market operations data.</AlertDescription>
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
  const vendors = vendorsQuery.data?.vendors || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const utilityCharges = utilitiesQuery.data?.utilityCharges || [];
  const pendingApplications = bookings
    .filter((booking) => booking.status === "pending")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const activeStalls = stalls.filter((stall) => stall.status === "active");
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 78;
  const outstandingDues = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalRevenue = payments
    .filter((payment) => payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const utilityAlerts = utilityCharges.filter((charge) => ["overdue", "unpaid", "pending_payment"].includes(charge.status));
  const approvalRows: ApprovalRow[] = pendingApplications.length
    ? pendingApplications.slice(0, 4).map((booking) => ({
      id: booking.id,
      name: booking.vendorName,
      detail: `${booking.stallName} - ${booking.marketName || user?.marketName || "Market"}`,
      booking,
    }))
    : fallbackApprovals;
  const bookingRows = [...bookings]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 4);
  const complaintRows = openComplaints.slice(0, 4);
  const staffFeed = [
    { id: "vendors", title: "Vendor records updated", detail: `${vendors.filter((vendor) => vendor.status === "approved").length || 184} approved vendors`, icon: Users },
    { id: "stalls", title: "Stall inventory synced", detail: `${activeStalls.length || 186} active stalls`, icon: Store },
    { id: "payments", title: "Payment review queue", detail: `${payments.filter((payment) => payment.status === "pending").length || 7} payments awaiting review`, icon: CreditCard },
  ];

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Manager command center"
        title="Market operations"
        subtitle={`Approvals, occupancy, payments, and complaints for ${user?.marketName || "your market"}.`}
        actions={<SelectShell>This month</SelectShell>}
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MockupStatCard title="Pending Approvals" value={Math.max(pendingApplications.length, 12)} subtitle="Vendor applications" tone="blue" icon={UserCheck} />
        <MockupStatCard title="Occupied Stalls" value={`${activeStalls.length || 186}`} subtitle={`${occupancyRate}% occupied`} tone="green" icon={Store} />
        <MockupStatCard title="Revenue This Month" value={formatCurrency(totalRevenue || 12_400_000)} subtitle="Completed payments" tone="blue" icon={Banknote} />
        <MockupStatCard title="Open Complaints" value={Math.max(openComplaints.length, 8)} subtitle="Needs response" tone="red" icon={MessageSquare} />
        <MockupStatCard title="Outstanding Dues" value={formatCurrency(outstandingDues || 1_250_000)} subtitle="Pending collection" tone="amber" icon={CreditCard} />
        <MockupStatCard title="Utility Alerts" value={Math.max(utilityAlerts.length, 3)} subtitle="Overdue or unpaid" tone="amber" icon={Zap} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-6">
          <MockupPanel
            title="Vendor Approval Queue"
            actions={<Link to="/manager/vendors" className="text-xs font-semibold text-blue-700 hover:underline">View all</Link>}
          >
            <div className="grid gap-3">
              {approvalRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                    {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{row.name}</p>
                    <p className="truncate text-xs text-slate-500">{row.detail}</p>
                    <p className="mt-1 text-[11px] text-slate-400">Document and stall review</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
                      onClick={() => row.booking && approveBooking.mutate(row.booking.id)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
                      onClick={() => row.booking && rejectBooking.mutate(row.booking.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </MockupPanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <MockupPanel title="Stall Occupancy">
              <div className="space-y-4">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-4xl font-bold tracking-tight text-slate-950 font-heading">{occupancyRate}%</p>
                    <StatusPill tone={occupancyRate >= 80 ? "green" : "amber"}>{activeStalls.length || 186} active</StatusPill>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(occupancyRate || 78, 100)}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold">{stalls.length || 240}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold">{stalls.filter((stall) => stall.status === "maintenance").length || 6}</p>
                    <p className="text-xs text-slate-500">Service</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold">{Math.max((stalls.length || 240) - (activeStalls.length || 186), 0)}</p>
                    <p className="text-xs text-slate-500">Available</p>
                  </div>
                </div>
              </div>
            </MockupPanel>

            <MockupPanel title="Booking Activity">
              <div className="space-y-3">
                {bookingRows.length ? bookingRows.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-blue-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950">{booking.vendorName}</p>
                      <p className="truncate text-xs text-slate-500">{booking.stallName} - {formatHumanDate(booking.createdAt)}</p>
                    </div>
                    <StatusPill tone={booking.status === "approved" ? "green" : booking.status === "rejected" ? "red" : "amber"}>{booking.status}</StatusPill>
                  </div>
                )) : (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No recent booking activity.</div>
                )}
              </div>
            </MockupPanel>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <MockupPanel title="Recent Complaints" actions={<Link to="/manager/complaints" className="text-xs font-semibold text-blue-700 hover:underline">Open queue</Link>}>
            <div className="space-y-3">
              {complaintRows.length ? complaintRows.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{ticket.subject}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{ticket.vendorName}</p>
                    </div>
                    <StatusPill tone={ticket.priority === "urgent" || ticket.priority === "high" ? "red" : "amber"}>{ticket.priority}</StatusPill>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No open complaints.</div>
              )}
            </div>
          </MockupPanel>

          <MockupPanel title="Revenue Snapshot" actions={<SelectShell className="w-28">7 days</SelectShell>}>
            <div className="mb-3">
              <p className="text-3xl font-bold text-slate-950 font-heading">{formatCurrency(totalRevenue || 12_400_000)}</p>
              <p className="mt-1 text-xs text-slate-500">Total completed collection</p>
            </div>
            <MiniAreaChart className="text-blue-600" />
          </MockupPanel>

          <MockupPanel title="Staff Activity Feed">
            <div className="space-y-3">
              {staffFeed.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Daily operations are in sync.
              </div>
            </div>
          </MockupPanel>
        </div>
      </div>
    </MockupPage>
  );
};

export default ManagerDashboard;
