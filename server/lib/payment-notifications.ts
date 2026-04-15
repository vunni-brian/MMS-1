import type { ChargeTypeName, NotificationChannel, PaymentStatus } from "../types.ts";

const paymentConfirmationChannels: NotificationChannel[] = ["system", "sms"];

const fallbackChargeTypeLabel = (chargeType: string) =>
  chargeType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getPaymentItemLabel = ({
  chargeType,
  itemLabel,
}: {
  chargeType: ChargeTypeName | string;
  itemLabel?: string | null;
}) => {
  const trimmedItemLabel = itemLabel?.trim();
  if (trimmedItemLabel) {
    return trimmedItemLabel;
  }

  switch (chargeType) {
    case "booking_fee":
      return "Stall Booking";
    case "utilities":
      return "Utilities Payment";
    case "market_dues":
      return "Market Dues";
    case "penalties":
      return "Penalty Payment";
    case "payment_gateway":
      return "Payment Gateway Charge";
    default:
      return fallbackChargeTypeLabel(chargeType) || "your service";
  }
};

export const formatPaymentNotificationDate = (completedAt: string) =>
  new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kampala",
  }).format(new Date(completedAt));

export const getPaymentReference = ({
  providerReference,
  transactionId,
  externalReference,
}: {
  providerReference?: string | null;
  transactionId?: string | null;
  externalReference: string;
}) => providerReference || transactionId || externalReference;

export const getPaymentSuccessMessage = ({
  amount,
  chargeType,
  itemLabel,
  reference,
  completedAt,
}: {
  amount: number;
  chargeType: ChargeTypeName | string;
  itemLabel?: string | null;
  reference: string;
  completedAt: string;
}) =>
  [
    "Payment Successful",
    "",
    `Your payment of UGX ${amount.toLocaleString()} for ${getPaymentItemLabel({ chargeType, itemLabel })} has been received successfully.`,
    "",
    `Reference: ${reference}`,
    "Status: Confirmed",
    `Date: ${formatPaymentNotificationDate(completedAt)}`,
    "",
    "Thank you.",
  ].join("\n");

export const getVendorPaymentNotification = ({
  previousStatus,
  nextStatus,
  amount,
  chargeType,
  itemLabel,
  providerReference,
  transactionId,
  externalReference,
  completedAt,
}: {
  previousStatus: PaymentStatus | string;
  nextStatus: PaymentStatus;
  amount: number;
  chargeType: ChargeTypeName | string;
  itemLabel?: string | null;
  providerReference?: string | null;
  transactionId?: string | null;
  externalReference: string;
  completedAt: string;
}) => {
  if (previousStatus === nextStatus || nextStatus !== "completed") {
    return null;
  }

  return {
    channels: paymentConfirmationChannels,
    message: getPaymentSuccessMessage({
      amount,
      chargeType,
      itemLabel,
      reference: getPaymentReference({ providerReference, transactionId, externalReference }),
      completedAt,
    }),
  };
};
