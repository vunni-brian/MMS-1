import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileText,
  MessageSquare,
  Receipt,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, getTimeAwareGreeting, tSnake } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCenter } from "@/components/ui/ActionCenter";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { InsightCard } from "@/components/ui/InsightCard";
import { EmptyState } from "@/components/ui/EmptyState";

const fallbackNotices = [
  { id: "cleaning", title: "Market cleaning schedule", body: "Cleaning starts at 7:00 AM on Saturday.", createdAt: "2026-05-20T09:00:00Z" },
  { id: "deadline", title: "Payment reminder", body: "Monthly dues should be cleared before month end.", createdAt: "2026-05-18T09:00:00Z" },
  { id: "safety", title: "Fire safety briefing", body: "A short safety briefing is scheduled for all food vendors.", createdAt: "2026-05-15T09:00:00Z" },
];

const QuickAction = ({ icon: Icon, label, to }: { icon: ElementType; label: string; to: string }) => (
  <Link to={to}
    className="group flex min-h-[52px] items-center gap-3 rounded-xl border border-[#F1F3F5] bg-white px-4 py-3 text-left transition-all hover:border-[#0F5E3F]/40 hover:bg-[#E8F5EE]/30 hover:shadow-sm"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F5EE] text-[#0F5E3F]">
      <Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1 text-sm font-semibold text-[#111827]">{label}</span>
    <ChevronRight className="h-4 w-4 text-[#71717A] transition-transform group-hover:translate-x-1" />
  </Link>
);

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-6 w-[250px]" />
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

const VendorDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
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
  const penaltiesQuery = useQuery({
    queryKey: ["penalties", "vendor-dashboard"],
    queryFn: () => api.getPenalties({ status: "unpaid" }),
    enabled: !isPendingVendor,
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const isLoading =
    (!isPendingVendor && (stallsQuery.isPending || bookingsQuery.isPending || paymentsQuery.isPending || ticketsQuery.isPending || penaltiesQuery.isPending)) ||
    announcementsQuery.isPending;

  const isError =
    stallsQuery.isError || bookingsQuery.isError || paymentsQuery.isError ||
    ticketsQuery.isError || announcementsQuery.isError || penaltiesQuery.isError;

  if (isError) {
    return (
      <div className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] p-5 text-sm text-[#991B1B]">
        {t("vendor:dashboard.errorTitle")}: {t("vendor:dashboard.errorDesc")}
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  const stalls = stallsQuery.data?.stalls || [];
  const bookings = bookingsQuery.data?.bookings || [];
  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const notices = announcementsQuery.data?.announcements || [];
  const penalties = penaltiesQuery.data?.penalties || [];
  const overduePenalties = penalties.filter((p) => p.status === "unpaid");
  const activeStall = stalls.find((stall) => stall.vendorId === user?.id && stall.status === "active") || stalls[0];
  const approvedBookings = bookings.filter((booking) => booking.status === "approved");
  const outstandingBalance = approvedBookings.reduce((sum, booking) => sum + booking.amount, 0);
  const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const noticeRows = notices.length ? notices.slice(0, 3) : fallbackNotices;
  const paymentRows = [...payments]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5);

  const greeting = getTimeAwareGreeting(t, user?.name?.split(" ")[0]);

  const actionItems = [
    ...(outstandingBalance > 0 ? [{
      id: "pay-dues",
      icon: CreditCard,
      title: t("vendor:dashboard.payDues"),
      detail: `${t("vendor:dashboard.totalDue", { amount: formatCurrency(outstandingBalance) })}`,
      tone: "urgent" as const,
      action: <Link to="/vendor/payments"><Button size="sm" className="bg-[#EF476F] hover:bg-[#DC2626] text-white text-xs">{t("vendor:dashboard.payNow")}</Button></Link>,
    }] : []),
    ...overduePenalties.slice(0, 2).map((penalty) => ({
      id: `penalty-${penalty.id}`,
      icon: AlertTriangle,
      title: `${t("vendor:dashboard.penaltyPrefix")}: ${formatCurrency(penalty.amount)}`,
      detail: penalty.reason || t("common:unpaid"),
      tone: "urgent" as const,
    })),
    ...openComplaints.slice(0, 2).map((ticket) => ({
      id: `complaint-${ticket.id}`,
      icon: MessageSquare,
      title: ticket.subject,
      detail: `${ticket.priority} priority — ${tSnake(t, ticket.status)}`,
      tone: (ticket.priority === "urgent" || ticket.priority === "high" ? "warning" : "info") as const,
    })),
    ...(!activeStall ? [{
      id: "no-stall",
      icon: Store,
      title: t("vendor:dashboard.reserveStall"),
      detail: t("vendor:dashboard.stallAssignedInfo"),
      tone: "info" as const,
      action: <Link to="/vendor/stalls"><Button size="sm" variant="outline" className="text-xs">{t("vendor:dashboard.browseStalls")}</Button></Link>,
    }] : []),
  ];

  return (
    <WorkspaceLayout
      variant="with-right-panel"
      left={
        <>
          <PageHeader
            eyebrow={t("vendor:dashboard.eyebrow")}
            title={greeting}
            description={t("vendor:dashboard.subtitle", { market: user?.marketName || t("vendor:dashboard.yourMarket") })}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <InsightCard
              label={t("vendor:dashboard.myStall")}
              value={activeStall?.name || t("vendor:dashboard.notAssigned")}
              detail={activeStall ? `${activeStall.zone} — ${activeStall.size}` : t("vendor:dashboard.reserveStall")}
              icon={<Store className="h-5 w-5" />}
            />
            <InsightCard
              label={t("vendor:dashboard.outstandingBalance")}
              value={formatCurrency(outstandingBalance)}
              detail={t("vendor:dashboard.currentApprovedDues")}
              icon={<WalletCards className="h-5 w-5" />}
            />
            <InsightCard
              label={t("vendor:dashboard.complaintStatus")}
              value={openComplaints.length ? t("vendor:dashboard.openCount", { n: openComplaints.length }) : t("vendor:dashboard.clear")}
              detail={openComplaints.length ? t("vendor:dashboard.complaintsUnderReview") : t("vendor:dashboard.noUnresolvedComplaints")}
              icon={<MessageSquare className="h-5 w-5" />}
            />
          </div>

          <ActionCenter
            title={t("vendor:dashboard.quickActions")}
            items={actionItems}
            emptyMessage={t("vendor:dashboard.allClear")}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">{t("vendor:dashboard.paymentHistory")}</CardTitle>
              <Link to="/vendor/payments" className="text-xs font-medium text-[#0F5E3F] hover:underline">
                {t("common:viewAll")}
              </Link>
            </CardHeader>
            <CardContent>
              {paymentRows.length === 0 ? (
                <EmptyState variant="success" title={t("vendor:dashboard.noPaymentsYet")} description={t("vendor:dashboard.paymentsWillAppear")} />
              ) : (
                <div className="space-y-2">
                  {paymentRows.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F8F9FA]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-[#0F5E3F]">
                          <Receipt className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#111827]">{payment.description || tSnake(t, payment.chargeType, "common:chargeType")}</p>
                          <p className="truncate text-[11px] text-[#71717A]">{payment.createdAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#111827]">{formatCurrency(payment.amount)}</span>
                        <StatusBadge status={payment.status} context="payment" className="text-[10px]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      }
      right={
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">{t("vendor:dashboard.notifications")}</CardTitle>
              <Link to="/vendor/announcements" className="text-xs font-medium text-[#0F5E3F] hover:underline">
                {t("common:viewAll")}
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {noticeRows.map((notice) => (
                  <div key={notice.id} className="border-b border-[#F1F3F5] pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold text-[#111827]">{notice.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B7280]">{notice.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-[#F5A623]/20 bg-[#FEF3C7]/30 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-full bg-[#FEF3C7] p-2 text-[#F5A623]">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#92400E]">{t("vendor:dashboard.monthEndCollection")}</p>
                <p className="mt-1 text-xs text-[#B45309]">{t("vendor:dashboard.monthEndDesc")}</p>
              </div>
            </div>
          </div>

          {activeStall && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">{t("vendor:dashboard.currentStallDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-[#6B7280]">{t("vendor:dashboard.stallLabel")}</span>
                    <span className="text-sm font-semibold text-[#111827]">{activeStall.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#6B7280]">{t("vendor:dashboard.zoneLabel")}</span>
                    <span className="text-sm font-semibold text-[#111827]">{activeStall.zone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#6B7280]">{t("vendor:dashboard.sizeLabel")}</span>
                    <span className="text-sm font-semibold text-[#111827]">{activeStall.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#6B7280]">{t("vendor:dashboard.monthlyDuesLabel")}</span>
                    <span className="text-sm font-bold text-[#0F5E3F]">{formatCurrency(activeStall.pricePerMonth)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs text-[#6B7280]">{t("vendor:dashboard.statusLabel")}</span>
                    <StatusBadge status={activeStall.status === "active" ? "active" : "pending"} label={activeStall.status === "active" ? t("vendor:dashboard.activeStatus") : t("vendor:dashboard.pendingStatus")} className="text-[10px]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      }
    />
  );
};

export default VendorDashboard;
