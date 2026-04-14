import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Store, LayoutDashboard, Grid3X3, CreditCard, Bell, MessageSquare,
  BarChart3, ScrollText, Users, LogOut, Menu, X, Settings, MessagesSquare
} from "lucide-react";

import type { Role } from "@/types";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '', icon: LayoutDashboard, roles: ['vendor', 'manager', 'official'] },
  { label: 'Stalls', path: 'stalls', icon: Grid3X3, roles: ['vendor', 'manager'] },
  { label: 'Payments', path: 'payments', icon: CreditCard, roles: ['vendor', 'manager'] },
  { label: 'Notifications', path: 'notifications', icon: Bell, roles: ['vendor'] },
  { label: 'Complaints', path: 'complaints', icon: MessageSquare, roles: ['vendor', 'manager'] },
  { label: 'Vendors', path: 'vendors', icon: Users, roles: ['manager'] },
  { label: 'Reports', path: 'reports', icon: BarChart3, roles: ['manager', 'official'] },
  { label: 'Audit Log', path: 'audit', icon: ScrollText, roles: ['manager', 'official'] },
  { label: 'Coordination', path: 'coordination', icon: MessagesSquare, roles: ['manager', 'official'] },
  { label: 'Profile', path: 'profile', icon: Settings, roles: ['vendor'] },
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading workspace...</div>;
  }

  const filtered = navItems.filter(n => n.roles.includes(user.role));
  const basePath = `/${user.role}`;

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
            <p className="font-heading font-bold text-sm truncate text-sidebar-foreground">Market Manager</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user.name}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate mt-0.5">
              {user.marketName || (user.role === "official" ? "All markets oversight" : "Unassigned market")}
            </p>
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
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
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
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
              {user.marketName || (user.role === "official" ? "All Markets" : "No Market")}
            </span>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full capitalize">{user.role}</span>
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
