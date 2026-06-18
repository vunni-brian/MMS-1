import { ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface TopBarProps {
  workspaceTitle: string;
  scope: string;
}

export const TopBar = ({ workspaceTitle, scope }: TopBarProps) => (
  <div className="flex h-[72px] shrink-0 items-center border-b border-[#F0F2F5] bg-white px-6 z-50">
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5EE]">
          <ShieldCheck className="h-4 w-4 text-[#0F5E3F]" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#111827] leading-tight">{workspaceTitle}</span>
          {scope && <span className="text-[11px] text-[#71717A] leading-tight">{scope}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
      </div>
    </div>
  </div>
);
