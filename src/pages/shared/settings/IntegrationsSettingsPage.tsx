/**
 * Integrations settings page displaying configured payment gateway information.
 * Admin role only.
 */
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { IntegrationsSection } from "@/components/settings";

/** IntegrationsSettingsPage - renders the integrations status section. */
const IntegrationsSettingsPage = () => {
  const hook = useContext(SettingsDataContext);
  const navigate = useNavigate();
  if (!hook) return null;
  return (
    <IntegrationsSection
      paymentGateway={hook.paymentGateway}
      navigate={navigate}
    />
  );
};
export default IntegrationsSettingsPage;
