import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { getPageBreadcrumbs, getPageIdentity } from "@/config/pageIdentity";
import { getRoleExperience } from "@/config/roleExperience";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CommandMenu } from "@/components/CommandMenu";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { roleNavGroups } from "@/components/layout/navigation";

const AppLayout = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
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
  const breadcrumbs = useMemo(() => getPageBreadcrumbs(location.pathname), [location.pathname]);
  const experience = user ? getRoleExperience(user.role) : null;
  const workspaceTitle = experience?.workspaceTitle || t("layout:workspace");
  const headerScope = user?.marketName || experience?.scopeFallback || t("common:noMarketAssigned");
  const profilePath = `${basePath}/profile`;
  const settingsPath = `${basePath}/settings`;

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

  const allNavItems = useMemo(() => filteredGroups.flatMap((group) => group.items), [filteredGroups]);

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
    if (!user?.profileImage) return;

    api
      .getUserProfileImageUrl(user.id)
      .then((url) => {
        objectUrl = url;
        if (isActive) setProfileImageUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => { if (isActive) setProfileImageUrl(null); });

    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, user?.profileImage]);

  if (!user) return <LoadingAnimation label={t("layout:loadingWorkspace")} />;

  const openProfileTab = (tab?: string) => navigate(`${profilePath}${tab ? `?tab=${tab}` : ""}`);
  const openSettingsTab = (section?: string) => navigate(`${settingsPath}${section ? `?section=${section}` : ""}`);
  const signOut = async () => { await logout(); navigate("/login"); };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
      <TopBar workspaceTitle={workspaceTitle} />

      <div className={cn("flex flex-1 overflow-hidden", `app-role-${user.role}`)}>
        <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
        <Sidebar
          user={user}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          profileImageUrl={profileImageUrl}
          basePath={basePath}
          allNavItems={allNavItems}
          filteredGroups={filteredGroups}
          openProfileTab={() => openProfileTab()}
          signOut={signOut}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader
            user={user}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            profileImageUrl={profileImageUrl}
            breadcrumbs={breadcrumbs}
            currentPageLabel={currentPage.description || ""}
            headerScope={headerScope}
            isPendingVendor={isPendingVendor}
            hasUnread={hasUnread}
            basePath={basePath}
            openProfileTab={openProfileTab}
            openSettingsTab={openSettingsTab}
            signOut={signOut}
            onOpenCommandMenu={() => setCommandMenuOpen(true)}
          />

          <main
            className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-50"
            aria-hidden={sidebarOpen ? true : undefined}
          >
            <div className="app-content-stack mx-auto flex min-h-full w-full max-w-[1360px] flex-col px-4 py-6 sm:px-6">
              <div className="flex-1 flex flex-col">
                <Outlet />
              </div>
              <AppFooter user={user} headerScope={headerScope} openSettingsTab={openSettingsTab} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
