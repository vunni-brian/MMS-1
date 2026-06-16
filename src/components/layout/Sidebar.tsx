import { NavLink, useLocation } from "react-router-dom";
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { getNavigationIdentity } from "@/config/pageIdentity";
import { roleDescriptions, getNavTarget, getInitials } from "./navigation";
import type { NavItem, NavGroup } from "./navigation";
import type { User } from "@/types";

interface SidebarProps {
  user: User;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  profileImageUrl: string | null;
  basePath: string;
  allNavItems: NavItem[];
  filteredGroups: NavGroup[];
  openProfileTab: () => void;
  signOut: () => void;
}

const NavLinkItem = ({
  item, basePath, location, sidebarCollapsed, allNavItems, onNavigate,
}: {
  item: NavItem; basePath: string; userRole: string; location: ReturnType<typeof useLocation>;
  sidebarCollapsed: boolean; allNavItems: NavItem[]; onNavigate: () => void;
}) => {
  const navIdentity = getNavigationIdentity(userRole, item.path);
  const Icon = item.icon;
  const target = getNavTarget(basePath, item);
  const targetPath = target.split("?")[0];
  const itemQuery = item.query ? new URLSearchParams(item.query).toString() : "";
  const currentQuery = new URLSearchParams(location.search).toString();
  const hasActiveQueryPeer = !item.query && allNavItems.some(
    (peer) => peer.path === item.path && Boolean(peer.query) && new URLSearchParams(peer.query || "").toString() === currentQuery,
  );
  const currentPath = location.pathname.replace(/\/$/, "") || "/";
  const normalizedTargetPath = targetPath.replace(/\/$/, "") || "/";
  const routeActive = item.path === ""
    ? currentPath === normalizedTargetPath
    : currentPath === normalizedTargetPath || currentPath.startsWith(`${normalizedTargetPath}/`);
  const active = item.query ? routeActive && currentQuery === itemQuery : routeActive && !hasActiveQueryPeer;

  return (
    <NavLink
      to={target}
      end={item.path === ""}
      title={sidebarCollapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        "workspace-nav-link relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        `nav-accent-${navIdentity?.accent || "default"}`,
        sidebarCollapsed && "lg:justify-center lg:px-0",
        active
          ? "is-active bg-gradient-to-r from-white/20 to-white/5 text-white shadow-lg"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>{item.label}</span>
      {active && !sidebarCollapsed && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-sm" />}
    </NavLink>
  );
};

export const Sidebar = ({
  user, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed,
  profileImageUrl, basePath, allNavItems, filteredGroups, openProfileTab, signOut,
}: SidebarProps) => {
  const location = useLocation();
  const initials = getInitials(user.name);

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "mms-sidebar fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-sidebar-border/20 bg-gradient-to-b from-sidebar to-sidebar/95 text-sidebar-foreground transition-[width,transform] duration-300 ease-out lg:static lg:translate-x-0 shadow-xl",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-[288px]",
        )}
      >
        <div className="mms-sidebar-brand flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border/20 px-4 bg-gradient-to-r from-sidebar/50 to-transparent">
          <BrandLogo variant="sidebar" size="lg" showText={!sidebarCollapsed} showTagline={!sidebarCollapsed} showStatusDot />
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 text-white/60 transition-all hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mms-sidebar-nav flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {filteredGroups.map((group) => (
            <div key={group.title} className="mms-sidebar-group last:mb-0">
              <p className={cn("mms-sidebar-label mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-white/40", sidebarCollapsed && "lg:hidden")}>
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLinkItem
                    key={`${group.title}-${item.label}-${item.query || ""}`}
                    item={item}
                    basePath={basePath}
                    userRole={user.role}
                    location={location}
                    sidebarCollapsed={sidebarCollapsed}
                    allNavItems={allNavItems}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mms-sidebar-footer border-t border-sidebar-border/20 p-4 space-y-3">
          <button
            type="button"
            onClick={() => openProfileTab()}
            aria-label="Open profile settings"
            className={cn("mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/10", sidebarCollapsed && "lg:justify-center lg:px-0")}
          >
            <Avatar className="h-8 w-8 border-2 border-white/20">
              {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
              <AvatarFallback className="bg-white/20 text-xs font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <span className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
              <span className="block truncate text-xs font-medium text-white/90">{user.name}</span>
              <span className="block truncate text-[10px] text-white/50">{roleDescriptions[user.role]}</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className={cn("h-9 flex-1 justify-start gap-2 rounded-lg px-3 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white", sidebarCollapsed && "lg:justify-center")}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              <span className={cn(sidebarCollapsed && "lg:hidden")}>{sidebarCollapsed ? "Expand" : "Collapse"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
