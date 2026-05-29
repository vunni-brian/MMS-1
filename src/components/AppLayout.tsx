import { useEffect, useMemo, useState, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Gauge,
  HelpCircle,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Megaphone,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
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
import { getNavigationIdentity, getPageIdentity } from "@/config/pageIdentity";
import { getRoleExperience } from "@/config/roleExperience";
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
  query?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const roleNavGroups: Record<Role, NavGroup[]> = {
  vendor: [
    {
      title: "Vendor",
      items: [
        { label: "Dashboard", path: "", icon: LayoutDashboard },
        { label: "My Stall", path: "stalls", icon: Store },
        { label: "Payments", path: "payments", icon: CreditCard },
        { label: "Complaints", path: "complaints", icon: MessageSquare },
        { label: "Notifications", path: "notifications", icon: Bell },
        { label: "Profile", path: "profile", icon: UserCircle },
      ],
    },
  ],
  manager: [
    {
      title: "Operations",
      items: [
        { label: "Dashboard", path: "", icon: LayoutDashboard },
        { label: "Vendors", path: "vendors", icon: Users },
        { label: "Stalls & Bookings", path: "stalls", icon: Store },
        { label: "Payments", path: "payments", icon: CreditCard },
        { label: "Billing", path: "billing", icon: Gauge },
        { label: "Complaints", path: "complaints", icon: MessageSquare },
      ],
    },
    {
      title: "Review",
      items: [
        { label: "Reports", path: "reports", icon: CircleDollarSign },
        { label: "Coordination", path: "coordination", icon: MessagesSquare },
        { label: "Notices", path: "announcements", icon: Megaphone },
        { label: "Profile", path: "profile", icon: UserCircle },
      ],
    },
  ],
  official: [
    {
      title: "Oversight",
      items: [
        { label: "Dashboard", path: "", icon: LayoutDashboard },
        { label: "Reports", path: "reports", icon: BarChart3 },
        { label: "Audit", path: "audit", icon: ScrollText },
        { label: "Compliance", path: "billing", icon: ShieldCheck },
        { label: "Coordination", path: "coordination", icon: MessagesSquare },
        { label: "Resources", path: "announcements", icon: ClipboardList },
        { label: "Profile", path: "profile", icon: UserCircle },
      ],
    },
  ],
  admin: [
    {
      title: "Platform",
      items: [
        { label: "Dashboard", path: "", icon: LayoutDashboard },
        { label: "Users", path: "users", icon: Users },
        { label: "Roles & Permissions", path: "users", query: "tab=roles", icon: KeyRound },
        { label: "Billing Controls", path: "billing", icon: CreditCard },
        { label: "Audit Logs", path: "audit", icon: ScrollText },
        { label: "System Health", path: "alerts", icon: AlertTriangle },
        { label: "Notifications", path: "notifications", icon: Bell },
        { label: "Reports", path: "reports", icon: BarChart3 },
        { label: "Settings", path: "settings", icon: Settings },
        { label: "Profile", path: "profile", icon: UserCircle },
      ],
    },
    {
      title: "Configuration",
      items: [
        { label: "Markets", path: "markets", icon: Landmark },
        { label: "Integrations", path: "integrations", icon: Plug },
        { label: "Coordination", path: "coordination", icon: MessagesSquare },
      ],
    },
  ],
};

const roleLabels: Record<Role, string> = {
  vendor: "Vendor",
  manager: "Manager",
  official: "Official",
  admin: "Admin",
};

const roleDescriptions: Record<Role, string> = {
  vendor: "Daily stall operations",
  manager: "Market command center",
  official: "Regional oversight",
  admin: "Platform control",
};

const getNavTarget = (basePath: string, item: NavItem) => {
  const path = item.path ? `${basePath}/${item.path}` : basePath;
  return item.query ? `${path}?${item.query}` : path;
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "app-layout-badge"],
    queryFn: () => api.getNotifications(5),
    enabled: Boolean(user?.permissions.includes("notification:read")),
    refetchInterval: DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL,
  });

  const notifications = useMemo(() => notificationsData?.notifications ?? [], [notificationsData?.notifications]);
  const hasUnread = notifications.some((notification) => !notification.read);
  const isPendingVendor = user?.role === "vendor" && user.vendorStatus !== "approved";
  const basePath = user ? `/${user.role}` : "/";
  const currentPage = getPageIdentity(location.pathname);
  const experience = user ? getRoleExperience(user.role) : null;
  const workspaceTitle = experience?.workspaceTitle || "Workspace";
  const headerScope = user?.marketName || experience?.scopeFallback || "No market assigned";
  const profilePath = `${basePath}/profile`;

  const filteredGroups = useMemo(() => {
    if (!user) return [];
    return roleNavGroups[user.role]
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!isPendingVendor) return true;
          return item.path === "" || item.path === "profile" || item.path === "notifications";
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [isPendingVendor, user]);
  const visibleNavItems = useMemo(() => filteredGroups.flatMap((group) => group.items), [filteredGroups]);

  const initials =
    user?.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  useEffect(() => {
    const pageLabel = currentPage.shortLabel;
    document.title = pageLabel && pageLabel !== "Workspace" ? `${pageLabel} - ${workspaceTitle}` : workspaceTitle;
  }, [currentPage.shortLabel, workspaceTitle]);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  const openProfileTab = (tab?: string) => {
    navigate(`${profilePath}${tab ? `?tab=${tab}` : ""}`);
  };

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  const submitSearch = () => {
    const value = headerSearch.trim();
    if (!value) return;
    const params = new URLSearchParams(location.search);
    params.set("q", value);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  return (
    <div className={cn("flex h-screen overflow-hidden bg-[#F7F8FA]", `app-role-${user.role}`)}>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "lg:w-[76px]" : "lg:w-[264px]",
        )}
      >
        <div className="flex h-[73px] shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <div className={cn("min-w-0 flex-1", sidebarCollapsed && "lg:hidden")}>
            <p className="truncate text-lg font-semibold leading-tight font-heading">MMS</p>
            <p className="truncate text-xs text-muted-foreground">Market Management System</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {filteredGroups.map((group) => (
            <div key={group.title} className="mb-6 last:mb-0">
              <p className={cn("mb-2 px-2 text-[11px] font-semibold uppercase text-muted-foreground", sidebarCollapsed && "lg:hidden")}>
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const navIdentity = getNavigationIdentity(user.role, item.path);
                  const Icon = item.icon;
                  const itemQuery = item.query ? new URLSearchParams(item.query).toString() : "";
                  const currentQuery = new URLSearchParams(location.search).toString();
                  const hasActiveQueryPeer = !item.query && visibleNavItems.some((peer) => (
                    peer.path === item.path &&
                    Boolean(peer.query) &&
                    new URLSearchParams(peer.query || "").toString() === currentQuery
                  ));

                  return (
                    <NavLink
                      key={`${group.title}-${item.label}-${item.query || ""}`}
                      to={getNavTarget(basePath, item)}
                      end={item.path === ""}
                      title={sidebarCollapsed ? item.label : undefined}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => {
                        const active = item.query ? isActive && currentQuery === itemQuery : isActive && !hasActiveQueryPeer;

                        return cn(
                          "workspace-nav-link relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          `nav-accent-${navIdentity.accent}`,
                          sidebarCollapsed && "lg:justify-center lg:px-0",
                          active
                            ? "is-active text-foreground"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                        );
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => openProfileTab()}
            className={cn(
              "mb-2 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
              sidebarCollapsed && "lg:justify-center lg:px-0",
            )}
          >
            <Avatar className="h-9 w-9 border border-border">
              {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">{initials}</AvatarFallback>
            </Avatar>
            <span className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{roleDescriptions[user.role]}</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className={cn("h-9 flex-1 justify-start gap-2 px-2 text-muted-foreground hover:text-foreground", sidebarCollapsed && "lg:justify-center")}
              onClick={() => setSidebarCollapsed((value) => !value)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              <span className={cn(sidebarCollapsed && "lg:hidden")}>{sidebarCollapsed ? "Expand" : "Collapse"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-[73px] shrink-0 items-center gap-3 border-b border-border/80 bg-white/86 px-4 backdrop-blur-xl lg:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden w-full max-w-[420px] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search workspace"
              placeholder="Search anything..."
              value={headerSearch}
              onChange={(event) => setHeaderSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
                if (event.key === "Escape") setHeaderSearch("");
              }}
              className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground lg:inline-flex">
              Ctrl K
            </span>
          </div>

          <div className="min-w-0 flex-1 md:hidden">
            <p className="truncate text-sm font-semibold font-heading">{currentPage.shortLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{headerScope}</p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden h-10 gap-2 rounded-lg border-border bg-white px-3 text-sm font-medium text-slate-700 shadow-none lg:inline-flex">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="max-w-[180px] truncate">{headerScope}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <DropdownMenuLabel className="p-2 text-xs text-muted-foreground">Market scope</DropdownMenuLabel>
                <DropdownMenuItem className="gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{headerScope}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Scope is controlled by your role permissions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="role-badge hidden h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-slate-700 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-[var(--role-accent)]" />
              {roleLabels[user.role]}
            </span>

            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => {
                if (!isPendingVendor) {
                  openProfileTab("notifications");
                }
              }}
              disabled={isPendingVendor}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Bell className="h-4 w-4" />
              {hasUnread && !isPendingVendor && (
                <span className="absolute right-2 top-2 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>

            <button
              type="button"
              aria-label="Help"
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground sm:flex"
              onClick={() => openProfileTab("security")}
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-1.5 pr-2 text-left transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-8 w-8 border border-border">
                    {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                    <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[150px] truncate text-sm font-semibold sm:block">{user.name}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <DropdownMenuLabel className="p-2">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                      <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold font-heading">{user.name}</p>
                      <p className="text-xs font-medium text-muted-foreground">{roleLabels[user.role]} - {headerScope}</p>
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

        <main
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F7F8FA]"
          aria-hidden={sidebarOpen ? true : undefined}
        >
          <div className="app-content-stack mx-auto flex min-h-full w-full max-w-[1480px] flex-col px-4 py-5 sm:px-6 lg:px-8">
            <Outlet />
            <footer className="enterprise-footer" aria-label="Workspace status">
              <div className="enterprise-footer-left">
                <span>MMS v1.0.0</span>
                <span>{roleLabels[user.role]} workspace</span>
                <span>{headerScope}</span>
              </div>
              <div className="enterprise-footer-right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  All systems operational
                </span>
                <button type="button" onClick={() => openProfileTab("notifications")}>Support</button>
                <button type="button" onClick={() => openProfileTab("security")}>Security</button>
                <span>(c) 2026 Kampala Capital City Authority</span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
