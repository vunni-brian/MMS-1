/**
 * PaymentsSection - Payment gateway configuration (admin) or default payment
 * method / receipt preferences (non-admin), plus a billing snapshot summary.
 */
import { useTranslation } from "react-i18next";
import { CreditCard, ReceiptText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceField } from "@/components/ui/EvidenceField";
import { Panel } from "@/components/ui/Panel";
import { SettingInput, SettingSelect, SettingToggle } from "@/components/settings";
import { formatCurrency } from "@/lib/utils";
import type { SettingsContext } from "@/components/settings/settingsProps";
import type { ChargeType } from "@/types";

/** Props for the PaymentsSection component. */
interface PaymentsSectionProps extends SettingsContext {
  paymentGateway: ChargeType | undefined;
  completedPayments: Array<{ amount: number }>;
  completedPaymentTotal: number;
  pendingPayments: unknown[];
  navigate: (path: string) => void;
}

/**
 * PaymentsSection - Payment configuration panel. Renders admin-specific gateway
 * controls or user-specific payment preferences, plus a billing snapshot summary.
 */
const PaymentsSection = ({
  user,
  getString,
  updateSetting,
  getBoolean,
  paymentGateway,
  completedPayments,
  completedPaymentTotal,
  pendingPayments,
  navigate,
}: PaymentsSectionProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Panel
        title={user.role === "admin" ? t("settings:payments.adminTitle") : t("settings:payments.title")}
        description={
          user.role === "admin"
            ? t("settings:payments.adminDescription")
            : t("settings:payments.description")
        }
        actions={<WalletCards className="h-4 w-4 text-muted-foreground" />}
        contentClassName="space-y-3"
      >
        {user.role === "admin" ? (
          <>
            <SettingToggle
              label={t("settings:payments.enableGateway")}
              detail={`${t("settings:payments.currentChargeSwitch")} ${paymentGateway?.isEnabled === false ? t("common:disabled") : t("common:enabled")}`}
              checked={paymentGateway?.isEnabled !== false}
              onCheckedChange={(checked) => updateSetting("paymentGatewayEnabled", checked)}
            />
            <SettingSelect
              id="settings-payment-gateway"
              label={t("settings:payments.provider")}
              value={getString("paymentGateway")}
              onValueChange={(value) => updateSetting("paymentGateway", value)}
              options={[
                { value: "pesapal", label: t("settings:payments.pesapal") },
                { value: "flutterwave", label: t("settings:payments.flutterwave") },
                { value: "manual", label: t("settings:payments.manualReceipts") },
              ]}
            />
            <SettingInput
              id="settings-platform-fee"
              label={t("settings:payments.platformFeePercent")}
              value={getString("platformFeePercent")}
              onChange={(value) => updateSetting("platformFeePercent", value)}
            />
            <SettingToggle
              label={t("settings:payments.vendorPaysFee")}
              detail={t("settings:payments.vendorPaysFeeDesc")}
              checked={getBoolean("vendorPaysFee")}
              onCheckedChange={(checked) => updateSetting("vendorPaysFee", checked)}
            />
          </>
        ) : (
          <>
            <SettingSelect
              id="settings-payment-method"
              label={t("settings:payments.defaultPaymentMethod")}
              value={getString("defaultPaymentMethod")}
              onValueChange={(value) => updateSetting("defaultPaymentMethod", value)}
              options={[
                { value: "mobile-money", label: t("settings:payments.mobileMoney") },
                { value: "card", label: t("settings:payments.debitCard") },
                { value: "receipt", label: t("settings:payments.manualReceipt") },
              ]}
            />
            <SettingSelect
              id="settings-reminder-window"
              label={t("settings:payments.reminderWindow")}
              value={getString("paymentReminderWindow")}
              onValueChange={(value) => updateSetting("paymentReminderWindow", value)}
              options={[
                { value: "1", label: t("settings:payments.dayBefore") },
                { value: "3", label: t("settings:payments.daysBefore3") },
                { value: "7", label: t("settings:payments.daysBefore7") },
              ]}
            />
            <SettingSelect
              id="settings-receipt-format"
              label={t("settings:payments.receiptFormat")}
              value={getString("receiptFormat")}
              onValueChange={(value) => updateSetting("receiptFormat", value)}
              options={[
                { value: "pdf", label: t("settings:payments.pdf") },
                { value: "csv", label: t("settings:payments.csv") },
              ]}
            />
            <SettingToggle
              label={t("settings:payments.autoDownloadReceipts")}
              detail={t("settings:payments.autoDownloadReceiptsDesc")}
              checked={getBoolean("autoDownloadReceipts")}
              onCheckedChange={(checked) => updateSetting("autoDownloadReceipts", checked)}
            />
          </>
        )}
      </Panel>

      <Panel title={t("settings:payments.billingSnapshot")} description={t("settings:payments.billingSnapshotDesc")} actions={<ReceiptText className="h-4 w-4 text-muted-foreground" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <EvidenceField label={t("settings:payments.verifiedPayments")} value={completedPayments.length} />
          <EvidenceField label={t("settings:payments.verifiedTotal")} value={formatCurrency(completedPaymentTotal)} />
          <EvidenceField label={t("settings:payments.pendingReview")} value={pendingPayments.length} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(user.role === "vendor" || user.role === "manager" ? `/${user.role}/payments` : `/${user.role}/billing`)}
          >
            <CreditCard className="h-4 w-4" />
            {t("settings:payments.openBilling")}
          </Button>
        </div>
      </Panel>
    </div>
  );
};

export default PaymentsSection;
