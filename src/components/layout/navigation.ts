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
    { title: "Main", items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard },
      { label: "My Stall", path: "stalls", icon: Store },
      { label: "Payments", path: "payments", icon: CreditCard },
    ]},
    { title: "Operations", items: [
      { label: "Complaints", path: "complaints", icon: MessageSquare },
      { label: "Notifications", path: "notifications", icon: Bell },
    ]},
    { title: "Account", items: [
      { label: "Settings", path: "settings", icon: Settings },
      { label: "Profile", path: "profile", icon: UserCircle },
    ]},
  ],
  manager: [
    { title: "Main", items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard },
      { label: "Vendors", path: "vendors", icon: Users },
      { label: "Stalls & Bookings", path: "stalls", icon: Store },
    ]},
    { title: "Finance", items: [
      { label: "Payments", path: "payments", icon: CreditCard },
      { label: "Billing", path: "billing", icon: Gauge },
    ]},
    { title: "Operations", items: [
      { label: "Complaints", path: "complaints", icon: MessageSquare },
      { label: "Coordination", path: "coordination", icon: MessagesSquare },
      { label: "Notices", path: "announcements", icon: Megaphone },
    ]},
    { title: "Review", items: [
      { label: "Reports", path: "reports", icon: CircleDollarSign },
    ]},
    { title: "Account", items: [
      { label: "Settings", path: "settings", icon: Settings },
      { label: "Profile", path: "profile", icon: UserCircle },
    ]},
  ],
  official: [
    { title: "Main", items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard },
      { label: "Market Monitoring", path: "markets", icon: Landmark },
      { label: "Vendor Listings", path: "vendors", icon: Users },
    ]},
    { title: "Finance", items: [
      { label: "Revenue & Dues", path: "billing", icon: Gauge },
      { label: "Analytics", path: "analytics", icon: BarChart3 },
      { label: "Reports", path: "reports", icon: CircleDollarSign },
    ]},
    { title: "Governance", items: [
      { label: "Compliance", path: "compliance", icon: ShieldCheck },
      { label: "Audit", path: "audit", icon: ScrollText },
      { label: "Coordination", path: "coordination", icon: MessagesSquare },
    ]},
    { title: "Communication", items: [
      { label: "Notices", path: "announcements", icon: Megaphone },
    ]},
    { title: "Account", items: [
      { label: "Settings", path: "settings", icon: Settings },
      { label: "Profile", path: "profile", icon: UserCircle },
    ]},
  ],
  admin: [
    { title: "Main", items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard },
      { label: "Users", path: "users", icon: Users },
      { label: "Roles & Permissions", path: "users", query: "tab=roles", icon: KeyRound },
    ]},
    { title: "Operations", items: [
      { label: "Billing Controls", path: "billing", icon: CreditCard },
      { label: "Notifications", path: "notifications", icon: Bell },
      { label: "Reports", path: "reports", icon: BarChart3 },
    ]},
    { title: "System", items: [
      { label: "Audit Logs", path: "audit", icon: ScrollText },
      { label: "System Health", path: "alerts", icon: AlertTriangle },
      { label: "Settings", path: "settings", icon: Settings },
    ]},
    { title: "Configuration", items: [
      { label: "Markets", path: "markets", icon: Landmark },
      { label: "Integrations", path: "integrations", icon: Plug },
      { label: "Coordination", path: "coordination", icon: MessagesSquare },
    ]},
    { title: "Account", items: [
      { label: "Profile", path: "profile", icon: UserCircle },
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
