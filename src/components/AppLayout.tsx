import { useEffect, useMemo, useState, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Gauge,
  Grid3X3,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Megaphone,
  MessagesSquare,
  Plug,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { getNavigationIdentity, getPageIdentity, getPageType, getPathSegments } from "@/config/pageIdentity";
import { getRoleExperience } from "@/config/roleExperience";
import { RoleInsightsRail } from "@/components/RoleInsightsRail";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/types";

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
    items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard, roles: ["vendor", "manager", "official", "admin"] },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Stalls", path: "stalls", icon: Grid3X3, roles: ["vendor", "manager"] },
      { label: "Vendors", path: "vendors", icon: Users, roles: ["manager"] },
      { label: "Payments", path: "payments", icon: CreditCard, roles: ["vendor", "manager"] },
      { label: "Markets", path: "markets", icon: Landmark, roles: ["admin"] },
      { label: "Billing", path: "billing", icon: Gauge, roles: ["manager", "official", "admin"] },
      { label: "Reports", path: "reports", icon: CircleDollarSign, roles: ["manager", "official", "admin"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Complaints", path: "complaints", icon: MessageSquare, roles: ["vendor", "manager"] },
      { label: "Requests", path: "coordination", icon: MessagesSquare, roles: ["manager", "official", "admin"] },
      { label: "Notices", path: "announcements", icon: Megaphone, roles: ["vendor", "manager", "official", "admin"] },
      { label: "Alerts", path: "alerts", icon: AlertTriangle, roles: ["admin"] },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Users", path: "users", icon: Users, roles: ["admin"] },
      { label: "Integrations", path: "integrations", icon: Plug, roles: ["admin"] },
      { label: "Settings", path: "settings", icon: Settings, roles: ["admin"] },
      { label: "Profile", path: "profile", icon: UserCircle, roles: ["vendor", "manager", "official", "admin"] },
      { label: "Activity Log", path: "audit", icon: ScrollText, roles: ["manager", "official", "admin"] },
    ],
  },
];

