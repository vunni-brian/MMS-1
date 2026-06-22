/**
 * Page identity and navigation configuration.
 * Defines page kinds, types, accents, and the mapping from routes to page metadata.
 */
import type { ElementType } from "react";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  CreditCard,
  Gauge,
  Landmark,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";

import { roleExperience } from "@/config/roleExperience";

/** Categories that group pages by functional domain. */
export type PageKind =
  | "dashboard"
  | "operations"
  | "data"
  | "finance"
  | "reports"
  | "governance"
  | "settings"
  | "communications"
  | "profile";

/** Layout type used to render the page. */
export type PageType =
  | "dashboard"
  | "workspace"
  | "detail"
  | "settings";

/** Accent colour variant for a page's visual identity. */
export type PageAccent =
  | "blue"
  | "teal"
  | "green"
  | "amber"
  | "rose"
  | "slate"
  | "cyan";

/** Metadata that describes a page's identity for navigation headers, breadcrumbs, and titles. */
export interface PageIdentity {
  /** Full page title. */
  label: string;
  /** Abbreviated label for breadcrumbs and compact layouts. */
  shortLabel: string;
  /** Short description of the page's purpose. */
  description: string;
  /** Functional category the page belongs to. */
  kind: PageKind;
  /** Accent colour for the page. */
  accent: PageAccent;
  /** Icon component associated with the page. */
  icon: ElementType;
}

/** Maps role slugs to their workspace titles for navigation. */
const roleLabels: Record<string, string> = {
  admin: roleExperience.admin.workspaceTitle,
  official: roleExperience.official.workspaceTitle,
  manager: roleExperience.manager.workspaceTitle,
  vendor: roleExperience.vendor.workspaceTitle,
};

/** Maps route paths to their corresponding page layout type. */
export const pageLayoutMap: Record<string, PageType> = {
 "/vendor": "dashboard",
 "/manager": "dashboard",
 "/official": "dashboard",
 "/admin": "dashboard",

 "/vendor/stalls": "workspace",
 "/vendor/payments": "workspace",
 "/vendor/complaints": "workspace",
 "/vendor/announcements": "workspace",

 "/manager/vendors": "workspace",
 "/manager/stalls": "workspace",
 "/manager/payments": "workspace",
 "/manager/complaints": "workspace",
 "/manager/billing": "workspace",
 "/manager/reports": "workspace",
 "/manager/audit": "workspace",
 "/manager/coordination": "workspace",
 "/manager/announcements": "workspace",

 "/official/billing": "workspace",
 "/official/markets": "workspace",
 "/official/vendors": "workspace",
 "/official/compliance": "workspace",
 "/official/analytics": "workspace",
 "/official/reports": "workspace",
 "/official/audit": "workspace",
 "/official/coordination": "workspace",
 "/official/announcements": "workspace",

 "/admin/users": "workspace",
 "/admin/markets": "workspace",
 "/admin/alerts": "workspace",
 "/admin/integrations": "workspace",
 "/admin/billing": "workspace",
 "/admin/reports": "workspace",
 "/admin/audit": "workspace",
 "/admin/coordination": "workspace",
 "/admin/announcements": "workspace",

 "/vendor/settings": "settings",
 "/manager/settings": "settings",
 "/official/settings": "settings",
 "/admin/settings": "settings",
 "/vendor/profile": "settings",
 "/manager/profile": "settings",
 "/official/profile": "settings",
 "/admin/profile": "settings",
};

