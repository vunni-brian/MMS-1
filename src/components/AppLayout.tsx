import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Store, LayoutDashboard, Grid3X3, CreditCard, Bell, MessageSquare,
  BarChart3, ScrollText, Users, LogOut, Menu, X, Settings, MessagesSquare, SlidersHorizontal, ChevronDown, KeyRound, PhoneCall, UserCircle
} from "lucide-react";

import type { Role } from "@/types";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '', icon: LayoutDashboard, roles: ['vendor', 'manager', 'official', 'admin'] },
  { label: 'Stalls', path: 'stalls', icon: Grid3X3, roles: ['vendor', 'manager'] },
  { label: 'Payments', path: 'payments', icon: CreditCard, roles: ['vendor', 'manager'] },
  { label: 'Notifications', path: 'notifications', icon: Bell, roles: ['vendor'] },
  { label: 'Complaints', path: 'complaints', icon: MessageSquare, roles: ['vendor', 'manager'] },
  { label: 'Vendors', path: 'vendors', icon: Users, roles: ['manager'] },
  { label: 'Billing', path: 'billing', icon: SlidersHorizontal, roles: ['manager', 'official', 'admin'] },
  { label: 'Reports', path: 'reports', icon: BarChart3, roles: ['manager', 'official', 'admin'] },
  { label: 'Audit Log', path: 'audit', icon: ScrollText, roles: ['manager', 'official', 'admin'] },
  { label: 'Coordination', path: 'coordination', icon: MessagesSquare, roles: ['manager', 'official', 'admin'] },
  { label: 'Profile', path: 'profile', icon: Settings, roles: ['vendor'] },
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading workspace...</div>;
  }

  const filtered = navItems.filter(n => n.roles.includes(user.role));
  const basePath = `/${user.role}`;
  const workspaceTitle =
    user.role === "admin"
      ? "System Admin"
      : user.role === "official"
        ? "Market Oversight"
        : user.role === "vendor"
          ? "Vendor Workspace"
          : "Market Manager";
  const workspaceScope =
    user.marketName ||
    (user.role === "admin"
      ? "System-wide control"
      : user.role === "official"
        ? "All markets oversight"
        : "Unassigned market");
  const headerScope =
    user.marketName ||
    (user.role === "admin"
      ? "All Markets Admin"
      : user.role === "official"
        ? "All Markets Oversight"
        : "No Market");
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Store className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm truncate text-sidebar-foreground">{workspaceTitle}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user.name}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate mt-0.5">{workspaceScope}</p>
          </div>
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filtered.map(item => (
            <NavLink
              key={item.path}
              to={`${basePath}/${item.path}`}
              end={item.path === ''}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-card">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{headerScope}</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((current) => !current)}
                className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-muted/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserCircle className="h-5 w-5" />
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-[160px] truncate text-sm font-semibold">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">{roleLabel}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border/70 bg-card p-3 shadow-xl">
                  <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserCircle className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold font-heading">{user.name}</p>
                      <p className="text-xs font-medium text-primary">{roleLabel}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="my-2 border-t border-border/70" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(user.role === "vendor" ? `${basePath}/profile` : basePath);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  >
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </button>
                  <a
                    href="tel:+256700000000"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Emergency Contact
                  </a>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
