/**
 * Sidebar - Collapsible sidebar navigation panel. Displays role-filtered nav
 * groups, an unread-notification badge, and a system-health indicator footer.
 */
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getNavTarget } from "./navigation";
import type { NavItem, NavGroup } from "./navigation";

/** Props for the Sidebar component. */
interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  basePath: string;
  filteredGroups: NavGroup[];
  hasUnread: boolean;
}

/**
 * NavLinkItem - Renders a single sidebar link with active-state detection,
 * route matching (including query-string awareness), and an unread badge
 * for the notifications item.
 */
const NavLinkItem = ({
  item,
  basePath,
  location,
  hasUnread,
  onNavigate,
}: {
  item: NavItem;
  basePath: string;
  location: ReturnType<typeof useLocation>;
  hasUnread: boolean;
  onNavigate: () => void;
}) => {
  const { t } = useTranslation();
  const Icon = item.icon;
  // Normalise both the target and current path for active-state comparison.
  // If the item has a query string, both path and query must match exactly.
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
  const isNotifications = item.label === "nav:items.notifications";

  return (
    <NavLink
      to={target}
      end={item.path === ""}
      onClick={onNavigate}
      className={cn(
        "workspace-nav-link relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
        active && "is-active",
      )}
    >
      <span className="workspace-nav-marker" />
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
      {isNotifications && hasUnread && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF476F] px-1 text-white">
          <Bell className="h-3 w-3" />
        </span>
      )}
    </NavLink>
  );
};

/**
 * Sidebar - Main sidebar layout component with role-based nav groups, mobile
 * overlay, and a system-health footer.
 */
export const Sidebar = ({
  sidebarOpen,
  setSidebarOpen,
  basePath,
  filteredGroups,
  hasUnread,
}: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();

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
          aria-label={t("layout:closeNavigation")}
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "mms-sidebar fixed inset-y-0 left-0 top-[72px] z-[60] flex w-[264px] flex-col border-r shadow-xl transition-transform duration-300 ease-out lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="mms-sidebar-nav flex flex-1 flex-col gap-4 overflow-hidden px-3 py-4">
          <div className="flex items-center justify-end lg:hidden">
            <button
              type="button"
              aria-label={t("layout:closeNavigation")}
              className="rounded-lg p-1.5 text-[#71717A] transition-colors hover:bg-[#F8F9FA] hover:text-[#111827]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {filteredGroups.map((group) => (
            <div key={group.title} className="mms-sidebar-group">
              <p className="mms-sidebar-label mb-2 px-2 text-[11px] font-normal leading-tight text-[#71717A]">
                {t(group.title)}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLinkItem
                    key={`${group.title}-${item.label}-${item.query || ""}`}
                    item={item}
                    basePath={basePath}
                    location={location}
                    hasUnread={hasUnread}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mms-sidebar-footer shrink-0 border-t px-4 py-3">
          <div className="flex items-center gap-2">
            {systemOk ? (
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-[#EF476F]" />
            )}
            <span className={cn(
              "truncate text-[11px] font-medium",
              systemOk ? "text-[#10B981]" : "text-[#EF476F]",
            )}>
              {systemOk ? t("layout:allSystemsOperational") : t("layout:degradedPerformance")}
            </span>
          </div>
          <p className="mt-2 truncate text-[11px] text-[#71717A]">{t("layout:copyright", { year: 2026, name: "Kampala Capital City Authority" })}</p>
        </div>
      </aside>
    </>
  );
};
