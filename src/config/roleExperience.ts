/**
 * Role-specific experience configuration.
 * Defines workspace titles, scope fallbacks, and quick-action shortcuts per role.
 */
import type { Role } from "@/types";

/** Per-role experience metadata for navigation, headers, and quick actions. */
interface RoleExperience {
  /** Title displayed for the role's workspace. */
  workspaceTitle: string;
  /** Fallback text describing the role's operational scope. */
  scopeFallback: string;
  /** Path to the role's primary quick action. */
  quickActionPath: string;
  /** Label for the quick-action button/link. */
  quickActionLabel: string;
}

/** Maps each role to its experience configuration. */
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

/**
 * Returns the experience configuration for the given role.
 * @param role - The role to look up.
 * @returns The RoleExperience object for that role.
 */
export const getRoleExperience = (role: Role) => roleExperience[role];
