import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

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
 const { user, isLoading } = useAuth();
 const location = useLocation();

 // Only block on the very first session restore (no user yet and still loading).
 // Once a user is known, navigate immediately without a loading flash.
 if (isLoading && !user) {
 return <LoadingAnimation label="Loading your secure session…" />;
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
 const { user, isLoading } = useAuth();

 if (isLoading && !user) {
 return <LoadingAnimation label="Loading your secure session…" />;
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
