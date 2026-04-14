import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AppConfig } from "./types.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7) : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadEnvFile(path.join(rootDir, ".env"));

const appName = process.env.APP_NAME?.trim() || "MMS";
const appUrls = (process.env.APP_URL || "http://localhost:8080")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const primaryAppUrl = appUrls[0] || "http://localhost:8080";
const normalizePhoneValue = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, "") || null;
  return normalized || null;
};
const africasTalkingUseSandbox = process.env.AFRICAS_TALKING_USE_SANDBOX === "true";
const dataDir = process.env.MMS_DATA_DIR || path.join(rootDir, "runtime");
const uploadsDir = path.join(dataDir, "uploads");
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mms";
const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL?.trim() || null;
const inferredSsl = /supabase\.(co|com)|sslmode=require/i.test(databaseUrl) || Boolean(migrationDatabaseUrl && /supabase\.(co|com)|sslmode=require/i.test(migrationDatabaseUrl));
const databaseSsl = process.env.DATABASE_SSL ? process.env.DATABASE_SSL === "true" : inferredSsl;
const autoMigrate = process.env.MMS_AUTO_MIGRATE !== "false";
const seedOnBoot =
  process.env.MMS_SEED_ON_BOOT === "true" ||
  (process.env.MMS_SEED_ON_BOOT !== "false" && process.env.NODE_ENV !== "production");
const supabaseUrl = process.env.SUPABASE_URL?.trim() || null;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || null;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "mms-uploads";
const supabaseAuthEnabled = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);
const supabaseStorageEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey && supabaseStorageBucket);
const africasTalkingUsername =
  process.env.AFRICAS_TALKING_USERNAME?.trim() || (africasTalkingUseSandbox ? "sandbox" : null);
const africasTalkingApiKey = process.env.AFRICAS_TALKING_API_KEY?.trim() || null;
const africasTalkingFrom =
  normalizePhoneValue(process.env.AFRICAS_TALKING_FROM) || process.env.AFRICAS_TALKING_FROM?.trim() || null;
const africasTalkingSmsEnabled = Boolean(africasTalkingUsername && africasTalkingApiKey);

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

export const config: AppConfig = {
  apiPort: Number(process.env.PORT || process.env.API_PORT || 3001),
  appName,
  appUrl: primaryAppUrl,
  appUrls,
  apiUrl: process.env.API_URL || "http://localhost:3001",
  dataDir,
  uploadsDir,
  databaseUrl,
  migrationDatabaseUrl,
  databaseSsl,
  autoMigrate,
  seedOnBoot,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseStorageBucket,
  supabaseAuthEnabled,
  supabaseStorageEnabled,
  africasTalkingUsername,
  africasTalkingApiKey,
  africasTalkingFrom,
  africasTalkingUseSandbox,
  africasTalkingSmsEnabled,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  otpRegistrationMessageTemplate: process.env.OTP_REGISTRATION_MESSAGE_TEMPLATE?.trim() || null,
  otpLoginMessageTemplate: process.env.OTP_LOGIN_MESSAGE_TEMPLATE?.trim() || null,
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  notificationRetryCount: Number(process.env.NOTIFICATION_RETRY_COUNT || 2),
  paymentSettlementDelayMs: Number(process.env.PAYMENT_SETTLEMENT_DELAY_MS || 5000),
  devMode: process.env.NODE_ENV !== "production",
};
