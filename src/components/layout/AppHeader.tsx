import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import {
  Bell, Building2, ChevronDown, HelpCircle, KeyRound, LogOut, Menu, Search, ShieldCheck, UserCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabels, getInitials } from "./navigation";
import type { User } from "@/types";

interface AppHeaderProps {
  user: User;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  profileImageUrl: string | null;
  breadcrumbs: { label: string; path?: string }[];
  currentPageLabel: string;
  headerScope: string;
  isPendingVendor: boolean;
  hasUnread: boolean;
  basePath: string;
  openProfileTab: (tab?: string) => void;
  openSettingsTab: (section?: string) => void;
  signOut: () => void;
  onOpenCommandMenu: () => void;
}

export const AppHeader = ({
  user, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed,
  profileImageUrl, breadcrumbs, currentPageLabel, headerScope,
  isPendingVendor, hasUnread, openProfileTab, openSettingsTab, signOut,
  onOpenCommandMenu,
}: AppHeaderProps) => {
  const { t } = useTranslation();
  const initials = getInitials(user.name);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-white/80 backdrop-blur-xl px-4 lg:px-6 shadow-sm">
      <button
        type="button"
        aria-label={t("nav:toggleSidebar")}
        className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={t("nav:toggleSidebar")}
        className="hidden rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground lg:inline-flex"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
        <div className="min-w-0">
          <nav className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-label={t("layout:breadcrumb")}>
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${item.path || "current"}`} className="inline-flex min-w-0 items-center gap-1.5">
                {item.path && index < breadcrumbs.length - 1 ? (
                  <NavLink to={item.path} className="truncate transition-colors hover:text-foreground hover:underline">
                    {item.label}
                  </NavLink>
                ) : (
                  <span className="truncate text-foreground font-semibold">{item.label}</span>
                )}
                {index < breadcrumbs.length - 1 && <span className="text-muted-foreground/40">/</span>}
              </span>
            ))}
          </nav>
          <p className="mt-0.5 max-w-[360px] truncate text-xs text-muted-foreground">{currentPageLabel}</p>
        </div>

        <div className="relative ml-auto hidden w-full max-w-[360px] lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <button
            type="button"
            onClick={onOpenCommandMenu}
            className="flex h-9 w-full items-center rounded-lg border border-border/60 bg-slate-50/80 pl-9 pr-14 text-sm outline-none transition-all text-muted-foreground hover:bg-slate-100/80 hover:border-border/80"
          >
            {t("common:search")}
          </button>
          <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-border/60 bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline-flex">
            Ctrl K
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 md:hidden">
        <p className="truncate text-sm font-semibold font-heading">{currentPageLabel}</p>
        <p className="truncate text-xs text-muted-foreground">{headerScope}</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hidden h-9 gap-2 rounded-lg border-border/60 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 xl:inline-flex">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[180px] truncate">{headerScope}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <DropdownMenuLabel className="p-2 text-xs text-muted-foreground">{t("layout:marketScope")}</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{headerScope}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              {t("layout:scopeControlledByRole")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="role-badge hidden h-9 items-center gap-2 rounded-lg border border-border/60 bg-white/80 px-3 text-xs font-semibold text-slate-700 shadow-sm sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {roleLabels[user.role]}
        </span>

        <button
          type="button"
          aria-label={t("nav:openNotifications")}
          onClick={() => { if (!isPendingVendor) openSettingsTab("notifications"); }}
          disabled={isPendingVendor}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-white/80 text-muted-foreground transition-all hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 shadow-sm"
        >
          <Bell className="h-4 w-4" />
          {hasUnread && !isPendingVendor && (
            <span className="absolute right-2 top-2 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </button>

        <button
          type="button"
          aria-label={t("common:help")}
          className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-white/80 text-muted-foreground transition-all hover:bg-slate-50 hover:text-foreground shadow-sm sm:flex"
          onClick={() => openSettingsTab("security")}
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-white/80 px-1 pr-2 text-left transition-all hover:bg-slate-50 shadow-sm"
            >
              <Avatar className="h-7 w-7 border border-border/60">
                {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[150px] truncate text-sm font-semibold sm:block">{user.name}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <DropdownMenuLabel className="p-2">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border border-border/60">
                  {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                  <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold font-heading">{user.name}</p>
                  <p className="text-xs font-medium text-muted-foreground">{roleLabels[user.role]} - {headerScope}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openProfileTab()} className="gap-3">
              <UserCircle className="h-4 w-4" />
              {t("nav:profileSettings")}
            </DropdownMenuItem>
            {!isPendingVendor && (
              <DropdownMenuItem onClick={() => openSettingsTab("notifications")} className="gap-3">
                <Bell className="h-4 w-4" />
                {t("nav:notifications")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => openSettingsTab("security")} className="gap-3">
              <KeyRound className="h-4 w-4" />
              {t("nav:changePassword")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="gap-3 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              {t("common:signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