/** Maps URL path segments to their page identity metadata. */
const routeIdentities: Record<string, PageIdentity> = {
 "": {
 label: "Dashboard",
 shortLabel: "Overview",
 description: "Today's priorities, status signals, and useful shortcuts.",
 kind: "dashboard",
 accent: "green",
 icon: LayoutDashboard,
 },
 users: {
 label: "Personnel & Access",
 shortLabel: "Personnel",
 description: "Staff accounts, roles, clearances, and access status.",
 kind: "data",
 accent: "teal",
 icon: Users,
 },
 markets: {
 label: "Markets",
 shortLabel: "Markets",
 description: "Market setup, managers, stall capacity, and operational status.",
 kind: "data",
 accent: "teal",
 icon: Landmark,
 },
 alerts: {
 label: "Alerts",
 shortLabel: "Alerts",
 description: "System attention items, payment exceptions, and operational warnings.",
 kind: "governance",
 accent: "rose",
 icon: AlertTriangle,
 },
 integrations: {
 label: "Integrations",
 shortLabel: "Integrations",
 description: "Payment, messaging, reporting, and platform connection health.",
 kind: "settings",
 accent: "slate",
 icon: Plug,
 },
 vendors: {
 label: "Vendors",
 shortLabel: "Vendors",
 description: "Vendor status, applications, documents, and follow-up work.",
 kind: "data",
 accent: "teal",
 icon: Users,
 },
 stalls: {
 label: "Allocated Spaces",
 shortLabel: "Spaces",
 description: "Market inventory, availability, official allocation, and applications.",
 kind: "operations",
 accent: "teal",
 icon: Store,
 },
 payments: {
 label: "Payments",
 shortLabel: "Payments",
 description: "Payments due, receipt records, verification, and collection status.",
 kind: "finance",
 accent: "green",
 icon: CreditCard,
 },
 billing: {
 label: "Revenue & Dues",
 shortLabel: "Revenue",
 description: "Market fees, utilities, taxes due, and revenue collection setup.",
 kind: "finance",
 accent: "green",
 icon: Gauge,
 },
 reports: {
 label: "Reports",
 shortLabel: "Reports",
 description: "Payment records, exports, and performance review.",
 kind: "reports",
 accent: "green",
 icon: BarChart3,
 },
 analytics: {
 label: "Revenue Analytics",
 shortLabel: "Analytics",
 description: "Revenue trends, payment channels, vendor distribution, and market comparisons.",
 kind: "reports",
 accent: "green",
 icon: TrendingUp,
 },
 compliance: {
 label: "Compliance Reporting",
 shortLabel: "Compliance",
 description: "Complaint SLA, sanitation, maintenance, dues, penalties, and resource risk signals.",
 kind: "governance",
 accent: "amber",
 icon: ShieldCheck,
 },
 audit: {
 label: "Activity Log",
 shortLabel: "Activity Log",
 description: "Read-only record of important system activity.",
 kind: "governance",
 accent: "amber",
 icon: ScrollText,
 },
 coordination: {
 label: "Requests",
 shortLabel: "Requests",
 description: "Resource requests, approvals, and market updates.",
 kind: "communications",
 accent: "cyan",
 icon: ClipboardList,
 },
 announcements: {
 label: "Notices",
 shortLabel: "Notices",
 description: "News and alerts, publication windows, and audience targeting.",
 kind: "communications",
 accent: "cyan",
 icon: Megaphone,
 },
 complaints: {
 label: "Grievances & Appeals",
 shortLabel: "Grievances",
 description: "Review and resolve trader disputes and compliance appeals.",
 kind: "operations",
 accent: "rose",
 icon: MessageSquare,
 },
 settings: {
 label: "System Configuration",
 shortLabel: "Configuration",
 description: "Account preferences, security, official notifications, data, and operational controls.",
 kind: "settings",
 accent: "slate",
 icon: Settings,
 },
 profile: {
 label: "Official Credential",
 shortLabel: "Credential",
 description: "Official identity, government contact information, and verified profile photo.",
 kind: "profile",
 accent: "slate",
 icon: UserCircle,
 },
};

/** Fallback identity used when no route segment matches. */
const fallbackIdentity: PageIdentity = {
 label: "Workspace",
 shortLabel: "Workspace",
 description: "Role-based operating space.",
 kind: "operations",
 accent: "green",
 icon: ShieldCheck,
};

/**
 * Splits a pathname into its non-empty segments.
 * @param pathname - The URL pathname to split.
 * @returns Array of trimmed path segments.
 */
export const getPathSegments = (pathname: string) =>
  pathname
  .split("/")
  .map((segment) => segment.trim())
  .filter(Boolean);

/**
 * Resolves the page identity for a given pathname.
 * Applies path-specific overrides where defined (e.g., role-specific labels).
 * @param pathname - The URL pathname to resolve.
 * @returns The resolved PageIdentity.
 */
