import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, Database, FileDown } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EvidenceField } from "@/components/console/ConsolePage";
import { Panel } from "@/components/ui/Panel";
import { SettingInput, SettingToggle } from "@/components/settings";
import type { SettingsContext } from "@/components/settings/settingsProps";

interface DataSectionProps extends SettingsContext {
  payments: { length: number }[];
  auditEvents: { length: number }[];
  notifications: { length: number }[];
  navigate: (path: string) => void;
  roleHomePath: string;
  canReadAudit: boolean;
  wipeState: "idle" | "confirm" | "submitting" | "done" | "error";
  setWipeState: (state: "idle" | "confirm" | "submitting" | "done" | "error") => void;
  wipeTestData: UseMutationResult<void, Error, void, unknown>;
}

const DataSection = ({
  user,
  getString,
  updateSetting,
  getBoolean,
  payments,
  auditEvents,
  notifications,
  navigate,
  roleHomePath,
  canReadAudit,
  wipeState,
  setWipeState,
  wipeTestData,
}: DataSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={user.role === "admin" ? t("settings:data.adminTitle") : t("settings:data.title")}
        description={t("settings:data.description")}
        actions={<Database className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        {user.role === "admin" && (
          <>
            <SettingToggle
              label={t("settings:data.automaticBackups")}
              detail={t("settings:data.automaticBackupsDesc")}
              checked={getBoolean("backupEnabled")}
              onCheckedChange={(checked) => updateSetting("backupEnabled", checked)}
            />
            <SettingInput
              id="settings-backup-time"
              label={t("settings:data.backupTime")}
              value={getString("backupTime")}
              onChange={(value) => updateSetting("backupTime", value)}
            />
            <SettingInput
              id="settings-backup-retention"
              label={t("settings:data.backupRetention")}
              detail={t("settings:data.backupRetentionDesc")}
              value={getString("backupRetention")}
              onChange={(value) => updateSetting("backupRetention", value)}
            />
          </>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <EvidenceField label={t("settings:data.paymentsLoaded")} value={payments.length} />
          <EvidenceField label={t("settings:data.activityRecords")} value={auditEvents.length || t("settings:data.permissionDependent")} />
          <EvidenceField label={t("settings:data.notificationsLoaded")} value={notifications.length} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/reports`)}>
            <FileDown className="h-4 w-4" />
            {t("settings:data.openExports")}
          </Button>
          {canReadAudit && (
            <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/audit`)}>
              <Activity className="h-4 w-4" />
              {t("settings:data.openActivityLog")}
            </Button>
          )}
        </div>
      </Panel>

      {user.role === "admin" && (
        <Panel title={t("settings:data.dangerZone")} description={t("settings:data.dangerZoneDesc")} actions={<AlertTriangle className="h-4 w-4 text-destructive" />}>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-destructive">{t("settings:data.wipeTestData")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("settings:data.wipeTestDataDesc")}</p>
            {wipeState === "done" ? (
              <p className="mt-3 text-xs text-success font-medium">{t("settings:data.wipeSuccess")}</p>
            ) : wipeState === "error" ? (
              <p className="mt-3 text-xs text-destructive font-medium">{t("settings:data.wipeFailed")}</p>
            ) : wipeState === "confirm" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-destructive">{t("settings:data.confirmWipe")}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={wipeTestData.isPending}
                    onClick={() => { setWipeState("submitting"); wipeTestData.mutate(); }}
                  >
                    {wipeTestData.isPending ? t("settings:data.wipingButton") : t("settings:data.wipeButton")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setWipeState("idle")}>
                    {t("common:cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-3 text-destructive hover:text-destructive"
                onClick={() => setWipeState("confirm")}
              >
                {t("settings:data.wipeTestDataButton")}
              </Button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default DataSection;
export type { DataSectionProps };
