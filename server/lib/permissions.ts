/**
 * @file Role-based permission definitions.
 * Maps every `Role` to its set of `Permission` strings and exposes a simple
 * `hasPermission` check.
 */

import type { Permission, Role } from "../types.ts";

export const rolePermissions: Record<Role, Permission[]> = {
  vendor: [
    "stall:read",
    "booking:read",
    "booking:create",
    "payment:read",
    "payment:create",
    "utility:read",
    "penalty:read",
    "notification:read",
    "notification:update",
    "announcement:read",
    "ticket:read",
    "ticket:create",
  ],
  manager: [
    "billing:read",
    "utility:read",
    "utility:manage",
    "penalty:read",
    "vendor:read",
    "vendor:review",
    "coordination:read",
    "coordination:write",
    "resource:read",
    "resource:create",
    "stall:read",
    "stall:write",
    "booking:read",
    "booking:update",
    "payment:read",
    "payment:verify",
    "notification:read",
    "announcement:read",
    "announcement:write",
    "ticket:read",
    "ticket:update",
    "report:read",
    "audit:read",
  ],
  official: [
    "billing:read",
    "utility:read",
    "penalty:read",
    "penalty:manage",
    "coordination:read",
    "coordination:write",
    "resource:read",
    "resource:review",
    "stall:read",
    "booking:read",
    "payment:read",
    "announcement:read",
    "announcement:write",
    "ticket:read",
    "report:read",
    "audit:read",
    "vendor:read",
  ],
  admin: [
    "auth:manage",
    "billing:read",
    "billing:manage",
    "utility:read",
    "utility:manage",
    "penalty:read",
    "penalty:manage",
    "vendor:read",
    "coordination:read",
    "coordination:write",
    "resource:read",
    "resource:review",
    "stall:read",
    "booking:read",
    "payment:read",
    "payment:verify",
    "notification:read",
    "announcement:read",
    "announcement:write",
    "ticket:read",
    "report:read",
    "audit:read",
  ],
};

/** Check whether a role possesses a given permission string. */
export const hasPermission = (role: Role, permission: Permission) => {
  return rolePermissions[role].includes(permission);
};
