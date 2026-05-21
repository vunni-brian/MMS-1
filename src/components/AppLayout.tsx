import { useEffect, useMemo, useState, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Gauge,
  Grid3X3,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  Plus,
  ReceiptText,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Store,
  UserCircle,
  Users,
  X,
} from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MiniSparkline } from "@/components/console/ConsolePage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppNotification, AuthUser, Permission, Role } from "@/types";

interface NavItem {
  label: string;
  path: string;
  icon: ElementType;
  roles: Role[];
  query?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Dashboard",
    items: [{ label: "Overview", path: "", icon: LayoutDashboard, roles: ["vendor", "manager", "official", "admin"] }],
  },
  {
    title: "Operations",
    items: [
      { label: "Complaints", path: "complaints", icon: MessageSquare, roles: ["vendor", "manager", "official", "admin"] },
      { label: "Vendors", path: "vendors", icon: Users, roles: ["manager", "official", "admin"] },
      { label: "Utilities", path: "billing", icon: Gauge, roles: ["manager", "official", "admin"] },
      { label: "Markets", path: "stalls", icon: Grid3X3, roles: ["manager", "official", "admin"] },
    ],
  },
  {
    title: "Financial",
    items: [
      { label: "Payments", path: "payments", icon: CreditCard, roles: ["vendor", "manager"] },
      { label: "Reports", path: "reports", icon: CircleDollarSign, roles: ["manager", "official", "admin"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", path: "users", icon: Users, roles: ["admin"] },
      { label: "Settings", path: "profile", icon: Settings, roles: ["vendor", "manager", "official", "admin"] },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Notifications", path: "profile", query: "tab=notifications", icon: Bell, roles: ["vendor", "manager", "official", "admin"] },
      { label: "Support", path: "profile", query: "tab=security", icon: Headphones, roles: ["vendor", "manager", "official", "admin"] },
    ],
  },
];

const hasPermission = (user: AuthUser, permission: Permission) => user.permissions.includes(permission);

const roleWorkspaceTitle: Record<Role, string> = {
  admin: "System Command",
  official: "Market Oversight",
  manager: "Operations Desk",
  vendor: "Vendor Workspace",
};

const roleWorkspaceSubtitle: Record<Role, string> = {
  admin: "Government market operations platform",
  official: "Regional compliance and market monitoring",
  manager: "Approvals, occupancy, payments, and complaints",
  vendor: "Applications, payments, stalls, and market updates",
};

const getNavTarget = (basePath: string, item: NavItem) => {
  const path = item.path ? `${basePath}/${item.path}` : basePath;
  return item.query ? `${path}?${item.query}` : path;
};

const getQuickActions = (role: Role, isPendingVendor: boolean) => {
  if (role === "vendor") {
    return isPendingVendor
      ? [
        { label: "Open profile", path: "/vendor/profile", icon: UserCircle },
        { label: "Security settings", path: "/vendor/profile?tab=security", icon: KeyRound },
      ]
      : [
        { label: "Apply for stall", path: "/vendor/stalls", icon: Store },
        { label: "Pay bills", path: "/vendor/payments", icon: CreditCard },
        { label: "Raise complaint", path: "/vendor/complaints", icon: MessageSquare },
      ];
  }

  if (role === "manager") {
    return [
      { label: "Review vendors", path: "/manager/vendors", icon: Users },
      { label: "Open complaints", path: "/manager/complaints", icon: MessageSquare },
      { label: "Payment records", path: "/manager/payments", icon: CreditCard },
    ];
  }

  if (role === "official") {
    return [
      { label: "Review requests", path: "/official/coordination", icon: ClipboardList },
      { label: "Reports", path: "/official/reports", icon: BarChart3 },
      { label: "Audit log", path: "/official/audit", icon: ScrollText },
    ];
  }

  return [
    { label: "Invite staff", path: "/admin/users", icon: Users },
    { label: "Billing controls", path: "/admin/billing", icon: ReceiptText },
    { label: "Reports", path: "/admin/reports", icon: BarChart3 },
    { label: "Audit log", path: "/admin/audit", icon: ScrollText },
  ];
};

const compactNumber = (value: number) =>
  value >= 1_000 ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(value) : value.toLocaleString();

interface InsightMetric {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

interface InsightAlert {
  id: string;
  label: string;
  detail: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

const toneClassName = (tone: InsightMetric["tone"] = "default") => {
  if (tone === "success") return "border-success/20 bg-success/10 text-success";
  if (tone === "warning") return "border-warning/25 bg-warning/10 text-warning";
  if (tone === "destructive") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (tone === "info") return "border-info/20 bg-info/10 text-info";
  return "border-border/70 bg-muted/35 text-muted-foreground";
};

const InsightRow = ({ item }: { item: InsightMetric }) => (
  <div className="rounded-md border border-border/70 bg-background/80 p-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{item.label}</p>
        <p className="mt-1 truncate text-base font-bold leading-none font-heading tabular-nums">{item.value}</p>
      </div>
      <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-4", toneClassName(item.tone))}>
        {item.detail}
      </span>
    </div>
  </div>
);

const AlertRow = ({ alert }: { alert: InsightAlert }) => (
  <div className="rounded-md border border-border/70 bg-background/80 p-2.5">
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", alert.tone === "destructive" ? "bg-destructive" : alert.tone === "warning" ? "bg-warning" : alert.tone === "success" ? "bg-success" : "bg-info")} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{alert.label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{alert.detail}</p>
      </div>
    </div>
  </div>
);

const RoleInsightsRail = ({
  user,
  isPendingVendor,
  notifications,
}: {
  user: AuthUser;
  isPendingVendor: boolean;
  notifications: AppNotification[];
}) => {
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

  const payments = paymentsQuery.data?.payments || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const stalls = stallsQuery.data?.stalls || [];
  const utilityCharges = utilitiesQuery.data?.utilityCharges || [];
  const penalties = penaltiesQuery.data?.penalties || [];
  const vendors = vendorsQuery.data?.vendors || [];
  const bookings = bookingsQuery.data?.bookings || [];
  const markets = marketsQuery.data?.markets || [];
  const requests = requestsQuery.data?.requests || [];

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
            { label: "Open obligations", value: formatCurrency(vendorObligationTotal), detail: vendorObligationTotal ? "due" : "clear", tone: vendorObligationTotal ? "warning" : "success" },
            { label: "Active stalls", value: compactNumber(activeStalls.length), detail: "assigned", tone: "info" },
            { label: "Alerts", value: compactNumber(unreadNotifications.length), detail: unreadNotifications.length ? "new" : "clear", tone: unreadNotifications.length ? "warning" : "success" },
          ];

  const alerts: InsightAlert[] = [
    ...(isPendingVendor
      ? [{ id: "vendor-pending", label: "Approval pending", detail: "Operational routes unlock after manager review.", tone: "warning" as const }]
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

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border/70 bg-card/85 xl:flex">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold font-heading">Insights Rail</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Live operational context</p>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", isPendingVendor ? toneClassName("warning") : toneClassName("success"))}>
            {isPendingVendor ? "Limited" : "Live"}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-2">
          {metrics.map((metric) => (
            <InsightRow key={metric.label} item={metric} />
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border/70 bg-background/80 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Activity Trend</p>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <MiniSparkline
            values={[
              Math.max(4, activeStalls.length + 4),
              Math.max(6, openTickets.length + 8),
              Math.max(8, pendingPayments.length + 10),
              Math.max(9, failedPayments.length + 9),
              Math.max(11, completedPayments.length + 11),
              Math.max(10, pendingRequests.length + 12),
              Math.max(12, openTickets.length + pendingPayments.length + 12),
            ]}
            className="mt-3 h-10 w-full text-primary"
          />
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] text-muted-foreground">
            <span>Cases</span>
            <span>Cash</span>
            <span>Risk</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Attention</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{alerts.length}</span>
          </div>
          <div className="space-y-2">
            {alerts.length ? (
              alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
            ) : (
              <div className="rounded-md border border-dashed border-border/70 bg-background/80 p-3 text-center">
                <p className="text-xs font-medium">No active attention items</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Exceptions and approvals will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "app-layout-badge"],
    queryFn: () => api.getNotifications(5),
    enabled: user?.role === "vendor",
    refetchInterval: DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL,
  });

  const notifications = notificationsData?.notifications || [];
  const hasUnread = notifications.some((notification) => !notification.read);
  const isPendingVendor = user?.role === "vendor" && user.vendorStatus !== "approved";
  const basePath = user ? `/${user.role}` : "/";

  const filteredGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!user) return false;
            if (!item.roles.includes(user.role)) return false;
            if (isPendingVendor) return item.path === "" || item.path === "profile";
            return true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [isPendingVendor, user],
  );

  const workspaceTitle = user ? roleWorkspaceTitle[user.role] : "Workspace";
  const workspaceSubtitle = user ? roleWorkspaceSubtitle[user.role] : "";
  const headerScope =
    user?.marketName ||
    (user?.role === "admin"
      ? "All markets"
      : user?.role === "official"
        ? "Regional oversight"
        : "No market assigned");
  const roleLabel = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "";
  const profilePath = `${basePath}/profile`;
  const initials =
    user?.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const quickActions = user ? getQuickActions(user.role, Boolean(isPendingVendor)) : [];

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;
    setProfileImageUrl(null);

    if (!user?.profileImage) {
      return;
    }

    api
      .getUserProfileImageUrl(user.id)
      .then((url) => {
        objectUrl = url;
        if (isActive) {
          setProfileImageUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (isActive) {
          setProfileImageUrl(null);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [user?.id, user?.profileImage]);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading workspace...</div>;
  }

  const openProfileTab = (tab?: string) => {
    navigate(`${profilePath}${tab ? `?tab=${tab}` : ""}`);
  };

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold font-heading">{workspaceTitle}</p>
              <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">{headerScope}</p>
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              className="rounded-md p-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {filteredGroups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={`${group.title}-${item.label}`}
                    to={getNavTarget(basePath, item)}
                    end={item.path === ""}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            onClick={signOut}
            className="h-8 w-full justify-start gap-2.5 px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[58px] shrink-0 items-center gap-2 border-b border-border/70 bg-card/90 px-3 lg:gap-3 lg:px-4">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-md p-1.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="hidden min-w-[190px] flex-none 2xl:block">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold font-heading">{workspaceTitle}</p>
                <span className="hidden rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
                  {isPendingVendor ? "Access pending" : "Operational"}
                </span>
              </div>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{workspaceSubtitle}</p>
            </div>

            <div className="relative hidden min-w-[220px] max-w-[360px] flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search operations"
                placeholder="Search operations..."
                className="h-9 w-full rounded-md border border-border/70 bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-ring/15"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Online
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden h-9 gap-1.5 md:inline-flex">
                    <Plus className="h-3.5 w-3.5" />
                    Quick Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1">
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">Operational shortcuts</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {quickActions.map((action) => (
                    <DropdownMenuItem
                      key={action.path}
                      onClick={() => navigate(action.path)}
                      className="gap-2 rounded-md text-sm"
                    >
                      <action.icon className="h-4 w-4 text-muted-foreground" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                aria-label="Open notifications"
                onClick={() => {
                  if (!isPendingVendor) {
                    openProfileTab("notifications");
                  }
                }}
                disabled={isPendingVendor}
                className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Bell className="h-4 w-4" />
                {user.role === "vendor" && hasUnread && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-background bg-warning" />
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-1.5 pr-2 text-left transition-colors hover:bg-muted/45"
                  >
                    <Avatar className="h-7 w-7 border border-border/70">
                      {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                      <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-xs font-semibold sm:block">{user.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2">
                  <DropdownMenuLabel className="p-2">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border border-border/70">
                        {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                        <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold font-heading">{user.name}</p>
                        <p className="text-xs font-medium text-muted-foreground">{roleLabel} - {headerScope}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openProfileTab()} className="gap-3">
                    <UserCircle className="h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  {!isPendingVendor && (
                    <DropdownMenuItem onClick={() => openProfileTab("notifications")} className="gap-3">
                      <Bell className="h-4 w-4" />
                      Notifications
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => openProfileTab("security")} className="gap-3">
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="gap-3 text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 lg:px-4">
            <Outlet />
          </main>

          <RoleInsightsRail user={user} isPendingVendor={Boolean(isPendingVendor)} notifications={notifications} />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
