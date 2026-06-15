import { roleLabels } from "./navigation";
import type { User } from "@/types";

interface AppFooterProps {
  user: User;
  headerScope: string;
  openSettingsTab: (section?: string) => void;
}

export const AppFooter = ({ user, headerScope, openSettingsTab }: AppFooterProps) => (
  <footer className="enterprise-footer mt-8 border-t border-border/40 bg-white/50 backdrop-blur-sm px-4 py-4" aria-label="Workspace status">
    <div className="enterprise-footer-left flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">MMS v1.0.0</span>
      <span className="text-muted-foreground/60">•</span>
      <span>{roleLabels[user.role]} workspace</span>
      <span className="text-muted-foreground/60">•</span>
      <span>{headerScope}</span>
    </div>
    <div className="enterprise-footer-right flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-emerald-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        All systems operational
      </span>
      <button type="button" onClick={() => openSettingsTab("notifications")} className="hover:text-foreground transition-colors">Support</button>
      <button type="button" onClick={() => openSettingsTab("security")} className="hover:text-foreground transition-colors">Security</button>
      <span className="text-muted-foreground/60">© 2026 Kampala Capital City Authority</span>
    </div>
  </footer>
);
