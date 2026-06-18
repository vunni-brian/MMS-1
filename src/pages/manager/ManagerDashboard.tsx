import { useTranslation } from "react-i18next";
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
import type { LucideIcon } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDate } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { KpiStrip } from "@/components/console/ConsolePage";
import { Button } from "@/components/ui/button";
import type { Booking } from "@/types";

interface ApprovalRow {
  id: string;
  name: string;
  detail: string;
  booking?: Booking;
}

const DashboardSkeleton = () => (
  <div className="space-y-6">
  <div className="space-y-2">
  <Skeleton className="h-8 w-[250px]" />
  <Skeleton className="h-4 w-[400px]" />
  </div>
  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[120px] rounded-lg" />)}
  </div>
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
  <div className="grid gap-6">
  <Skeleton className="h-[250px] rounded-lg" />
  <Skeleton className="h-[200px] rounded-lg" />
  </div>
  <div className="grid content-start gap-6">
  <Skeleton className="h-[180px] rounded-lg" />
  <Skeleton className="h-[180px] rounded-lg" />
  <Skeleton className="h-[180px] rounded-lg" />
  </div>
  </div>
  </div>
);

const ManagerDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
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
  <div className="p-4 sm:p-6">
  <Alert variant="destructive" className="max-w-xl">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>{t("manager:dashboard.errorTitle")}</AlertTitle>
  <AlertDescription>{t("manager:dashboard.errorDesc")}</AlertDescription>
  </Alert>
  </div>
  );
  }

  if (isLoading) {
  return <DashboardSkeleton />;
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
  const occupancyRate = stalls.length > 0 ? Math.round((activeStalls.length / stalls.length) * 100) : 0;
  const outstandingDues = payments
  .filter((payment) => payment.status === "pending")
  .reduce((sum, payment) => sum + payment.amount, 0);
  const totalRevenue = payments
  .filter((payment) => payment.status === "completed")
  .reduce((sum, payment) => sum + payment.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const utilityAlerts = utilityCharges.filter((charge) => ["overdue", "unpaid", "pending_payment"].includes(charge.status));

  const approvalRows: ApprovalRow[] = pendingApplications.slice(0, 4).map((booking) => ({
  id: booking.id,
  name: booking.vendorName,
  detail: `${booking.stallName} - ${booking.marketName || user?.marketName || t("common:market")}`,
  booking,
  }));
  const bookingRows = [...bookings]
  .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  .slice(0, 4);
  const complaintRows = openComplaints.slice(0, 4);
  const staffFeed = [
  { id: "vendors", title: t("manager:dashboard.vendorRecordsUpdated"), detail: t("manager:dashboard.approvedVendors", { n: vendors.filter((vendor) => vendor.status === "approved").length }), icon: Users },
  { id: "stalls", title: t("manager:dashboard.stallInventorySynced"), detail: t("manager:dashboard.activeStalls", { n: activeStalls.length }), icon: Store },
  { id: "payments", title: t("manager:dashboard.paymentReviewQueue"), detail: t("manager:dashboard.paymentsAwaiting", { n: payments.filter((payment) => payment.status === "pending").length }), icon: CreditCard },
  ];

  return (
  <div className="space-y-6">
  <div>
  <div className="flex items-center justify-between">
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("manager:dashboard.eyebrow")}</p>
  <h1 className="text-3xl font-bold font-heading text-foreground">{t("manager:dashboard.title")}</h1>
  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
  {t("manager:dashboard.subtitle", { market: user?.marketName || "your market" })}
  </p>
  </div>
  </div>
  </div>

  <KpiStrip columns="grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" items={[
  { label: t("manager:dashboard.kpiPendingApprovals"), value: pendingApplications.length, detail: t("manager:dashboard.kpiVendorApps"), tone: "info", icon: UserCheck },
  { label: t("manager:dashboard.kpiOccupiedStalls"), value: activeStalls.length, detail: t("manager:dashboard.kpiOccupiedPercent", { n: occupancyRate }), tone: "success", icon: Store },
  { label: t("manager:dashboard.kpiRevenueMonth"), value: formatCurrency(totalRevenue), detail: t("manager:dashboard.kpiCompletedPayments"), tone: "info", icon: Banknote },
  { label: t("manager:dashboard.kpiOpenComplaints"), value: openComplaints.length, detail: t("manager:dashboard.kpiNeedsResponse"), tone: openComplaints.length > 0 ? "destructive" : "success", icon: MessageSquare },
  { label: t("manager:dashboard.kpiOutstandingDues"), value: formatCurrency(outstandingDues), detail: t("manager:dashboard.kpiPendingCollection"), tone: outstandingDues > 0 ? "warning" : "success", icon: CreditCard },
  { label: t("manager:dashboard.kpiUtilityAlerts"), value: utilityAlerts.length, detail: t("manager:dashboard.kpiOverdueUnpaid"), tone: utilityAlerts.length > 0 ? "warning" : "success", icon: Zap },
  ]} />

  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
  <div className="grid gap-6 content-start">
  <div>
  <Card>
  <CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>{t("manager:dashboard.vendorApprovalQueue")}</CardTitle>
  <Link to="/manager/vendors" className="text-sm font-medium text-primary hover:underline">
  {t("common:viewAll")}
  </Link>
  </CardHeader>
  <CardContent>
  {approvalRows.length === 0 ? (
  <div className="rounded-lg bg-muted/50 p-6 text-center text-sm text-muted-foreground">
  {t("manager:dashboard.noPendingApprovals")}
  </div>
  ) : (
  <div className="grid gap-3">
  {approvalRows.map((row) => (
  <div key={row.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
  {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
  </div>
  <div className="min-w-0 flex-1">
  <p className="truncate text-sm font-semibold">{row.name}</p>
  <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
  <p className="mt-1 text-[11px] text-muted-foreground">{t("manager:dashboard.docAndStallReview")}</p>
  </div>
  <div className="flex shrink-0 gap-2">
  <Button
  size="sm"
  variant="outline"
  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400"
  disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
  onClick={() => row.booking && approveBooking.mutate(row.booking.id)}
  >
  {t("common:approve")}
  </Button>
  <Button
  size="sm"
  variant="outline"
  className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400"
  disabled={!row.booking || approveBooking.isPending || rejectBooking.isPending}
  onClick={() => row.booking && rejectBooking.mutate(row.booking.id)}
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
  </div>

  <div className="grid gap-6 lg:grid-cols-2">
  <div>
  <Card>
  <CardHeader>
  <CardTitle>{t("manager:dashboard.stallOccupancy")}</CardTitle>
  </CardHeader>
  <CardContent>
  <div className="space-y-6">
  <div>
  <div className="flex items-end justify-between gap-3">
  <p className="text-3xl font-bold tracking-tight font-heading">{occupancyRate}%</p>
  <Badge variant={occupancyRate >= 80 ? "default" : "secondary"}>{t("manager:dashboard.activeLabel", { n: activeStalls.length })}</Badge>
  </div>
  <div className="mt-4 h-2 rounded-full bg-muted">
  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(occupancyRate, 100)}%` }} />
  </div>
  </div>
  <div className="grid grid-cols-3 gap-3 text-center">
  <div className="rounded-lg bg-muted/40 p-3">
  <p className="text-lg font-bold">{stalls.length}</p>
  <p className="text-xs text-muted-foreground mt-1">{t("manager:dashboard.total")}</p>
  </div>
  <div className="rounded-lg bg-muted/40 p-3">
  <p className="text-lg font-bold">{stalls.filter((stall) => stall.status === "maintenance").length}</p>
  <p className="text-xs text-muted-foreground mt-1">{t("manager:dashboard.service")}</p>
  </div>
  <div className="rounded-lg bg-muted/40 p-3">
  <p className="text-lg font-bold">{Math.max(stalls.length - activeStalls.length, 0)}</p>
  <p className="text-xs text-muted-foreground mt-1">{t("manager:dashboard.available")}</p>
  </div>
  </div>
  </div>
  </CardContent>
  </Card>
  </div>

  <div>
  <Card>
  <CardHeader>
  <CardTitle>{t("manager:dashboard.bookingActivity")}</CardTitle>
  </CardHeader>
  <CardContent>
  <div className="space-y-3">
  {bookingRows.length ? bookingRows.map((booking) => (
  <div key={booking.id} className="flex items-center gap-4 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50">
  <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
  <div className="min-w-0 flex-1">
  <p className="truncate text-sm font-semibold">{booking.vendorName}</p>
  <p className="truncate text-xs text-muted-foreground">{booking.stallName} - {formatHumanDate(booking.createdAt)}</p>
  </div>
  <StatusBadge status={booking.status} context="booking" />
  </div>
  )) : (
  <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">{t("manager:dashboard.noBookingActivity")}</div>
  )}
  </div>
  </CardContent>
  </Card>
  </div>
  </div>
  </div>

  <div className="grid content-start gap-6">
  <div>
  <Card>
  <CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>{t("manager:dashboard.recentComplaints")}</CardTitle>
  <Link to="/manager/complaints" className="text-sm font-medium text-primary hover:underline">
  {t("manager:dashboard.openQueue")}
  </Link>
  </CardHeader>
  <CardContent>
  <div className="space-y-3">
  {complaintRows.length ? complaintRows.map((ticket) => (
  <div key={ticket.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
  <div className="flex items-start justify-between gap-3">
  <div className="min-w-0">
  <p className="truncate text-sm font-semibold">{ticket.subject}</p>
  <p className="mt-1 truncate text-xs text-muted-foreground">{ticket.vendorName}</p>
  </div>
  <Badge variant={ticket.priority === "urgent" || ticket.priority === "high" ? "destructive" : "secondary"} className="capitalize">
  {ticket.priority}
  </Badge>
  </div>
  </div>
  )) : (
  <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">{t("manager:dashboard.noOpenComplaints")}</div>
  )}
  </div>
  </CardContent>
  </Card>
  </div>

  <div>
  <Card>
  <CardHeader>
  <CardTitle>{t("manager:dashboard.staffActivityFeed")}</CardTitle>
  </CardHeader>
  <CardContent>
  <div className="space-y-3">
  {staffFeed.map((item) => {
  const Icon = item.icon;
  return (
  <div key={item.id} className="flex items-start gap-4 rounded-lg bg-muted/30 p-3">
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm text-primary">
  <Icon className="h-4 w-4" />
  </span>
  <div className="min-w-0">
  <p className="truncate text-sm font-semibold">{item.title}</p>
  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
  </div>
  </div>
  );
  })}
  <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
  <CheckCircle2 className="h-4 w-4" />
  {t("manager:dashboard.dailyOpsInSync")}
  </div>
  </div>
  </CardContent>
  </Card>
  </div>
  </div>
  </div>
  </div>
  );
};

export default ManagerDashboard;
