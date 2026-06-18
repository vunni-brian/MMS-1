import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, CreditCard, LayoutDashboard, LogOut, MessageSquare, Store, UserCircle, Settings, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
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

const iconMap: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Store, CreditCard, MessageSquare, Bell, Settings, UserCircle,
};

const NavLinkItem = ({
  item, basePath, userRole, location, onNavigate, notificationCount,
}: {
  item: NavItem; basePath: string; userRole: string; location: ReturnType<typeof useLocation>;
  onNavigate: () => void; notificationCount?: number;
}) => {
  const navIdentity = getNavigationIdentity(userRole, item.path);
  const Icon = iconMap[item.icon.name] || LayoutDashboard;
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
  const isNotifications = item.path === "notifications";

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
        {isNotifications && notificationCount !== undefined && notificationCount > 0 && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EF476F] px-1.5 text-[11px] font-semibold text-white">
            {notificationCount}
          </span>
        )}
      </div>
    </NavLink>
  );
};

const overviewIconKeys = ["LayoutDashboard", "Store", "CreditCard", "MessageSquare", "Bell"];
const accountIconKeys = ["Settings", "UserCircle"];

export const Sidebar = ({
  user, sidebarOpen, setSidebarOpen, profileImageUrl, basePath, allNavItems, filteredGroups, openProfileTab, signOut,
}: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const initials = getInitials(user.name);
  const notificationCount = 3;

  const overviewItems = filteredGroups.flatMap((g) => g.items).filter(
    (item) => overviewIconKeys.includes(item.icon.name),
  );
  const accountItems = filteredGroups.flatMap((g) => g.items).filter(
    (item) => accountIconKeys.includes(item.icon.name),
  );

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F5E3F] text-lg text-white shadow-sm">
            🏛
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight text-[#111827]">MMS</span>
            <span className="text-[11px] leading-tight text-[#9CA3AF]">Market Management System</span>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F8F9FA] hover:text-[#111827] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Box */}
        <div className="px-4 pb-4 pt-1">
          <div className="flex h-[42px] items-center gap-2.5 rounded-xl bg-[#F7F8FA] px-3.5 text-sm text-[#9CA3AF] transition-colors focus-within:text-[#6B7280]">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="text"
              placeholder={t("common:search") || "Search workspace..."}
              className="flex-1 bg-transparent text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-2">
          {/* OVERVIEW Section */}
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              {t("nav:groups.main") || "OVERVIEW"}
            </p>
            <div className="space-y-0.5">
              {overviewItems.map((item) => (
                <NavLinkItem
                  key={`overview-${item.label}-${item.query || ""}`}
                  item={item}
                  basePath={basePath}
                  userRole={user.role}
                  location={location}
                  onNavigate={() => setSidebarOpen(false)}
                  notificationCount={item.path === "notifications" ? notificationCount : undefined}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#F1F3F5]" />

          {/* ACCOUNT Section */}
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              {t("nav:groups.account") || "ACCOUNT"}
            </p>
            <div className="space-y-0.5">
              {accountItems.map((item) => (
                <NavLinkItem
                  key={`account-${item.label}-${item.query || ""}"`}
                  item={item}
                  basePath={basePath}
                  userRole={user.role}
                  location={location}
                  onNavigate={() => setSidebarOpen(false)}
                />
              ))}
            </div>
          </div>
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
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-semibold text-[#111827]">{user.name}</span>
              <span className="text-[11px] text-[#9CA3AF]">{t("common:vendorId") || `Vendor ID: VDR-${new Date().getFullYear()}-${String(user.id).padStart(3, "0")}`}</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); signOut(); }}
              aria-label={t("nav:signOut")}
              className="ml-auto rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F8F9FA] hover:text-[#EF476F]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2">
          <p className="text-[11px] text-[#9CA3AF]">© 2026 Kampala Capital City Authority</p>
        </div>
      </aside>
    </>
  );
};
