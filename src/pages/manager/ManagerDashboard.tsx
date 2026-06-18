import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  MessageSquare,
  Store,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCenter } from "@/components/ui/ActionCenter";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { InsightCard } from "@/components/ui/InsightCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Booking } from "@/types";

interface ApprovalRow {
  id: string;
  name: string;
  detail: string;
  booking?: Booking;
}

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-[250px]" />
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-[100px] rounded-xl" />)}
    </div>
    <Skeleton className="h-[200px] rounded-xl" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Skeleton className="h-[300px] rounded-xl" />
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  </div>
);

const ManagerDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "reject"; booking: Booking } | null>(null);

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
      toast.success(t("manager:dashboard.approveToast"));
    },
    onError: (error) => {
      toast.error(t("manager:dashboard.approveError"), {
        description: error instanceof ApiError ? error.message : t("manager:dashboard.approveErrorDesc"),
      });
    },
  });

  const rejectBooking = useMutation({
    mutationFn: (bookingId: string) => api.rejectBooking(bookingId, "Rejected from dashboard queue."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success(t("manager:dashboard.rejectToast"));
    },
    onError: (error) => {
      toast.error(t("manager:dashboard.rejectError"), {
        description: error instanceof ApiError ? error.message : t("manager:dashboard.rejectErrorDesc"),
      });
    },
  });

  const isLoading = stallsQuery.isPending || bookingsQuery.isPending || paymentsQuery.isPending ||
    vendorsQuery.isPending || ticketsQuery.isPending || utilitiesQuery.isPending;

  const isError = stallsQuery.isError || bookingsQuery.isError || paymentsQuery.isError ||
    vendorsQuery.isError || ticketsQuery.isError || utilitiesQuery.isError;

  if (isError) {
    return (
      <div className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] p-5 text-sm text-[#991B1B]">
        {t("manager:dashboard.errorTitle")}: {t("manager:dashboard.errorDesc")}
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

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
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 0;
  const outstandingDues = payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  const totalRevenue = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const utilityAlerts = utilityCharges.filter((charge) => ["overdue", "unpaid", "pending_payment"].includes(charge.status));

  const approvalRows: ApprovalRow[] = pendingApplications.slice(0, 4).map((booking) => ({
    id: booking.id,
    name: booking.vendorName,
    detail: `${booking.stallName} — ${booking.marketName || user?.marketName || t("common:market")}`,
    booking,
  }));

  const actionItems = [
    ...(pendingApplications.length > 0 ? [{
      id: "pending-approvals",
      icon: UserCheck,
      title: `${pendingApplications.length} vendor application${pendingApplications.length > 1 ? "s" : ""} awaiting review`,
      detail: "Review documents and stall allocation requests",
      tone: "warning" as const,
      action: <Link to="/manager/vendors"><Button size="sm" variant="outline" className="text-xs">Review queue</Button></Link>,
    }] : []),
    ...openComplaints.slice(0, 2).map((ticket) => ({
      id: `complaint-${ticket.id}`,
      icon: MessageSquare,
      title: ticket.subject,
      detail: `${ticket.vendorName} — ${ticket.priority} priority`,
      tone: (ticket.priority === "urgent" || ticket.priority === "high" ? "urgent" : "info") as const,
    })),
    ...utilityAlerts.slice(0, 2).map((charge) => ({
      id: `utility-${charge.id}`,
      icon: Zap,
      title: `${charge.utilityType} — ${charge.vendorName}`,
      detail: `${formatCurrency(charge.amount)} — ${charge.status.replace(/_/g, " ")}`,
      tone: charge.status === "overdue" ? "urgent" as const : "warning" as const,
    })),
  ];

  const activityItems = [
    ...bookings.slice(0, 3).map((booking) => ({
      id: `booking-${booking.id}`,
      icon: ClipboardCheck,
      title: booking.vendorName,
      detail: `${booking.stallName} — ${booking.status}`,
      time: formatHumanDate(booking.createdAt),
      tone: booking.status === "approved" ? "success" as const : booking.status === "pending" ? "warning" as const : "default" as const,
    })),
    ...payments.filter((p) => p.status === "completed").slice(0, 2).map((payment) => ({
      id: `payment-${payment.id}`,
      icon: CreditCard,
      title: `${payment.vendorName} — ${formatCurrency(payment.amount)}`,
      detail: payment.description || payment.chargeType.replace(/_/g, " "),
      time: formatHumanDate(payment.createdAt),
      tone: "success" as const,
    })),
  ];

  return (
    <>
    <WorkspaceLayout
      variant="with-right-panel"
      left={
        <>
          <PageHeader
            eyebrow={t("manager:dashboard.eyebrow")}
            title={t("manager:dashboard.title")}
            description={t("manager:dashboard.subtitle", { market: user?.marketName || "your market" })}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <InsightCard
              label={t("manager:dashboard.kpiPendingApprovals")}
              value={pendingApplications.length}
              detail={t("manager:dashboard.kpiVendorApps")}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <InsightCard
              label={t("manager:dashboard.kpiOccupiedStalls")}
              value={`${occupancyRate}%`}
              detail={`${activeStalls.length} of ${stalls.length} stalls`}
              icon={<Store className="h-5 w-5" />}
            />
            <InsightCard
              label={t("manager:dashboard.kpiRevenueMonth")}
              value={formatCurrency(totalRevenue)}
              detail={t("manager:dashboard.kpiCompletedPayments")}
              icon={<Banknote className="h-5 w-5" />}
            />
          </div>

          <ActionCenter
            title="Today's Tasks"
            items={actionItems}
            emptyMessage="No tasks requiring attention"
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">{t("manager:dashboard.vendorApprovalQueue")}</CardTitle>
              <Link to="/manager/vendors" className="text-xs font-medium text-[#0F5E3F] hover:underline">
                {t("common:viewAll")}
              </Link>
            </CardHeader>
            <CardContent>
              {approvalRows.length === 0 ? (
                <EmptyState variant="success" title="No pending approvals" description="All vendor applications have been processed" />
              ) : (
                <div className="space-y-3">
                  {approvalRows.map((row) => (
                    <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-[#F1F3F5] bg-white p-4 sm:flex-row sm:items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-sm font-bold text-[#0F5E3F]">
                        {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#111827]">{row.name}</p>
                        <p className="truncate text-xs text-[#6B7280]">{row.detail}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white text-xs"
                          disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
                          onClick={() => row.booking && setConfirmAction({ type: "approve", booking: row.booking })}
                        >
                          {t("common:approve")}
                        </Button>
                        <Button size="sm" variant="outline" className="border-[#FCA5A5] text-[#EF476F] hover:bg-[#FEE2E2] text-xs"
                          disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
                          onClick={() => row.booking && setConfirmAction({ type: "reject", booking: row.booking })}
                        >
                          {t("common:reject")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t("manager:dashboard.stallOccupancy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-3xl font-bold tracking-tight text-[#111827]">{occupancyRate}%</p>
                    <Badge variant={occupancyRate >= 80 ? "default" : "secondary"} className="text-[10px]">
                      {activeStalls.length} active
                    </Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#F1F3F5]">
                    <div className="h-2 rounded-full bg-[#0F5E3F]" style={{ width: `${Math.min(occupancyRate, 100)}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-[#F8F9FA] p-3">
                    <p className="text-lg font-bold text-[#111827]">{stalls.length}</p>
                    <p className="text-[11px] text-[#6B7280]">{t("manager:dashboard.total")}</p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-3">
                    <p className="text-lg font-bold text-[#111827]">{stalls.filter((s) => s.status === "maintenance").length}</p>
                    <p className="text-[11px] text-[#6B7280]">{t("manager:dashboard.service")}</p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-3">
                    <p className="text-lg font-bold text-[#111827]">{Math.max(stalls.length - activeStalls.length, 0)}</p>
                    <p className="text-[11px] text-[#6B7280]">{t("manager:dashboard.available")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      }
      right={
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">{t("manager:dashboard.recentComplaints")}</CardTitle>
              <Link to="/manager/complaints" className="text-xs font-medium text-[#0F5E3F] hover:underline">
                {t("common:viewAll")}
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openComplaints.slice(0, 4).length ? openComplaints.slice(0, 4).map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3 rounded-lg border border-[#F1F3F5] bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111827]">{ticket.subject}</p>
                      <p className="truncate text-[11px] text-[#6B7280]">{ticket.vendorName}</p>
                    </div>
                    <Badge variant={ticket.priority === "urgent" || ticket.priority === "high" ? "destructive" : "secondary"} className="text-[10px] capitalize shrink-0">
                      {ticket.priority}
                    </Badge>
                  </div>
                )) : (
                  <EmptyState variant="success" title="No open complaints" description="All issues have been resolved" />
                )}
              </div>
            </CardContent>
          </Card>

          <ActivityTimeline
            title="Activity Feed"
            items={activityItems}
            viewAllLink="/manager/audit"
            viewAllLabel={t("common:viewAll")}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t("manager:dashboard.staffActivityFeed")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { id: "vendors", title: "Vendor records", detail: `${vendors.filter((v) => v.status === "approved").length} approved`, icon: Users },
                  { id: "stalls", title: "Stall inventory", detail: `${activeStalls.length} active`, icon: Store },
                  { id: "payments", title: "Payment queue", detail: `${payments.filter((p) => p.status === "pending").length} pending`, icon: CreditCard },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg bg-[#F8F9FA] p-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F5EE] text-[#0F5E3F]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#111827]">{item.title}</p>
                        <p className="truncate text-[11px] text-[#6B7280]">{item.detail}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 rounded-lg border border-[#10B981]/20 bg-[#D1FAE5]/30 p-3 text-xs font-medium text-[#10B981]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("manager:dashboard.dailyOpsInSync")}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      }
    />

    <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmAction?.type === "approve" ? "Approve Vendor Application?" : "Reject Vendor Application?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmAction?.type === "approve"
              ? `This will approve ${confirmAction?.booking?.vendorName}'s application for ${confirmAction?.booking?.stallName}. The vendor will be notified and their stall access will be activated.`
              : `This will reject ${confirmAction?.booking?.vendorName}'s application for ${confirmAction?.booking?.stallName}. The vendor will be notified of the rejection.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={confirmAction?.type === "approve" ? "bg-[#10B981] hover:bg-[#059669] text-white" : "bg-[#EF476F] hover:bg-[#DC2626] text-white"}
            onClick={() => {
              if (!confirmAction) return;
              if (confirmAction.type === "approve") {
                approveBooking.mutate(confirmAction.booking.id);
              } else {
                rejectBooking.mutate(confirmAction.booking.id);
              }
              setConfirmAction(null);
            }}
          >
            {confirmAction?.type === "approve" ? "Confirm Approval" : "Confirm Rejection"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default ManagerDashboard;
