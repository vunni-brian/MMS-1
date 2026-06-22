/**
 * @file OTP message templates.
 * Renders registration and login OTP messages using configurable templates
 * with `{{code}}`, `{{ttlMinutes}}`, etc. placeholders.
 */

import type { AppConfig } from "../types.ts";

/** Discriminates between a registration OTP and a login OTP. */
type OtpMessagePurpose = "registration" | "login";

const defaultTemplates: Record<OtpMessagePurpose, string> = {
  registration: "Your verification code is {{code}}. It expires in {{ttlMinutes}} minutes.",
  login: "Your secure login code is {{code}}. It expires in {{ttlMinutes}} minutes.",
};

const renderOtpTemplate = (
  template: string,
  values: {
    appName: string;
    code: string;
    ttlMinutes: number;
    purpose: OtpMessagePurpose;
  },
) =>
  template
    .replaceAll("{{appName}}", values.appName)
    .replaceAll("{{code}}", values.code)
    .replaceAll("{{ttlMinutes}}", String(values.ttlMinutes))
    .replaceAll("{{purpose}}", values.purpose);

/** Build the OTP SMS / notification message using the configured (or default) template. */
export const getOtpNotificationMessage = ({
  config,
  code,
  purpose,
}: {
  config: Pick<AppConfig, "appName" | "otpTtlMinutes" | "otpRegistrationMessageTemplate" | "otpLoginMessageTemplate">;
  code: string;
  purpose: OtpMessagePurpose;
}) => {
  const template =
    purpose === "registration"
      ? config.otpRegistrationMessageTemplate || defaultTemplates.registration
      : config.otpLoginMessageTemplate || defaultTemplates.login;

  return renderOtpTemplate(template, {
    appName: config.appName,
    code,
    ttlMinutes: config.otpTtlMinutes,
    purpose,
  });
};
