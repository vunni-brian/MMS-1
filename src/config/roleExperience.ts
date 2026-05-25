import type { Role } from "@/types";

interface RoleExperience {
  workspaceTitle: string;
  scopeFallback: string;
  quickActionPath: string;
  quickActionLabel: string;
}

// Keep role language in one place so navigation, headers, and quick actions stay consistent.
export const roleExperience: Record<Role, RoleExperience> = {
  admin: {
    workspaceTitle: "Control Center",
    scopeFallback: "System administration",
    quickActionPath: "/admin/alerts",
    quickActionLabel: "Review Alerts",
  },
  manager: {
    workspaceTitle: "Manager Workspace",
    scopeFallback: "Market operations",
    quickActionPath: "/manager/vendors",
    quickActionLabel: "Review Queue",
  },
  official: {
    workspaceTitle: "Official Workspace",
    scopeFallback: "Regional monitoring",
    quickActionPath: "/official/coordination",
    quickActionLabel: "Review Requests",
  },
  vendor: {
    workspaceTitle: "Vendor Workspace",
    scopeFallback: "Daily stall operations",
    quickActionPath: "/vendor/payments",
    quickActionLabel: "Pay Dues",
  },
};

export const getRoleExperience = (role: Role) => roleExperience[role];
