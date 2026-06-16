import { Settings } from "lucide-react";
import { Panel } from "@/components/console/ConsolePage";
import { EvidenceField } from "@/components/console/ConsolePage";
import { ReadOnlyRows } from "@/components/settings";
import type { ChargeType } from "@/types";

interface AdminGeneralSectionProps {
  markets: { length: number }[];
  chargeTypes: ChargeType[];
  payments: { length: number }[];
}

const AdminGeneralSection = ({ markets, chargeTypes, payments }: AdminGeneralSectionProps) => (
  <div className="space-y-4">
    <Panel title="Platform Overview" description="High-level platform state for municipal administration." actions={<Settings className="h-4 w-4 text-muted-foreground" />}>
      <div className="grid gap-3 sm:grid-cols-3">
        <EvidenceField label="Markets" value={markets.length || "Not loaded"} />
        <EvidenceField label="Billing switches" value={chargeTypes.length || "Not loaded"} />
        <EvidenceField label="Payment records" value={payments.length || "Not loaded"} />
      </div>
      <ReadOnlyRows
        rows={[
          { label: "Runtime mode", value: import.meta.env.MODE },
          { label: "API base URL", value: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001" },
          { label: "Workspace scope", value: "All markets" },
        ]}
      />
    </Panel>
  </div>
);

export default AdminGeneralSection;
export type { AdminGeneralSectionProps };
