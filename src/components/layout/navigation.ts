import type { ElementType } from "react";

import { AlertTriangle, BarChart3, Bell, Building2, CircleDollarSign, CreditCard, Gauge, HelpCircle, KeyRound, Landmark, LayoutDashboard, Megaphone, MessageSquare, MessagesSquare, Plug, ScrollText, Settings, ShieldCheck, Store, UserCircle, Users } from "lucide-react";

import type { Role } from "@/types";

export interface NavItem {
  label: string;
  path: string;
  icon: ElementType;
  query?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const roleNavGroups: Record<Role, NavGroup[]> = {
  vendor: [
    { title: "nav:groups.main", items: [
      { label: "nav:items.dashboard", path: "", icon: LayoutDashboard },
      { label: "nav:items.myStall", path: "stalls", icon: Store },
      { label: "nav:items.payments", path: "payments", icon: CreditCard },
    ]},
    { title: "nav:groups.operations", items: [
      { label: "nav:items.complaints", path: "complaints", icon: MessageSquare },
      { label: "nav:items.coordination", path: "coordination", icon: MessagesSquare },
      { label: "nav:items.notices", path: "announcements", icon: Megaphone },
      { label: "nav:items.notifications", path: "notifications", icon: Bell },
    ]},
    { title: "nav:groups.account", items: [
      { label: "nav:items.settings", path: "settings", icon: Settings },
      { label: "nav:items.profile", path: "profile", icon: UserCircle },
    ]},
  ],
  manager: [
    { title: "nav:groups.main", items: [
      { label: "nav:items.dashboard", path: "", icon: LayoutDashboard },
      { label: "nav:items.vendors", path: "vendors", icon: Users },
      { label: "nav:items.stallsBookings", path: "stalls", icon: Store },
    ]},
    { title: "nav:groups.finance", items: [
      { label: "nav:items.payments", path: "payments", icon: CreditCard },
      { label: "nav:items.billing", path: "billing", icon: Gauge },
    ]},
    { title: "nav:groups.operations", items: [
      { label: "nav:items.complaints", path: "complaints", icon: MessageSquare },
      { label: "nav:items.coordination", path: "coordination", icon: MessagesSquare },
      { label: "nav:items.notices", path: "announcements", icon: Megaphone },
    ]},
    { title: "nav:groups.review", items: [
      { label: "nav:items.reports", path: "reports", icon: CircleDollarSign },
    ]},
    { title: "nav:groups.account", items: [
      { label: "nav:items.settings", path: "settings", icon: Settings },
      { label: "nav:items.profile", path: "profile", icon: UserCircle },
    ]},
  ],
  official: [
    { title: "nav:groups.main", items: [
      { label: "nav:items.dashboard", path: "", icon: LayoutDashboard },
      { label: "nav:items.marketMonitoring", path: "markets", icon: Landmark },
      { label: "nav:items.vendorListings", path: "vendors", icon: Users },
    ]},
    { title: "nav:groups.finance", items: [
      { label: "nav:items.revenueDues", path: "billing", icon: Gauge },
      { label: "nav:items.analytics", path: "analytics", icon: BarChart3 },
      { label: "nav:items.reports", path: "reports", icon: CircleDollarSign },
    ]},
    { title: "nav:groups.governance", items: [
      { label: "nav:items.compliance", path: "compliance", icon: ShieldCheck },
      { label: "nav:items.audit", path: "audit", icon: ScrollText },
      { label: "nav:items.coordination", path: "coordination", icon: MessagesSquare },
    ]},
    { title: "nav:groups.communication", items: [
      { label: "nav:items.notices", path: "announcements", icon: Megaphone },
    ]},
    { title: "nav:groups.account", items: [
      { label: "nav:items.settings", path: "settings", icon: Settings },
      { label: "nav:items.profile", path: "profile", icon: UserCircle },
    ]},
  ],
  admin: [
    { title: "nav:groups.main", items: [
      { label: "nav:items.dashboard", path: "", icon: LayoutDashboard },
      { label: "nav:items.users", path: "users", icon: Users },
      { label: "nav:items.rolesPermissions", path: "users", query: "tab=permissions", icon: KeyRound },
    ]},
    { title: "nav:groups.operations", items: [
      { label: "nav:items.billingControls", path: "billing", icon: CreditCard },
      { label: "nav:items.notifications", path: "notifications", icon: Bell },
      { label: "nav:items.reports", path: "reports", icon: BarChart3 },
    ]},
    { title: "nav:groups.system", items: [
      { label: "nav:items.auditLogs", path: "audit", icon: ScrollText },
      { label: "nav:items.systemHealth", path: "alerts", icon: AlertTriangle },
      { label: "nav:items.settings", path: "settings", icon: Settings },
    ]},
    { title: "nav:groups.configuration", items: [
      { label: "nav:items.markets", path: "markets", icon: Landmark },
      { label: "nav:items.integrations", path: "integrations", icon: Plug },
      { label: "nav:items.coordination", path: "coordination", icon: MessagesSquare },
    ]},
    { title: "nav:groups.account", items: [
      { label: "nav:items.profile", path: "profile", icon: UserCircle },
    ]},
  ],
};

export const roleLabels: Record<Role, string> = {
  vendor: "Vendor",
  manager: "Manager",
  official: "Official",
  admin: "Admin",
};

export const roleDescriptions: Record<Role, string> = {
  vendor: "Daily stall operations",
  manager: "Market command center",
  official: "Regional oversight",
  admin: "Platform control",
};

export const getNavTarget = (basePath: string, item: NavItem) => {
  const path = item.path ? `${basePath}/${item.path}` : basePath;
  return item.query ? `${path}?${item.query}` : path;
};

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
