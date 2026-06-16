import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { IntegrationsSection } from "@/components/settings";

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
