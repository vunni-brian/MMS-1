/**
 * AdminGeneralSection - Admin dashboard overview showing market counts, billing
 * switches, payment records, runtime mode, and API base URL.
 */
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { EvidenceField } from "@/components/ui/EvidenceField";
import { ReadOnlyRows } from "@/components/settings";
import type { ChargeType } from "@/types";

/** Props for the AdminGeneralSection component. */
interface AdminGeneralSectionProps {
  markets: { length: number }[];
  chargeTypes: ChargeType[];
  payments: { length: number }[];
}

/**
 * AdminGeneralSection - High-level admin summary with market/billing/payment
 * counts and runtime environment info.
 */
const AdminGeneralSection = ({ markets, chargeTypes, payments }: AdminGeneralSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:adminGeneral.title")} description={t("settings:adminGeneral.description")} actions={<Settings className="h-4 w-4 text-muted-foreground" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <EvidenceField label={t("settings:adminGeneral.markets")} value={markets.length || t("common:notAvailable")} />
          <EvidenceField label={t("settings:adminGeneral.billingSwitches")} value={chargeTypes.length || t("common:notAvailable")} />
          <EvidenceField label={t("settings:adminGeneral.paymentRecords")} value={payments.length || t("common:notAvailable")} />
        </div>
        <ReadOnlyRows
          rows={[
            { label: t("settings:adminGeneral.runtimeMode"), value: import.meta.env.MODE },
            { label: t("settings:adminGeneral.apiBaseUrl"), value: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001" },
            { label: t("settings:adminGeneral.workspaceScope"), value: t("common:allMarkets") },
          ]}
        />
      </Panel>
    </div>
  );
};

export default AdminGeneralSection;
export type { AdminGeneralSectionProps };
