/**
 * TopBar - Fixed top navigation bar displaying the workspace title, scope,
 * language switcher, settings shortcut, and user profile dropdown menu.
 */
import { ChevronDown, LogOut, Menu, Settings, UserCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { brand } from "@/config/brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getInitials, roleLabels } from "./navigation";
import type { User } from "@/types";

/** Props for the TopBar component. */
interface TopBarProps {
  workspaceTitle: string;
  scope: string;
  user: User;
  profileImageUrl: string | null;
  onOpenSidebar: () => void;
  openProfileTab: () => void;
  openSettingsTab: (section?: string) => void;
  signOut: () => void | Promise<void>;
}

export const TopBar = ({
  workspaceTitle,
  scope,
  user,
  profileImageUrl,
  onOpenSidebar,
  openProfileTab,
  openSettingsTab,
  signOut,
}: TopBarProps) => {
  const { t } = useTranslation();
  const initials = getInitials(user.name);

  return (
    <header className="mms-topbar fixed left-0 right-0 top-0 z-header flex h-[72px] items-center border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        aria-label={t("layout:openNavigation")}
        className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#111827] lg:hidden"
        onClick={onOpenSidebar}
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white p-1 sm:flex">
          <img src={brand.faviconPath} alt={brand.appName} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <span className="block truncate text-sm font-bold leading-tight text-[#111827]">{workspaceTitle}</span>
          {scope && <span className="block truncate text-[11px] leading-tight text-[#71717A]">{scope}</span>}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <LanguageSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]"
          aria-label={t("nav:items.settings")}
          onClick={() => openSettingsTab()}
        >
          <Settings className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-10 max-w-[220px] items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-1.5 pr-2 text-left shadow-sm transition-colors hover:bg-[#F8FAFC]",
                "sm:max-w-[280px]",
              )}
            >
              <Avatar className="h-7 w-7 border border-[#E2E8F0]">
                {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                <AvatarFallback className="bg-[#E8F5EE] text-xs font-semibold text-[#0F5E3F]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span className="max-w-[130px] truncate text-sm font-semibold leading-tight text-[#111827] lg:max-w-[160px]">
                  {user.name}
                </span>
                <span className="truncate text-[11px] leading-tight text-[#71717A]">
                  {roleLabels[user.role]}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#71717A]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <DropdownMenuLabel className="p-2">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border border-[#E2E8F0]">
                  {profileImageUrl && <AvatarImage src={profileImageUrl} alt={user.name} />}
                  <AvatarFallback className="bg-[#E8F5EE] text-sm font-semibold text-[#0F5E3F]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{user.name}</p>
                  <p className="text-xs font-medium text-[#71717A]">{roleLabels[user.role]}</p>
                  <p className="mt-1 truncate text-xs font-normal text-[#71717A]">{user.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openProfileTab} className="gap-3">
              <UserCircle className="h-4 w-4" />
              {t("layout:profileSettings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSettingsTab()} className="gap-3">
              <Settings className="h-4 w-4" />
              {t("nav:items.settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="gap-3 text-[#DC2626] focus:text-[#DC2626]">
              <LogOut className="h-4 w-4" />
              {t("layout:signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
