/**
 * AppLayout - Root layout shell that renders the TopBar, Sidebar, and main content
 * area via <Outlet /> for all authenticated pages. Handles role-based navigation,
 * notifications badge, pending-vendor restrictions, profile image loading, and
 * dynamic document title.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { getPageIdentity } from "@/config/pageIdentity";
import { getRoleExperience } from "@/config/roleExperience";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { roleNavGroups } from "@/components/layout/navigation";

const AppLayout = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "app-layout-badge"],
    queryFn: () => api.getNotifications(5),
    enabled: Boolean(user?.permissions?.includes("notification:read")),
    refetchInterval: DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL,
  });

  const notifications = useMemo(() => notificationsData?.notifications ?? [], [notificationsData?.notifications]);
  const hasUnread = notifications.some((notification) => !notification.read);
  const isPendingVendor = user?.role === "vendor" && user.vendorStatus !== "approved";
  const basePath = user ? `/${user.role}` : "/";
  const currentPage = getPageIdentity(location.pathname);
  const experience = user ? getRoleExperience(user.role) : null;
  const workspaceTitle = experience?.workspaceTitle || t("layout:workspace");

  // Exclude "Account" group (shown in top-bar dropdown) and restrict nav for
  // unapproved vendors to only dashboard / profile / notifications.
  const filteredGroups = useMemo(() => {
    if (!user) return [];
    return roleNavGroups[user.role]
      .filter((group) => group.title !== "nav:groups.account")
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!isPendingVendor) return true;
          return item.path === "" || item.path === "profile" || item.path === "notifications";
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [isPendingVendor, user]);

  useEffect(() => {
    const pageLabel = currentPage.shortLabel;
    document.title = pageLabel && pageLabel !== "Workspace" ? `${pageLabel} - ${workspaceTitle}` : workspaceTitle;
  }, [currentPage.shortLabel, workspaceTitle]);

  // Fetch the user's profile image as a blob URL on mount / id change.
  // Cleans up by revoking the object URL to avoid memory leaks.
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

  const openProfileTab = (tab?: string) => navigate(`${basePath}/profile${tab ? `?tab=${tab}` : ""}`);
  const openSettingsTab = (section?: string) => navigate(`${basePath}/settings${section ? `?section=${section}` : ""}`);
  const signOut = async () => { await logout(); navigate("/login"); };

  return (
    <div className={cn("h-dvh overflow-hidden bg-[#F8F9FA]", `app-role-${user.role}`)}>
      {/* Skip-to-content link for keyboard/assistive-tech users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-skip-link focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-emerald-700 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {t("layout:skipToContent")}
      </a>

      <TopBar
        workspaceTitle={workspaceTitle}
        scope={user?.marketName || experience?.scopeFallback || ""}
        user={user}
        profileImageUrl={profileImageUrl}
        onOpenSidebar={() => setSidebarOpen(true)}
        openProfileTab={() => openProfileTab()}
        openSettingsTab={openSettingsTab}
        signOut={signOut}
      />

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        basePath={basePath}
        filteredGroups={filteredGroups}
        hasUnread={hasUnread}
      />

      <main id="main-content" className="fixed bottom-0 left-0 right-0 top-[72px] overflow-hidden lg:left-[264px]">
        <div className="mms-main-scroll h-full overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
