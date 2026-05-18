import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronDown,
  CreditCard,
  Grid3X3,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  ScrollText,
  SlidersHorizontal,
  Store,
  UserCircle,
  Users,
  X,
} from "lucide-react";

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
  icon: React.ElementType;
  roles: Role[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Workbench",
    items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard, roles: ["vendor", "manager", "official", "admin"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Stalls", path: "stalls", icon: Grid3X3, roles: ["vendor", "manager"] },
      { label: "Vendors", path: "vendors", icon: Users, roles: ["manager"] },
      { label: "Payments", path: "payments", icon: CreditCard, roles: ["vendor", "manager"] },
      { label: "Complaints", path: "complaints", icon: MessageSquare, roles: ["vendor", "manager"] },
      { label: "Billing", path: "billing", icon: SlidersHorizontal, roles: ["manager", "official", "admin"] },
    ],
  },
  {
    title: "Oversight",
    items: [
      { label: "Requests", path: "coordination", icon: MessagesSquare, roles: ["manager", "official"] },
      { label: "Reports", path: "reports", icon: BarChart3, roles: ["manager", "official"] },
      { label: "Audit Log", path: "audit", icon: ScrollText, roles: ["manager", "official", "admin"] },
    ],
  },
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "app-layout-badge"],
    queryFn: () => api.getNotifications(5),
    enabled: user?.role === "vendor",
    refetchInterval: 30000,
  });

  const hasUnread = notificationsData?.notifications?.some((notification) => !notification.read) || false;
  const isPendingVendor = user?.role === "vendor" && user.vendorStatus !== "approved";
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!user) {
          return false;
        }
        if (!item.roles.includes(user.role)) {
          return false;
        }
        if (isPendingVendor) {
          return item.path === "";
        }
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
  const basePath = user ? `/${user.role}` : "/";
  const workspaceTitle =
    user?.role === "admin"
      ? "System Admin"
      : user?.role === "official"
        ? "Market Oversight"
        : user?.role === "vendor"
          ? "Vendor Workspace"
          : "Market Manager";
  const headerScope =
    user?.marketName ||
    (user?.role === "admin"
      ? "All Markets Admin"
      : user?.role === "official"
        ? "All Markets Oversight"
        : "No Market");
  const roleLabel = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "";
  const profilePath = `${basePath}/profile`;
  const initials =
    user?.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

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
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/45 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 shadow-md lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/60">
            <Store className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm truncate text-sidebar-foreground">{workspaceTitle}</p>
            <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/60">{headerScope}</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-md p-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {filteredGroups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={`${basePath}/${item.path}`}
                    end={item.path === ""}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold before:absolute before:left-1 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
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
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border/70 bg-card/95 px-3 py-2.5 lg:gap-3 lg:px-5">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-md p-1 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col px-1 sm:px-3">
            <span className="truncate text-sm font-semibold text-foreground">{workspaceTitle}</span>
            <span className="truncate text-xs text-muted-foreground">{headerScope}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => {
                if (!isPendingVendor) {
                  openProfileTab("notifications");
                }
              }}
              disabled={isPendingVendor}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Bell className="h-4 w-4" />
              {user.role === "vendor" && hasUnread && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent border-2 border-background" />
              )}
            </button>
            <div className="h-7 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 items-center gap-2 rounded-full bg-background px-1.5 pr-2 text-left transition-colors hover:bg-muted/45"
                >
                  <Avatar className="h-7 w-7 border border-border/70">
                    {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                    <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[130px] truncate text-sm font-semibold sm:block">{user.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <DropdownMenuLabel className="p-2">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 border border-border/70">
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
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 lg:px-5">
          <div className="flex min-h-full flex-col">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
