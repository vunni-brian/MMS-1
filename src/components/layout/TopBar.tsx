import { ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface TopBarProps {
  workspaceTitle: string;
}

export const TopBar = ({ workspaceTitle }: TopBarProps) => (
  <div className="bg-gradient-to-r from-primary via-primary/95 to-primary/90 px-4 py-2.5 text-white shrink-0 z-50 shadow-lg">
    <div className="flex w-full items-center justify-between text-xs font-medium">
      <div className="flex items-center gap-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white shadow-inner">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        </span>
        <span className="hidden sm:inline font-semibold tracking-wide">{workspaceTitle}</span>
        <span className="sm:hidden font-semibold">{workspaceTitle}</span>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
      </div>
    </div>
  </div>
);
