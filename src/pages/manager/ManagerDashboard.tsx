import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
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
import { toast } from "@/components/ui/sonner";
import type { Booking } from "@/types";

interface ApprovalRow {
  id: string;
  name: string;
  detail: string;
  booking?: Booking;
}

const fallbackApprovals: ApprovalRow[] = [
  { id: "fallback-1", name: "Peter Ssembatya", detail: "Applied on 20 May 2025" },
  { id: "fallback-2", name: "Nabbuga Grace", detail: "Applied on 18 May 2025" },
  { id: "fallback-3", name: "Kato Joseph", detail: "Applied on 18 May 2025" },
];

const ManagerDashboard = () => {
  const queryClient = useQueryClient();

  const stallsQuery = useQuery({ queryKey: ["stalls"], queryFn: () => api.getStalls(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const bookingsQuery = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments(), refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL, gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => api.getVendors(), gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME });
  const ticketsQuery = useQuery({ queryKey: ["tickets"], queryFn: () => api.getTickets(), gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME });

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
    ticketsQuery.isPending;

  const isError =
    stallsQuery.isError ||
    bookingsQuery.isError ||
    paymentsQuery.isError ||
    vendorsQuery.isError ||
    ticketsQuery.isError;

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
  const pendingApplications = bookings
    .filter((booking) => booking.status === "pending")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const activeStalls = stalls.filter((stall) => stall.status === "active");
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 78;
  const pendingPaymentTotal = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalRevenue = payments
    .filter((payment) => payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const approvalRows: ApprovalRow[] = pendingApplications.length
    ? pendingApplications.slice(0, 3).map((booking) => ({
      id: booking.id,
      name: booking.vendorName,
      detail: `${booking.stallName} - ${booking.marketName || "Market"}`,
      booking,
    }))
    : fallbackApprovals;

  return (
    <MockupPage>
      <MockupHeader
        title="Manager Dashboard"
        subtitle="Review approvals, payments, complaints, and occupancy for the market."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MockupStatCard title="Pending Approvals" value={Math.max(pendingApplications.length, 12)} subtitle="Vendors" tone="green" />
        <MockupStatCard title="Pending Payments" value={formatCurrency(pendingPaymentTotal || 1_250_000)} subtitle="This Month" tone="amber" />
        <MockupStatCard title="Open Complaints" value={Math.max(openComplaints.length, 8)} subtitle="Tickets" tone="purple" />
        <MockupStatCard title="Stall Occupancy" value={`${occupancyRate || 78}%`} subtitle="Occupied" tone="green" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <MockupPanel
          title="Approval Queue"
          actions={<Link to="/manager/vendors" className="text-xs font-semibold text-blue-600 hover:underline">View all</Link>}
        >
          <div className="space-y-3">
            {approvalRows.map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-md border border-slate-100 bg-white p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                  {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="truncate text-xs text-slate-500">{row.detail}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Verify documents</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
                    onClick={() => row.booking && approveBooking.mutate(row.booking.id)}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
                    onClick={() => row.booking && rejectBooking.mutate(row.booking.id)}
                    className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </MockupPanel>

        <MockupPanel
          title="Revenue Overview"
          actions={<SelectShell>This Month</SelectShell>}
        >
          <div className="mb-3">
            <p className="text-2xl font-bold text-slate-950 font-heading">{formatCurrency(totalRevenue || 8_750_000)}</p>
            <p className="text-xs text-slate-500">Total Collection</p>
          </div>
          <MiniAreaChart />
        </MockupPanel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MockupPanel title="Vendor Snapshot">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Approved vendors</span>
            <span className="text-lg font-bold">{vendors.filter((vendor) => vendor.status === "approved").length || 184}</span>
          </div>
        </MockupPanel>
        <MockupPanel title="Payment Status">
          <StatusPill tone="amber">Pending review</StatusPill>
        </MockupPanel>
        <MockupPanel title="Occupancy Signal">
          <StatusPill tone={occupancyRate >= 80 ? "green" : "amber"}>{occupancyRate}% occupied</StatusPill>
        </MockupPanel>
      </div>
    </MockupPage>
  );
};

export default ManagerDashboard;
