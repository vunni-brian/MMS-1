import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Search, X, Bell, ShieldCheck, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getNavigationIdentity } from "@/config/pageIdentity";
import { getNavTarget, getInitials, roleLabels } from "./navigation";
import type { NavItem, NavGroup } from "./navigation";
import type { User } from "@/types";

interface SidebarProps {
  user: User;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  profileImageUrl: string | null;
  basePath: string;
  filteredGroups: NavGroup[];
  hasUnread: boolean;
  openProfileTab: () => void;
  openSettingsTab: (section?: string) => void;
  signOut: () => void;
}

const NavLinkItem = ({
  item, basePath, userRole, location, onNavigate,
}: {
  item: NavItem; basePath: string; userRole: string; location: ReturnType<typeof useLocation>;
  onNavigate: () => void;
}) => {
  const navIdentity = getNavigationIdentity(userRole, item.path);
  const Icon = item.icon;
  const target = getNavTarget(basePath, item);
  const targetPath = target.split("?")[0];
  const itemQuery = item.query ? new URLSearchParams(item.query).toString() : "";
  const currentQuery = new URLSearchParams(location.search).toString();
  const currentPath = location.pathname.replace(/\/$/, "") || "/";
  const normalizedTargetPath = targetPath.replace(/\/$/, "") || "/";
  const routeActive = item.path === ""
    ? currentPath === normalizedTargetPath
    : currentPath === normalizedTargetPath || currentPath.startsWith(`${normalizedTargetPath}/`);
  const active = item.query ? routeActive && currentQuery === itemQuery : routeActive;

  return (
    <NavLink
      to={target}
      end={item.path === ""}
      onClick={onNavigate}
      className="group relative block"
    >
      <div className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200",
        active
          ? "text-[#0F5E3F] font-semibold"
          : "text-[#374151] hover:bg-[#F8F9FA] hover:text-[#111827]",
      )}>
        {active && (
          <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#0F5E3F]" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0", active && "text-[#0F5E3F]")} />
        <span className="truncate">{item.label}</span>
        {item.label === "nav:items.notifications" && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EF476F] px-1.5 text-[11px] font-semibold text-white">
            <Bell className="h-3 w-3" />
          </span>
        )}
      </div>
    </NavLink>
  );
};

export const Sidebar = ({
  user, sidebarOpen, setSidebarOpen, profileImageUrl, basePath, filteredGroups,
  hasUnread, openProfileTab, openSettingsTab, signOut,
}: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const initials = getInitials(user.name);

  const systemHealthQuery = useQuery({
    queryKey: ["system-health", "sidebar"],
    queryFn: () => api.health(),
    refetchInterval: 60000,
    gcTime: 60000,
  });
  const systemOk = systemHealthQuery.data?.ok ?? true;

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-[#F0F2F5] bg-white shadow-sm transition-transform duration-300 ease-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand Area */}
        <div className="flex h-[72px] shrink-0 items-center gap-3 px-6 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F5E3F] text-base text-white shadow-sm font-bold">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight text-[#111827]">MMS</span>
            <span className="text-[11px] leading-tight text-[#71717A]">Market Management System</span>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1.5 text-[#71717A] transition-colors hover:bg-[#F8F9FA] hover:text-[#111827] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Box */}
        <div className="px-4 pb-4 pt-1">
          <div className="flex h-[42px] items-center gap-2.5 rounded-[10px] bg-[#F7F8FA] px-3.5 text-sm text-[#71717A] transition-colors focus-within:text-[#6B7280]">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="text"
              placeholder={t("common:search") || "Search workspace..."}
              className="flex-1 bg-transparent text-sm text-[#374151] outline-none placeholder:text-[#71717A]"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-8 overflow-y-auto px-4 py-2">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
                {t(group.title)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLinkItem
                    key={`${group.title}-${item.label}-${item.query || ""}`}
                    item={item}
                    basePath={basePath}
                    userRole={user.role}
                    location={location}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Profile Card */}
        <div className="border-t border-[#F1F3F5] px-4 pb-3 pt-4">
          <button
            type="button"
            onClick={() => openProfileTab()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#F8F9FA]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-sm font-bold text-[#0F5E3F]">
              {initials}
            </div>
            <div className="flex flex-col items-start text-left min-w-0">
              <span className="truncate text-sm font-semibold text-[#111827]">{user.name}</span>
              <span className="truncate text-[11px] text-[#71717A]">
                {roleLabels[user.role]}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); signOut(); }}
              aria-label={t("common:signOut") || "Sign out"}
              className="shrink-0 rounded-lg p-1.5 text-[#71717A] transition-colors hover:bg-[#F8F9FA] hover:text-[#EF476F]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2">
          <div className="flex items-center gap-2 mb-2">
            {systemOk ? (
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-[#EF476F]" />
            )}
            <span className={cn(
              "text-[11px] font-medium",
              systemOk ? "text-[#10B981]" : "text-[#EF476F]"
            )}>
              {systemOk ? "All Systems Operational" : "Degraded Performance"}
            </span>
          </div>
          <p className="text-[11px] text-[#71717A]">&copy; 2026 Kampala Capital City Authority</p>
        </div>
      </aside>
    </>
  );
};
