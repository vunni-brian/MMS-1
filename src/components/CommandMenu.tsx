import { useEffect } from "react";
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

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
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
 <CommandInput placeholder="Type a command or search..." />
 <CommandList>
 <CommandEmpty>No results found.</CommandEmpty>
 <CommandGroup heading="Suggestions">
 <CommandItem onSelect={() => runCommand(() => navigate(basePath))}>
 <LayoutDashboard className="mr-2 h-4 w-4" />
 <span>Dashboard</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/stalls`))}>
 <Store className="mr-2 h-4 w-4" />
 <span>Stalls & Occupancy</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/payments`))}>
 <CreditCard className="mr-2 h-4 w-4" />
 <span>Payments & Billing</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/complaints`))}>
 <MessageSquare className="mr-2 h-4 w-4" />
 <span>Grievances & Appeals</span>
 </CommandItem>
 </CommandGroup>
 <CommandSeparator />
 <CommandGroup heading="Settings">
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/profile`))}>
 <User className="mr-2 h-4 w-4" />
 <span>Profile Settings</span>
 </CommandItem>
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/settings`))}>
 <Settings className="mr-2 h-4 w-4" />
 <span>General Settings</span>
 </CommandItem>
 </CommandGroup>
 {["admin", "manager"].includes(user.role) && (
 <CommandGroup heading="Management">
 <CommandItem onSelect={() => runCommand(() => navigate(`${basePath}/${user.role === "admin" ? "users" : "vendors"}`))}>
 <Users className="mr-2 h-4 w-4" />
 <span>Users & Vendors</span>
 </CommandItem>
 </CommandGroup>
 )}
 </CommandList>
 </CommandDialog>
 );
}
