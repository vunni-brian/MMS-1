import { useTranslation } from "react-i18next";
import { roleLabels } from "./navigation";
import type { User } from "@/types";

interface AppFooterProps {
  user: User;
  headerScope: string;
  openSettingsTab: (section?: string) => void;
}

export const AppFooter = ({ user, headerScope, openSettingsTab }: AppFooterProps) => {
  const { t } = useTranslation();
  return (
    <footer className="enterprise-footer mt-8 border-t border-border/40 bg-white/50 backdrop-blur-sm px-4 py-4" aria-label={t("layout:workspaceStatus")}>
      <div className="enterprise-footer-left flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{t("layout:version", { version: "1.0.0" })}</span>
        <span className="text-muted-foreground/60">•</span>
        <span>{t("layout:roleWorkspace", { role: roleLabels[user.role] })}</span>
        <span className="text-muted-foreground/60">•</span>
        <span>{headerScope}</span>
      </div>
      <div className="enterprise-footer-right flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-emerald-600 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t("layout:allSystemsOperational")}
        </span>
        <button type="button" onClick={() => openSettingsTab("notifications")} className="hover:text-foreground transition-colors">{t("layout:support")}</button>
        <button type="button" onClick={() => openSettingsTab("security")} className="hover:text-foreground transition-colors">{t("layout:security")}</button>
        <span className="text-muted-foreground/60">{t("layout:copyright", { year: new Date().getFullYear(), name: headerScope })}</span>
      </div>
    </footer>
  );
};
