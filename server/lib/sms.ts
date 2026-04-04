import type { AppConfig } from "../types.ts";

export type SmsDeliveryConfig = Pick<
  AppConfig,
  | "africasTalkingUsername"
  | "africasTalkingApiKey"
  | "africasTalkingFrom"
  | "africasTalkingUseSandbox"
  | "africasTalkingSmsEnabled"
  | "devMode"
>;

export const sendSmsDelivery = async (
  destination: string,
  message: string,
  smsConfig: SmsDeliveryConfig,
) => {
  if (!smsConfig.africasTalkingSmsEnabled) {
    const errorMessage =
      "SMS delivery provider is not configured. Set AFRICAS_TALKING_USERNAME and AFRICAS_TALKING_API_KEY.";
    if (smsConfig.devMode) {
      console.log("[delivery:sms:fallback]", destination, message);
      return;
    }
    throw new Error(errorMessage);
  }

  console.log(`[delivery:sms:africastalking:${smsConfig.africasTalkingUseSandbox ? "sandbox" : "live"}]`, destination);

  const form = new URLSearchParams({
    username: smsConfig.africasTalkingUsername!,
    to: destination,
    message,
  });
  if (smsConfig.africasTalkingFrom) {
    form.set("from", smsConfig.africasTalkingFrom);
  }

  const response = await fetch(
    `${smsConfig.africasTalkingUseSandbox ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com"}/version1/messaging`,
    {
      method: "POST",
      headers: {
        apiKey: smsConfig.africasTalkingApiKey!,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const messageFromPayload =
      typeof payload === "object" && payload !== null && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : null;
    throw new Error(`Africa's Talking SMS delivery failed: ${messageFromPayload || `${response.status} ${response.statusText}`}`);
  }

  const recipients =
    typeof payload === "object" &&
    payload !== null &&
    "SMSMessageData" in payload &&
    typeof (payload as { SMSMessageData?: unknown }).SMSMessageData === "object" &&
    Array.isArray((payload as { SMSMessageData?: { Recipients?: unknown[] } }).SMSMessageData?.Recipients)
      ? (payload as { SMSMessageData: { Recipients: Array<{ status?: string; number?: string }> } }).SMSMessageData.Recipients
      : [];

  const failedRecipient = recipients.find((recipient) => !recipient.status || !/^success$/i.test(recipient.status));
  if (failedRecipient) {
    throw new Error(
      `Africa's Talking SMS delivery failed: ${failedRecipient.status || "Unknown status"}${failedRecipient.number ? ` for ${failedRecipient.number}` : ""}`,
    );
  }
};
