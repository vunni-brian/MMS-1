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
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
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
    enabled: Boolean(user?.permissions.includes("notification:read")),
    refetchInterval: DASHBOARD_CONFIG.NOTIFICATIONS_REFRESH_INTERVAL,
  });

  const notifications = useMemo(() => notificationsData?.notifications ?? [], [notificationsData?.notifications]);
  const hasUnread = notifications.some((notification) => !notification.read);
  const isPendingVendor = user?.role === "vendor" && user.vendorStatus !== "approved";
  const basePath = user ? `/${user.role}` : "/";
  const currentPage = getPageIdentity(location.pathname);
  const experience = user ? getRoleExperience(user.role) : null;
  const workspaceTitle = experience?.workspaceTitle || t("layout:workspace");

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

  useEffect(() => {
    const pageLabel = currentPage.shortLabel;
    document.title = pageLabel && pageLabel !== "Workspace" ? `${pageLabel} - ${workspaceTitle}` : workspaceTitle;
  }, [currentPage.shortLabel, workspaceTitle]);

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
    <div className={cn("flex h-screen flex-col overflow-hidden bg-[#F8F9FA]", `app-role-${user.role}`)}>
      <TopBar workspaceTitle={workspaceTitle} scope={user?.marketName || experience?.scopeFallback || ""} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          user={user}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          profileImageUrl={profileImageUrl}
          basePath={basePath}
          filteredGroups={filteredGroups}
          hasUnread={hasUnread}
          openProfileTab={() => openProfileTab()}
          openSettingsTab={openSettingsTab}
          signOut={signOut}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-6 py-6 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
