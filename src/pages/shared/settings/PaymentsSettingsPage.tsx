/**
 * Payments settings page showing payment configuration with completed/pending totals.
 * Accessible to all roles.
 */
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentsSection } from "@/components/settings";

/** PaymentsSettingsPage - renders the payments configuration section with totals. */
const PaymentsSettingsPage = () => {
  const { user } = useAuth();
  const hook = useContext(SettingsDataContext);
  const navigate = useNavigate();
  if (!user || !hook) return null;
  return (
    <PaymentsSection
      user={user}
      settings={hook.settings}
      updateSetting={hook.updateSetting}
      getBoolean={hook.getBoolean}
      getString={hook.getString}
      paymentGateway={hook.paymentGateway}
      completedPayments={hook.completedPayments}
      completedPaymentTotal={hook.completedPaymentTotal}
      pendingPayments={hook.pendingPayments}
      navigate={navigate}
    />
  );
};
export default PaymentsSettingsPage;
