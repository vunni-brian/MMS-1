/**
 * CommandMenu - A command palette (Cmd+K / Ctrl+K) that lets the user navigate
 * quickly to common pages. Renders a CommandDialog with role-aware suggestions.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
 CreditCard,
 LayoutDashboard,
 MessageSquare,
 Settings,
 Store,
 User,
 Users,
} from "lucide-react";

import {
 CommandDialog,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
 CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Props for the CommandMenu component.
 */
interface CommandMenuProps {
 /** Whether the command dialog is open. */
 open: boolean;
 /** Callback to toggle the dialog open state. */
 onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { user } = useAuth();

 useEffect(() => {
 const down = (e: KeyboardEvent) => {
 if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
 e.preventDefault();
 onOpenChange(!open);
 }
 };

 document.addEventListener("keydown", down);
 return () => document.removeEventListener("keydown", down);
 }, [open, onOpenChange]);

 const runCommand = (command: () => void) => {
  onOpenChange(false);
  command();
 };

  if (!user) return null;

  const basePath = `/${user.role}`;

  return (
  <CommandDialog open={open} onOpenChange={onOpenChange}>
 <CommandInput placeholder={t("command:placeholder")} />
 <CommandList>
 <CommandEmpty>{t("command:noResults")}</CommandEmpty>
 <CommandGroup heading={t("command:suggestions")}>
 <CommandItem onSelect={() => runCommand(() => navigate(basePath))}>
 <LayoutDashboard className="mr-2 h-4 w-4" />
 <span>{t("nav:dashboard")}</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/stalls`))}>
 <Store className="mr-2 h-4 w-4" />
 <span>{t("nav:stalls")}</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/payments`))}>
 <CreditCard className="mr-2 h-4 w-4" />
 <span>{t("nav:payments")}</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/complaints`))}>
 <MessageSquare className="mr-2 h-4 w-4" />
 <span>{t("nav:complaints")}</span>
 </CommandItem>
 </CommandGroup>
 <CommandSeparator />
 <CommandGroup heading={t("nav:settings")}>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/profile`))}>
 <User className="mr-2 h-4 w-4" />
 <span>{t("nav:profile")}</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/settings`))}>
 <Settings className="mr-2 h-4 w-4" />
 <span>{t("nav:settings")}</span>
 </CommandItem>
 </CommandGroup>
 {["admin", "manager"].includes(user.role) && (
 <CommandGroup heading={t("command:management")}>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/${user.role === "admin" ? "users" : "vendors"}`))}>
 <Users className="mr-2 h-4 w-4" />
 <span>{t("nav:vendors")}</span>
 </CommandItem>
 </CommandGroup>
 )}
 </CommandList>
 </CommandDialog>
 );
}
