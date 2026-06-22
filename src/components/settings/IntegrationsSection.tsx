/**
 * IntegrationsSection - Overview of connected third-party services (payment
 * gateway, SMS, email, government registry) with navigation to the full
 * integrations page.
 */
import { useTranslation } from "react-i18next";
import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";
import { EvidenceField } from "@/components/ui/EvidenceField";
import type { ChargeType } from "@/types";

/** Props for the IntegrationsSection component. */
interface IntegrationsSectionProps {
  paymentGateway: ChargeType | undefined;
  navigate: (path: string) => void;
}

/**
 * IntegrationsSection - Overview card showing connected services status and a
 * link to the full integrations management page.
 */
const IntegrationsSection = ({ paymentGateway, navigate }: IntegrationsSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel title={t("settings:integrations.title")} description={t("settings:integrations.description")} actions={<Plug className="h-4 w-4 text-muted-foreground" />}>
        <div className="grid gap-3 md:grid-cols-2">
          <EvidenceField label={t("settings:integrations.paymentGateway")} value={`Pesapal - ${paymentGateway?.isEnabled === false ? t("settings:integrations.paused") : t("settings:integrations.connected")}`} />
          <EvidenceField label={t("settings:integrations.smsProvider")} value={t("settings:integrations.africasTalkingConfigured")} />
          <EvidenceField label={t("settings:integrations.emailService")} value={t("settings:integrations.sendGridConfigured")} />
          <EvidenceField label={t("settings:integrations.governmentRegistry")} value={t("settings:integrations.notConnected")} />
        </div>
        <Button type="button" variant="outline" className="mt-3" onClick={() => navigate("/admin/integrations")}>
          <Plug className="h-4 w-4" />
          {t("settings:integrations.openIntegrations")}
        </Button>
      </Panel>
    </div>
  );
};

export default IntegrationsSection;
export type { IntegrationsSectionProps };
