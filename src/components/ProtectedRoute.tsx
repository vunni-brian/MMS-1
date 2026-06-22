/**
 * ProtectedRoute - Guards child routes behind authentication and role checks.
 * Redirects unauthenticated users to /login and unauthorized users to their
 * role home.
 *
 * VendorApprovalGuard - Ensures approved vendors only; redirects unapproved
 * vendors to the vendor landing page.
 *
 * RoleRoute - Redirects users to their settings if they lack one of the
 * allowed roles, without showing a loading state.
 */
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useTranslation } from "react-i18next";

import { LoadingAnimation } from "@/components/LoadingAnimation";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types";

export const ProtectedRoute = ({
 children,
 allowedRoles,
}: {
 children: ReactNode;
 allowedRoles: Role[];
}) => {
 const { t } = useTranslation();
 const { user, isLoading } = useAuth();
 const location = useLocation();

  // Only show the full-screen loader during initial session restore (no user
  // available yet). Once a user object exists, redirect instantly without flash.
  if (isLoading && !user) {
 return <LoadingAnimation label={t("layout:loadingSession")} />;
 }

 if (!user) {
 return <Navigate to="/login" replace state={{ from: location.pathname }} />;
 }

 if (!allowedRoles.includes(user.role)) {
 return <Navigate to={`/${user.role}`} replace />;
 }

 return <>{children}</>;
};

export const VendorApprovalGuard = ({ children }: { children: ReactNode }) => {
 const { t } = useTranslation();
 const { user, isLoading } = useAuth();

 if (isLoading && !user) {
 return <LoadingAnimation label={t("layout:loadingSession")} />;
 }

 if (user?.role === "vendor" && user.vendorStatus !== "approved") {
 return <Navigate to="/vendor" replace state={{ approvalRequired: true }} />;
 }

 return <>{children}</>;
};

export const RoleRoute = ({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) => {
 const { user } = useAuth();

 if (user && !allowedRoles.includes(user.role)) {
 return <Navigate to={`/${user.role}/settings`} replace />;
 }

 return <>{children}</>;
};
