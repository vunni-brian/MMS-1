import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/console/ConsolePage";
import { EvidenceField } from "@/components/console/ConsolePage";
import type { ChargeType } from "@/types";

interface IntegrationsSectionProps {
  paymentGateway: ChargeType | undefined;
  navigate: (path: string) => void;
}

const IntegrationsSection = ({ paymentGateway, navigate }: IntegrationsSectionProps) => (
  <div className="space-y-4">
    <Panel title="Integrations" description="External municipal and service-provider connections." actions={<Plug className="h-4 w-4 text-muted-foreground" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceField label="Payment gateway" value={`Pesapal - ${paymentGateway?.isEnabled === false ? "Paused" : "Connected"}`} />
        <EvidenceField label="SMS provider" value="Africa's Talking - Configured server-side" />
        <EvidenceField label="Email service" value="SendGrid - Configured server-side" />
        <EvidenceField label="Government registry" value="Not connected" />
      </div>
      <Button type="button" variant="outline" className="mt-3" onClick={() => navigate("/admin/integrations")}>
        <Plug className="h-4 w-4" />
        Open Integrations Workspace
      </Button>
    </Panel>
  </div>
);

export default IntegrationsSection;
export type { IntegrationsSectionProps };