const adminNavItems: NavItem[] = [
  { label: "Dashboard", path: "", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Billing", path: "billing", icon: CreditCard, roles: ["admin"] },
  { label: "Reports", path: "reports", icon: BarChart3, roles: ["admin"] },
  { label: "Users", path: "users", icon: Users, roles: ["admin"] },
  { label: "Markets", path: "markets", icon: Landmark, roles: ["admin"] },
  { label: "Integrations", path: "integrations", icon: Plug, roles: ["admin"] },
  { label: "Alerts", path: "alerts", icon: Bell, roles: ["admin"] },
  { label: "Audit Log", path: "audit", icon: ScrollText, roles: ["admin"] },
  { label: "Settings", path: "settings", icon: Settings, roles: ["admin"] },
];

const insightRailSegments = new Set(["", "vendors", "stalls", "coordination", "announcements", "profile"]);

const getNavTarget = (basePath: string, item: NavItem) => {
  const path = item.path ? `${basePath}/${item.path}` : basePath;
  return item.query ? `${path}?${item.query}` : path;
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "app-layout-badge"],
    queryFn: () => api.getNotifications(5),
    enabled: Boolean(user),
    refetchInterval: DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL,
  });

  const notifications = useMemo(() => notificationsData?.notifications ?? [], [notificationsData?.notifications]);
  const hasUnread = notifications.some((notification) => !notification.read);
  const isPendingVendor = user?.role === "vendor" && user.vendorStatus !== "approved";
  const basePath = user ? `/${user.role}` : "/";
  const currentPage = getPageIdentity(location.pathname);
  const currentPageType = getPageType(location.pathname);
  const [, pageSegment = ""] = getPathSegments(location.pathname);

  const filteredGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!user) return false;
            if (!item.roles.includes(user.role)) return false;
            if (isPendingVendor) return item.path === "" || item.path === "profile" || item.path === "announcements";
            return true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [isPendingVendor, user],
  );

  const experience = user ? getRoleExperience(user.role) : null;
  const workspaceTitle = experience?.workspaceTitle || "Workspace";
  const headerScope = user?.marketName || experience?.scopeFallback || "No market assigned";
  const roleLabel = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "";
  const profilePath = `${basePath}/profile`;
  const isAdmin = user?.role === "admin";
  const showRoleInsightsRail =
    !isAdmin &&
    (currentPageType === "dashboard" || insightRailSegments.has(pageSegment));
  const quickActionPath = isPendingVendor
    ? `${basePath}/announcements`
    : experience?.quickActionPath || basePath;
  const quickActionLabel = isPendingVendor
    ? "View Notices"
    : experience?.quickActionLabel || "Quick Actions";
  const initials =
    user?.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  // Update browser tab title based on current page
  useEffect(() => {
    const pageLabel = currentPage.shortLabel;
    const workspace = workspaceTitle;
    document.title = pageLabel && pageLabel !== "Workspace"
      ? `${pageLabel} — ${workspace}`
      : workspace;
  }, [currentPage.shortLabel, workspaceTitle]);

  // Sync header search with URL ?q= param and clear on route change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setHeaderSearch(params.get("q") ?? "");
  }, [location.pathname, location.search]);

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

  const BrandIcon = isAdmin ? BarChart3 : ShieldCheck;

  const openProfileTab = (tab?: string) => {
    navigate(`${profilePath}${tab ? `?tab=${tab}` : ""}`);
  };

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", `app-role-${user.role}`)}>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground", isAdmin && "admin-brand-mark")}>
              <BrandIcon className="h-4 w-4" />
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

        <nav className={cn("flex-1 overflow-y-auto px-2 py-3", isAdmin && "admin-sidebar-nav")}>
          {isAdmin ? (
            <div className="admin-sidebar-list">
              {adminNavItems.map((item) => {
                const navIdentity = getNavigationIdentity(user.role, item.path);

                return (
                  <NavLink
                    key={`admin-${item.label}`}
                    to={getNavTarget(basePath, item)}
                    end={item.path === ""}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "workspace-nav-link relative flex h-14 items-center gap-3 rounded-xl px-4 text-base transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        `nav-accent-${navIdentity.accent}`,
                        isActive
                          ? "is-active font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )
                    }
                  >
                    <item.icon className="h-6 w-6 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ) : (
            filteredGroups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase text-sidebar-foreground/45">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const navIdentity = getNavigationIdentity(user.role, item.path);

                  return (
                    <NavLink
                      key={`${group.title}-${item.label}`}
                      to={getNavTarget(basePath, item)}
                      end={item.path === ""}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "workspace-nav-link relative flex h-9 items-center gap-2.5 rounded-md px-2.5 pl-4 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                          `nav-accent-${navIdentity.accent}`,
                          isActive
                            ? "is-active font-semibold"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                        )
                      }
                    >
                      <span className="workspace-nav-marker" />
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          )))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {isAdmin ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => openProfileTab()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              >
                <Avatar className="h-8 w-8 border border-sidebar-border">
                  {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                  <AvatarFallback className="bg-sidebar-accent text-[11px] font-semibold text-sidebar-foreground">{initials}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{user.name}</span>
                  <span className="block truncate text-[11px] text-sidebar-foreground/55">Profile and access</span>
                </span>
              </button>
              <Button
                variant="ghost"
                onClick={signOut}
                className="h-8 w-full justify-start gap-2.5 px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={signOut}
              className="h-8 w-full justify-start gap-2.5 px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user.role === "admin" && (
          <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-border/70 bg-card/95 px-3 lg:hidden">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-md p-1.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold font-heading">{workspaceTitle}</p>
              <p className="truncate text-[11px] text-muted-foreground">{currentPage.shortLabel}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </header>
        )}

        {user.role !== "admin" && (
        <header className="flex h-[58px] shrink-0 items-center gap-2 border-b border-border/70 bg-card/90 px-3 lg:gap-3 lg:px-4">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-md p-1.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Page title — visible on mobile only, hidden when search bar takes over on md+ */}
            <div className="min-w-0 flex-1 md:hidden">
              <p className="truncate text-sm font-semibold font-heading">{currentPage.shortLabel}</p>
            </div>

            <div className="relative hidden min-w-[220px] max-w-[360px] flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label={`Search ${currentPage.shortLabel}`}
                placeholder={`Search ${currentPage.shortLabel.toLowerCase()}...`}
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && headerSearch.trim()) {
                    const params = new URLSearchParams(location.search);
                    params.set("q", headerSearch.trim());
                    navigate(`${location.pathname}?${params.toString()}`);
                  }
                  if (e.key === "Escape") {
                    setHeaderSearch("");
                  }
                }}
                className="h-9 w-full rounded-md border border-border/70 bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-ring/15"
              />
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-success/20 bg-success/10 px-2.5 text-[11px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Online
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => navigate(quickActionPath)}
                disabled={isPendingVendor && user.role === "vendor"}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {quickActionLabel}
              </Button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
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
                {hasUnread && !isPendingVendor && (
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
        )}

        <div className="flex min-h-0 flex-1">
          <main
            className={cn("min-w-0 flex-1 overflow-y-auto overflow-x-hidden", user.role === "admin" ? "admin-portal-main" : "px-3 py-3 lg:px-4")}
            // Prevent interaction with main content while mobile sidebar is open
            inert={sidebarOpen ? true : undefined}
            aria-hidden={sidebarOpen ? true : undefined}
          >
            <Outlet />
          </main>

          {showRoleInsightsRail && (
            <RoleInsightsRail
              user={user}
              isPendingVendor={isPendingVendor}
              notifications={notifications}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
