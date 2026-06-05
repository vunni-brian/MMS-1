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
 UserCircle,
 Users,
} from "lucide-react";

import { roleExperience } from "@/config/roleExperience";

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

export type PageType =
 | "dashboard"
 | "workspace"
 | "detail"
 | "settings";

export type PageAccent =
 | "blue"
 | "teal"
 | "green"
 | "amber"
 | "rose"
 | "slate"
 | "cyan";

export interface PageIdentity {
 label: string;
 shortLabel: string;
 description: string;
 kind: PageKind;
 accent: PageAccent;
 icon: ElementType;
}

const roleLabels: Record<string, string> = {
 admin: roleExperience.admin.workspaceTitle,
 official: roleExperience.official.workspaceTitle,
 manager: roleExperience.manager.workspaceTitle,
 vendor: roleExperience.vendor.workspaceTitle,
};

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

const fallbackIdentity: PageIdentity = {
 label: "Workspace",
 shortLabel: "Workspace",
 description: "Role-based operating space.",
 kind: "operations",
 accent: "green",
 icon: ShieldCheck,
};

export const getPathSegments = (pathname: string) =>
 pathname
 .split("/")
 .map((segment) => segment.trim())
 .filter(Boolean);

export const getPageIdentity = (pathname: string): PageIdentity => {
 const normalizedPath = `/${getPathSegments(pathname).join("/")}`;
 const pathOverrides: Record<string, Partial<PageIdentity>> = {
 "/admin/alerts": { label: "System Health", shortLabel: "System Health" },
 "/admin/billing": { label: "Revenue Controls", shortLabel: "Revenue Controls" },
 "/admin/audit": { label: "Audit Logs", shortLabel: "Audit Logs" },
 "/vendor/stalls": { label: "My Allocation", shortLabel: "My Allocation", description: "Your current space assignment, dues, and space change requests." },
 "/manager/audit": { label: "Activity Log", shortLabel: "Activity Log" },
 "/official/coordination": { label: "Coordination", shortLabel: "Coordination" },
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

export const getPageType = (pathname: string): PageType => {
 const normalizedPath = `/${getPathSegments(pathname).join("/")}`;
 const mapped = pageLayoutMap[normalizedPath];
 if (mapped) return mapped;
 const kind = getPageIdentity(pathname).kind;
 return kind === "settings" || kind === "profile" ? "settings" : "workspace";
};

export const getWorkspaceLabel = (pathname: string) => {
 const [roleSegment] = getPathSegments(pathname);
 return roleLabels[roleSegment] || "Workspace";
};

export const getPageBreadcrumbs = (pathname: string) => {
 const identity = getPageIdentity(pathname);
 const workspaceLabel = getWorkspaceLabel(pathname);

 return [
 { label: workspaceLabel, path: `/${getPathSegments(pathname)[0] || ""}` },
 { label: identity.shortLabel || identity.label },
 ].filter((item) => item.label);
};

export const getNavigationIdentity = (role: string, path: string) => {
 const pathname = path ? `/${role}/${path}` : `/${role}`;
 return getPageIdentity(pathname);
};
