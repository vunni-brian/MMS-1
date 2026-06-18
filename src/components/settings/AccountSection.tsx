import { useTranslation } from "react-i18next";
import { Activity, Building2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";
import { ReadOnlyRows } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { formatHumanDate } from "@/lib/utils";
import type { AuthUser, Role } from "@/types";

interface AccountSectionProps {
  user: AuthUser;
  navigate: (path: string) => void;
  roleHomePath: string;
  setActiveSection: (id: string) => void;
  deactivationState: "idle" | "confirm" | "submitting" | "done" | "error";
  setDeactivationState: (state: "idle" | "confirm" | "submitting" | "done" | "error") => void;
  onRequestDeactivation: () => void;
}

const AccountSection = ({
  user,
  navigate,
  roleHomePath,
  setActiveSection,
  deactivationState,
  setDeactivationState,
  onRequestDeactivation,
}: AccountSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={t("settings:account.title")}
        description={t("settings:account.description")}
        actions={<UserCircle className="h-4 w-4 text-muted-foreground" />}
      >
        <ReadOnlyRows
          rows={[
            { label: t("settings:account.accountHolder"), value: user.name },
            { label: t("settings:account.email"), value: user.email },
            { label: t("settings:account.phone"), value: user.phone },
            { label: t("settings:account.role"), value: t(`nav:${user.role}`) },
            { label: t("settings:account.marketScope"), value: user.marketName || (user.role === "admin" ? t("common:allMarkets") : t("common:noMarketAssigned")) },
            {
              label: t("settings:account.phoneVerification"),
              value: user.phoneVerifiedAt ? t("settings:account.verifiedAt", { date: formatHumanDate(user.phoneVerifiedAt) }) : t("common:pending"),
            },
            {
              label: t("common:status"),
              value: user.vendorStatus ? <StatusBadge status={user.vendorStatus} /> : t("common:active"),
            },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/profile`)}>
            <UserCircle className="h-4 w-4" />
            {t("settings:account.editProfile")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setActiveSection("activity")}>
            <Activity className="h-4 w-4" />
            {t("settings:account.viewActivity")}
          </Button>
        </div>
      </Panel>

      {user.role === "vendor" && (
        <Panel
          title={t("settings:account.vendorAccount")}
          description={t("settings:account.vendorAccountDesc")}
          actions={<Building2 className="h-4 w-4 text-muted-foreground" />}
        >
          <ReadOnlyRows
            rows={[
              { label: t("settings:account.currentMarket"), value: user.marketName || t("settings:account.pendingManagerAssignment") },
              { label: t("settings:account.productSection"), value: user.productSection || t("settings:account.recordedOnProfile") },
              { label: t("settings:account.transferHandling"), value: t("settings:account.transferHandlingDesc") },
            ]}
          />
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-destructive">{t("settings:account.deactivateAccount")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("settings:account.deactivateDesc")}
            </p>
            {deactivationState === "done" ? (
              <p className="mt-3 text-xs text-success font-medium">{t("settings:account.requestSubmitted")}</p>
            ) : deactivationState === "error" ? (
              <p className="mt-3 text-xs text-destructive font-medium">{t("settings:account.requestFailed")}</p>
            ) : deactivationState === "confirm" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-destructive">{t("settings:account.confirmDeactivate")}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={deactivationState === "submitting"}
                    onClick={() => { setDeactivationState("submitting"); onRequestDeactivation(); }}
                  >
                    {t("settings:account.confirmSubmit")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDeactivationState("idle")}>
                    {t("common:cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-3 text-destructive hover:text-destructive"
                onClick={() => setDeactivationState("confirm")}
              >
                {t("settings:account.requestDeactivation")}
              </Button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default AccountSection;
