import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

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
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading session...</div>;
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
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading session...</div>;
  }

  if (user?.role === "vendor" && user.vendorStatus !== "approved") {
    return <Navigate to="/vendor" replace state={{ approvalRequired: true }} />;
  }

  return <>{children}</>;
};
