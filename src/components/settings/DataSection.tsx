import { Activity, AlertTriangle, Database, FileDown } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Panel, EvidenceField } from "@/components/console/ConsolePage";
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
}: DataSectionProps) => (
  <div className="space-y-4">
    <Panel
      title={user.role === "admin" ? "Data Management" : "Privacy and Data"}
      description="Exports, retention, backups, and operational data access."
      actions={<Database className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      {user.role === "admin" && (
        <>
          <SettingToggle
            label="Automatic daily backups"
            detail="Run a database backup on the configured schedule."
            checked={getBoolean("backupEnabled")}
            onCheckedChange={(checked) => updateSetting("backupEnabled", checked)}
          />
          <SettingInput
            id="settings-backup-time"
            label="Backup time"
            value={getString("backupTime")}
            onChange={(value) => updateSetting("backupTime", value)}
          />
          <SettingInput
            id="settings-backup-retention"
            label="Backup retention"
            detail="Number of days to keep automatic backups."
            value={getString("backupRetention")}
            onChange={(value) => updateSetting("backupRetention", value)}
          />
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <EvidenceField label="Payments loaded" value={payments.length} />
        <EvidenceField label="Activity records" value={auditEvents.length || "Permission dependent"} />
        <EvidenceField label="Notifications loaded" value={notifications.length} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/reports`)}>
          <FileDown className="h-4 w-4" />
          Open Exports
        </Button>
        {canReadAudit && (
          <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/audit`)}>
            <Activity className="h-4 w-4" />
            Open Activity Log
          </Button>
        )}
      </div>
    </Panel>

    {user.role === "admin" && (
      <Panel title="Danger Zone" description="Administrative cleanup actions require backend confirmation." actions={<AlertTriangle className="h-4 w-4 text-destructive" />}>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-destructive">Wipe test data</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Removes demo vendors, sample payments, and generated complaints after confirmation.</p>
          {wipeState === "done" ? (
            <p className="mt-3 text-xs text-success font-medium">Test data wiped successfully.</p>
          ) : wipeState === "error" ? (
            <p className="mt-3 text-xs text-destructive font-medium">Wipe failed. The backend endpoint may not be available yet.</p>
          ) : wipeState === "confirm" ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-destructive">This cannot be undone. Confirm wipe?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={wipeTestData.isPending}
                  onClick={() => { setWipeState("submitting"); wipeTestData.mutate(); }}
                >
                  {wipeTestData.isPending ? "Wiping\u2026" : "Yes, wipe test data"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setWipeState("idle")}>
                  Cancel
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
              Wipe Test Data
            </Button>
          )}
        </div>
      </Panel>
    )}
  </div>
);

export default DataSection;
export type { DataSectionProps };
