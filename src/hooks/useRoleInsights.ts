import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AppNotification, AuthUser, Permission } from "@/types";

export type InsightTone = "default" | "success" | "warning" | "destructive" | "info";

export interface InsightMetric {
  label: string;
  value: string;
  detail: string;
  tone?: InsightTone;
}

export interface InsightAlert {
  id: string;
  label: string;
  detail: string;
  tone?: InsightTone;
}

export interface RoleInsightsState {
  metrics: InsightMetric[];
  alerts: InsightAlert[];
  trendValues: number[];
}

const compactNumber = (value: number) =>
  value >= 1_000 ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(value) : value.toLocaleString();

const hasPermission = (user: AuthUser, permission: Permission) => user.permissions.includes(permission);

// Keep live operational summaries out of AppLayout so the shell remains focused on navigation and placement.
export const useRoleInsights = ({
  user,
  isPendingVendor,
  notifications,
}: {
  user: AuthUser;
  isPendingVendor: boolean;
  notifications: AppNotification[];
}): RoleInsightsState => {
  // Pending vendors should see approval context without triggering locked operational requests.
  const canLoadOperationalData = !isPendingVendor;

  const paymentsQuery = useQuery({
    queryKey: ["payments", "insights-rail", user.role],
    queryFn: () => api.getPayments(),
    enabled: canLoadOperationalData && hasPermission(user, "payment:read"),
    refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "insights-rail", user.role],
    queryFn: () => api.getTickets(),
    enabled: canLoadOperationalData && hasPermission(user, "ticket:read"),
    refetchInterval: DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const stallsQuery = useQuery({
    queryKey: ["stalls", "insights-rail", user.role],
    queryFn: () => api.getStalls(user.role === "vendor" ? { scope: "mine" } : undefined),
    enabled: canLoadOperationalData && hasPermission(user, "stall:read"),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const utilitiesQuery = useQuery({
    queryKey: ["utility-charges", "insights-rail", user.role],
    queryFn: () => api.getUtilityCharges(),
    enabled: canLoadOperationalData && hasPermission(user, "utility:read"),
    refetchInterval: DASHBOARD_CONFIG.UTILITIES_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const penaltiesQuery = useQuery({
    queryKey: ["penalties", "insights-rail", user.role],
    queryFn: () => api.getPenalties(),
    enabled: canLoadOperationalData && hasPermission(user, "penalty:read"),
    refetchInterval: DASHBOARD_CONFIG.UTILITIES_REFRESH_INTERVAL,
    gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "insights-rail", user.role],
    queryFn: () => api.getVendors(),
    enabled: canLoadOperationalData && hasPermission(user, "vendor:read"),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "insights-rail", user.role],
    queryFn: () => api.getBookings(),
    enabled: canLoadOperationalData && hasPermission(user, "booking:read"),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const marketsQuery = useQuery({
    queryKey: ["markets", "insights-rail", user.role],
    queryFn: () => api.getMarkets(),
    enabled: canLoadOperationalData && (user.role === "official" || user.role === "admin"),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const requestsQuery = useQuery({
    queryKey: ["resource-requests", "insights-rail", user.role],
    queryFn: () => api.getResourceRequests(),
    enabled: canLoadOperationalData && hasPermission(user, "resource:read"),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const payments = useMemo(() => paymentsQuery.data?.payments ?? [], [paymentsQuery.data?.payments]);
  const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data?.tickets]);
  const stalls = useMemo(() => stallsQuery.data?.stalls ?? [], [stallsQuery.data?.stalls]);
  const utilityCharges = useMemo(() => utilitiesQuery.data?.utilityCharges ?? [], [utilitiesQuery.data?.utilityCharges]);
  const penalties = useMemo(() => penaltiesQuery.data?.penalties ?? [], [penaltiesQuery.data?.penalties]);
  const vendors = useMemo(() => vendorsQuery.data?.vendors ?? [], [vendorsQuery.data?.vendors]);
  const bookings = useMemo(() => bookingsQuery.data?.bookings ?? [], [bookingsQuery.data?.bookings]);
  const markets = useMemo(() => marketsQuery.data?.markets ?? [], [marketsQuery.data?.markets]);
  const requests = useMemo(() => requestsQuery.data?.requests ?? [], [requestsQuery.data?.requests]);

  return useMemo(() => {
    const completedPayments = payments.filter((payment) => payment.status === "completed");
    const failedPayments = payments.filter((payment) => payment.status === "failed");
    const pendingPayments = payments.filter((payment) => payment.status === "pending");
    const openTickets = tickets.filter((ticket) => ticket.status !== "resolved");
    const overdueUtilities = utilityCharges.filter((charge) => charge.status === "overdue");
    const unpaidUtilities = utilityCharges.filter((charge) => ["unpaid", "pending", "pending_payment", "overdue"].includes(charge.status));
    const openPenalties = penalties.filter((penalty) => ["unpaid", "pending", "pending_payment"].includes(penalty.status));
    const pendingVendors = vendors.filter((vendor) => vendor.status === "pending");
    const pendingBookings = bookings.filter((booking) => booking.status === "pending");
    const pendingRequests = requests.filter((request) => request.status === "pending");
    const activeStalls = stalls.filter((stall) => stall.status === "active");
    const completedTotal = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const vendorObligationTotal =
      bookings.filter((booking) => booking.status === "approved").reduce((sum, booking) => sum + booking.amount, 0) +
      unpaidUtilities.reduce((sum, charge) => sum + charge.amount, 0) +
      openPenalties.reduce((sum, penalty) => sum + penalty.amount, 0);
    const occupancyRate = stalls.length ? Math.round((activeStalls.length / stalls.length) * 100) : 0;
    const unreadNotifications = notifications.filter((notification) => !notification.read);

    // Each role gets a different summary lens over the same domain data.
    const metrics: InsightMetric[] =
      user.role === "admin"
        ? [
            { label: "Exception load", value: compactNumber(openTickets.length + failedPayments.length + overdueUtilities.length), detail: "watch", tone: openTickets.length || failedPayments.length ? "warning" : "success" },
            { label: "Collections", value: formatCurrency(completedTotal), detail: "live", tone: "success" },
            { label: "Markets", value: compactNumber(markets.length), detail: "system", tone: "info" },
          ]
        : user.role === "official"
          ? [
              { label: "Risk signals", value: compactNumber(openTickets.length + overdueUtilities.length + pendingRequests.length), detail: "scope", tone: openTickets.length || overdueUtilities.length ? "warning" : "success" },
              { label: "Markets", value: compactNumber(markets.length), detail: "monitored", tone: "info" },
              { label: "Collections", value: formatCurrency(completedTotal), detail: "posted", tone: "success" },
            ]
          : user.role === "manager"
            ? [
                { label: "Approvals", value: compactNumber(pendingVendors.length + pendingBookings.length), detail: "queue", tone: pendingVendors.length + pendingBookings.length ? "warning" : "success" },
                { label: "Open cases", value: compactNumber(openTickets.length), detail: "desk", tone: openTickets.length ? "warning" : "success" },
                { label: "Occupancy", value: `${occupancyRate}%`, detail: `${activeStalls.length}/${stalls.length}`, tone: "info" },
              ]
            : [
                { label: "Payments due", value: formatCurrency(vendorObligationTotal), detail: vendorObligationTotal ? "due" : "clear", tone: vendorObligationTotal ? "warning" : "success" },
                { label: "Active stalls", value: compactNumber(activeStalls.length), detail: "assigned", tone: "info" },
                { label: "Alerts", value: compactNumber(unreadNotifications.length), detail: unreadNotifications.length ? "new" : "clear", tone: unreadNotifications.length ? "warning" : "success" },
              ];

    const alerts: InsightAlert[] = [
      ...(isPendingVendor
        ? [{ id: "vendor-pending", label: "Approval pending", detail: "Workspace pages unlock after manager review.", tone: "warning" as const }]
        : []),
      ...unreadNotifications.slice(0, 2).map((notification) => ({
        id: `notification-${notification.id}`,
        label: notification.priority === "high" ? "High priority alert" : "Notification",
        detail: notification.message,
        tone: notification.priority === "high" ? ("warning" as const) : ("info" as const),
      })),
      ...failedPayments.slice(0, 2).map((payment) => ({
        id: `failed-payment-${payment.id}`,
        label: "Payment exception",
        detail: `${payment.vendorName} - ${formatCurrency(payment.amount)}`,
        tone: "destructive" as const,
      })),
      ...openTickets.slice(0, 2).map((ticket) => ({
        id: `ticket-${ticket.id}`,
        label: ticket.category === "dispute" ? "Dispute case" : "Open complaint",
        detail: ticket.subject,
        tone: ticket.category === "dispute" ? ("destructive" as const) : ("warning" as const),
      })),
      ...pendingRequests.slice(0, 2).map((request) => ({
        id: `request-${request.id}`,
        label: "Resource request",
        detail: request.title,
        tone: "info" as const,
      })),
      ...pendingPayments.slice(0, 1).map((payment) => ({
        id: `pending-payment-${payment.id}`,
        label: "Payment processing",
        detail: `${payment.vendorName} - ${formatCurrency(payment.amount)}`,
        tone: "info" as const,
      })),
    ].slice(0, 5);

    const trendValues = [
      activeStalls.length,
      openTickets.length,
      pendingPayments.length,
      failedPayments.length,
      completedPayments.length,
      pendingRequests.length,
      openTickets.length + pendingPayments.length,
    ].map((v) => Math.max(v, 0));

    return { metrics, alerts, trendValues };
  }, [bookings, isPendingVendor, markets.length, notifications, payments, penalties, requests, stalls, tickets, user.role, utilityCharges, vendors]);
};
