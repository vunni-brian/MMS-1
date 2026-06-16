import type { AppConfig } from "../types.ts";
import { canConnectToDatabase } from "./db.ts";
import { logger } from "./logger.ts";

interface ValidationWarning {
  field: string;
  message: string;
  severity: "warn" | "error";
}

export const validateProductionConfig = async (config: AppConfig): Promise<void> => {
  const warnings: ValidationWarning[] = [];

  if (config.appEnv === "production") {
    if (config.seedOnBoot) {
      warnings.push({
        field: "MMS_SEED_ON_BOOT",
        message: "Seeding on boot is enabled in production. Set MMS_SEED_ON_BOOT=false or unset it.",
        severity: "error",
      });
    }

    if (!config.pesapalConsumerKey || !config.pesapalConsumerSecret) {
      warnings.push({
        field: "PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET",
        message: "Pesapal payment credentials are not configured. Payments via Pesapal gateway will fail.",
        severity: "warn",
      });
    }

    if (config.paymentsEnabled && (!config.pesapalIpnUrl || !config.pesapalIpnId)) {
      warnings.push({
        field: "PESAPAL_IPN_URL / PESAPAL_IPN_ID",
        message: "Pesapal IPN is not configured. Payment webhook callbacks may not work.",
        severity: "warn",
      });
    }

    if (config.pesapalBaseUrl.includes("cybqa") || config.pesapalBaseUrl.includes("sandbox")) {
      warnings.push({
        field: "PESAPAL_BASE_URL",
        message: "Pesapal is pointed at the sandbox environment. Set PESAPAL_BASE_URL to the production URL.",
        severity: "warn",
      });
    }

    if (!config.databaseUrl || config.databaseUrl.includes("localhost")) {
      warnings.push({
        field: "DATABASE_URL",
        message: "Database is configured for localhost. Ensure a production database URL is set.",
        severity: "error",
      });
    }

    if (config.africasTalkingSmsEnabled && config.africasTalkingUseSandbox) {
      warnings.push({
        field: "AFRICAS_TALKING_USE_SANDBOX",
        message: "SMS sandbox mode is enabled. Set AFRICAS_TALKING_USE_SANDBOX=false for production.",
        severity: "warn",
      });
    }
  }

  const databaseReady = await canConnectToDatabase();
  if (!databaseReady) {
    warnings.push({
      field: "DATABASE_URL",
      message: "Cannot connect to PostgreSQL. Verify DATABASE_URL and that the database server is running.",
      severity: "error",
    });
  }

  for (const warning of warnings) {
    if (warning.severity === "error") {
      logger.error(`[startup] ${warning.message}`, undefined, { field: warning.field });
    } else {
      logger.warn(`[startup] ${warning.message}`, { field: warning.field });
    }
  }

  const errors = warnings.filter((w) => w.severity === "error");
  if (errors.length > 0 && config.appEnv === "production") {
    logger.error(`[startup] Production configuration has ${errors.length} critical issue(s) that must be resolved before the server is fully operational.`, undefined, { errorCount: errors.length });
  }
};

interface EnvSchema {
  key: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "url";
  defaultValue?: string;
  description: string;
}

const envSchema: EnvSchema[] = [
  { key: "DATABASE_URL", required: true, type: "url", description: "PostgreSQL connection string" },
  { key: "APP_ENV", required: false, type: "string", defaultValue: "development", description: "Application environment" },
  { key: "API_PORT", required: false, type: "number", defaultValue: "3001", description: "HTTP server port" },
  { key: "SESSION_TTL_HOURS", required: false, type: "number", defaultValue: "24", description: "Session time-to-live in hours" },
  { key: "OTP_TTL_MINUTES", required: false, type: "number", defaultValue: "10", description: "OTP code expiry in minutes" },
  { key: "PAYMENTS_ENABLED", required: false, type: "boolean", defaultValue: "true", description: "Enable payment gateway" },
  { key: "MMS_AUTO_MIGRATE", required: false, type: "boolean", defaultValue: "true", description: "Auto-apply migrations at startup" },
  { key: "MMS_SEED_ON_BOOT", required: false, type: "boolean", defaultValue: "true", description: "Seed database at startup" },
  { key: "PESAPAL_CONSUMER_KEY", required: false, type: "string", description: "Pesapal API consumer key" },
  { key: "PESAPAL_CONSUMER_SECRET", required: false, type: "string", description: "Pesapal API consumer secret" },
  { key: "PESAPAL_BASE_URL", required: false, type: "url", defaultValue: "https://cybqa.pesapal.com/pesapalv3", description: "Pesapal API base URL" },
  { key: "PESAPAL_IPN_URL", required: false, type: "url", description: "Pesapal IPN callback URL" },
  { key: "PESAPAL_IPN_ID", required: false, type: "string", description: "Pesapal IPN registration ID" },
  { key: "AFRICAS_TALKING_USERNAME", required: false, type: "string", description: "Africa's Talking API username" },
  { key: "AFRICAS_TALKING_API_KEY", required: false, type: "string", description: "Africa's Talking API key" },
  { key: "SUPABASE_URL", required: false, type: "url", description: "Supabase project URL" },
  { key: "SUPABASE_ANON_KEY", required: false, type: "string", description: "Supabase anonymous key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: false, type: "string", description: "Supabase service role key" },
  { key: "LOG_LEVEL", required: false, type: "string", defaultValue: "info", description: "Log level (debug/info/warn/error)" },
  { key: "SENTRY_DSN", required: false, type: "url", description: "Sentry DSN for error tracking" },
];

export const validateEnvVars = (): void => {
  const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
  let hasIssues = false;

  for (const field of envSchema) {
    const value = process.env[field.key];
    const isMissing = value === undefined || value.trim() === "";

    if (field.required && isMissing) {
      logger.error(`[env] Missing required environment variable: ${field.key} (${field.description})`);
      hasIssues = true;
      continue;
    }

    if (isMissing) {
      continue;
    }

    if (field.type === "url" && isProduction) {
      try {
        new URL(value);
      } catch {
        logger.warn(`[env] ${field.key} does not appear to be a valid URL`, { value: value.slice(0, 20) });
      }
    }

    if (field.type === "number" && isNaN(Number(value))) {
      logger.warn(`[env] ${field.key} should be a number, got "${value}"`);
    }
  }

  if (hasIssues) {
    logger.warn(`[env] One or more required environment variables are missing. Set them in .env or the environment.`);
  }
};