export const getPageIdentity = (pathname: string): PageIdentity => {
 const normalizedPath = `/${getPathSegments(pathname).join("/")}`;
 const pathOverrides: Record<string, Partial<PageIdentity>> = {
 "/admin/alerts": { label: "System Health", shortLabel: "System Health" },
 "/admin/billing": { label: "Revenue Controls", shortLabel: "Revenue Controls" },
 "/admin/audit": { label: "Audit Logs", shortLabel: "Audit Logs" },
 "/vendor/stalls": { label: "My Allocation", shortLabel: "My Allocation", description: "Your current space assignment, dues, and space change requests." },
 "/manager/audit": { label: "Activity Log", shortLabel: "Activity Log" },
 "/official/coordination": { label: "Coordination", shortLabel: "Coordination" },
 "/official/markets": { label: "Market Monitoring", shortLabel: "Markets", description: "Read-only market performance, revenue, occupancy, and compliance risk monitoring." },
 "/official/vendors": { label: "Vendor Listings", shortLabel: "Vendors", description: "Read-only vendor registry for search, filtering, and export." },
 "/official/billing": { label: "Revenue & Dues", shortLabel: "Revenue", description: "Read-only utilities, dues, payment obligations, and collection policies." },
 "/official/compliance": { label: "Compliance Reporting", shortLabel: "Compliance" },
 "/official/analytics": { label: "Revenue Analytics", shortLabel: "Analytics" },
 "/admin/coordination": { label: "Coordination", shortLabel: "Coordination" },
 "/vendor/settings": { label: "Preferences", shortLabel: "Preferences", description: "Account, security, notifications, payments, preferences, data, and activity controls." },
 "/manager/settings": { label: "Department Settings", shortLabel: "Dept Settings", description: "Market account controls, operations defaults, security, notifications, and activity." },
 "/official/settings": { label: "Oversight Preferences", shortLabel: "Preferences", description: "Oversight preferences, security, notifications, data access, and activity." },
 "/admin/settings": { label: "Platform Configuration", shortLabel: "Configuration", description: "Platform configuration, integrations, feature management, security, data, and logging." },
 };
 const [, pageSegment = ""] = getPathSegments(pathname);
 const identity = routeIdentities[pageSegment] || fallbackIdentity;
 return { ...identity, ...(pathOverrides[normalizedPath] || {}) };
};

/**
 * Determines the page layout type for a given pathname.
 * Falls back to "settings" for settings/profile kinds, otherwise "workspace".
 * @param pathname - The URL pathname.
 * @returns The page layout type.
 */
export const getPageType = (pathname: string): PageType => {
  const normalizedPath = `/${getPathSegments(pathname).join("/")}`;
  const mapped = pageLayoutMap[normalizedPath];
  if (mapped) return mapped;
  const kind = getPageIdentity(pathname).kind;
  return kind === "settings" || kind === "profile" ? "settings" : "workspace";
};

/**
 * Returns the workspace label for the role segment of a pathname.
 * @param pathname - The URL pathname.
 * @returns Workspace title (e.g., "Control Center").
 */
export const getWorkspaceLabel = (pathname: string) => {
  const [roleSegment] = getPathSegments(pathname);
  return roleLabels[roleSegment] || "Workspace";
};

/**
 * Builds a breadcrumb trail for the given pathname.
 * First item is the workspace, second is the current page label.
 * @param pathname - The URL pathname.
 * @returns Array of breadcrumb items with label and optional path.
 */
export const getPageBreadcrumbs = (pathname: string) => {
  const identity = getPageIdentity(pathname);
  const workspaceLabel = getWorkspaceLabel(pathname);

  return [
  { label: workspaceLabel, path: `/${getPathSegments(pathname)[0] || ""}` },
  { label: identity.shortLabel || identity.label },
  ].filter((item) => item.label);
};

/**
 * Resolves page identity for a navigation entry within a role scope.
 * @param role - The role slug (e.g., "admin", "vendor").
 * @param path - The sub-path within the role scope.
 * @returns The resolved PageIdentity.
 */
export const getNavigationIdentity = (role: string, path: string) => {
  const pathname = path ? `/${role}/${path}` : `/${role}`;
  return getPageIdentity(pathname);
};
