/**
 * Admin general settings page for system-wide configuration (market listing, etc.).
 * Admin role only.
 */
import { useContext } from "react";
import { SettingsDataContext } from "@/pages/shared/SettingsLayout";
import { AdminGeneralSection } from "@/components/settings";

/** AdminGeneralSettingsPage - renders the admin general configuration section. */
const AdminGeneralSettingsPage = () => {
  const hook = useContext(SettingsDataContext);
  if (!hook) return null;
  return (
    <AdminGeneralSection
      markets={hook.markets}
      chargeTypes={hook.chargeTypes}
      payments={hook.payments}
    />
  );
};
export default AdminGeneralSettingsPage;
