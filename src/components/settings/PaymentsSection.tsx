import { CreditCard, ReceiptText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceField, Panel } from "@/components/console/ConsolePage";
import { SettingInput, SettingSelect, SettingToggle } from "@/components/settings";
import { formatCurrency } from "@/lib/utils";
import type { SettingsContext } from "@/components/settings/settingsProps";
import type { ChargeType } from "@/types";

interface PaymentsSectionProps extends SettingsContext {
  paymentGateway: ChargeType | undefined;
  completedPayments: Array<{ amount: number }>;
  completedPaymentTotal: number;
  pendingPayments: unknown[];
  navigate: (path: string) => void;
}

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
}: PaymentsSectionProps) => (
  <div className="space-y-4">
    <Panel
      title={user.role === "admin" ? "Payment Gateway Configuration" : "Payment Preferences"}
      description={
        user.role === "admin"
          ? "Gateway status, allowed payment methods, and transaction fee policy."
          : "Default payment method, reminder timing, receipt handling, and payment history shortcuts."
      }
      actions={<WalletCards className="h-4 w-4 text-muted-foreground" />}
      contentClassName="space-y-3"
    >
      {user.role === "admin" ? (
        <>
          <SettingToggle
            label="Enable payment gateway"
            detail={`Current charge switch: ${paymentGateway?.isEnabled === false ? "Disabled" : "Enabled"}`}
            checked={paymentGateway?.isEnabled !== false}
            onCheckedChange={(checked) => updateSetting("paymentGatewayEnabled", checked)}
          />
          <SettingSelect
            id="settings-payment-gateway"
            label="Provider"
            value={getString("paymentGateway")}
            onValueChange={(value) => updateSetting("paymentGateway", value)}
            options={[
              { value: "pesapal", label: "Pesapal" },
              { value: "flutterwave", label: "Flutterwave" },
              { value: "manual", label: "Manual receipts only" },
            ]}
          />
          <SettingInput
            id="settings-platform-fee"
            label="Platform fee percent"
            value={getString("platformFeePercent")}
            onChange={(value) => updateSetting("platformFeePercent", value)}
          />
          <SettingToggle
            label="Vendor pays transaction fee"
            detail="Pass payment provider fees through to vendors."
            checked={getBoolean("vendorPaysFee")}
            onCheckedChange={(checked) => updateSetting("vendorPaysFee", checked)}
          />
        </>
      ) : (
        <>
          <SettingSelect
            id="settings-payment-method"
            label="Default payment method"
            value={getString("defaultPaymentMethod")}
            onValueChange={(value) => updateSetting("defaultPaymentMethod", value)}
            options={[
              { value: "mobile-money", label: "Mobile Money" },
              { value: "card", label: "Debit or credit card" },
              { value: "receipt", label: "Manual receipt upload" },
            ]}
          />
          <SettingSelect
            id="settings-reminder-window"
            label="Reminder window"
            value={getString("paymentReminderWindow")}
            onValueChange={(value) => updateSetting("paymentReminderWindow", value)}
            options={[
              { value: "1", label: "1 day before due date" },
              { value: "3", label: "3 days before due date" },
              { value: "7", label: "7 days before due date" },
            ]}
          />
          <SettingSelect
            id="settings-receipt-format"
            label="Receipt format"
            value={getString("receiptFormat")}
            onValueChange={(value) => updateSetting("receiptFormat", value)}
            options={[
              { value: "pdf", label: "PDF" },
              { value: "csv", label: "CSV" },
            ]}
          />
          <SettingToggle
            label="Auto-download receipts"
            detail="Prepare receipts for download after payment verification."
            checked={getBoolean("autoDownloadReceipts")}
            onCheckedChange={(checked) => updateSetting("autoDownloadReceipts", checked)}
          />
        </>
      )}
    </Panel>

    <Panel title="Billing Snapshot" description="Live payment records available to this role." actions={<ReceiptText className="h-4 w-4 text-muted-foreground" />}>
      <div className="grid gap-3 sm:grid-cols-3">
        <EvidenceField label="Verified payments" value={completedPayments.length} />
        <EvidenceField label="Verified total" value={formatCurrency(completedPaymentTotal)} />
        <EvidenceField label="Pending review" value={pendingPayments.length} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(user.role === "vendor" || user.role === "manager" ? `/${user.role}/payments` : `/${user.role}/billing`)}
        >
          <CreditCard className="h-4 w-4" />
          Open Billing
        </Button>
      </div>
    </Panel>
  </div>
);

export default PaymentsSection;
