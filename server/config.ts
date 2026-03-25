import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AppConfig } from "./types.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.MMS_DATA_DIR || path.join(rootDir, "runtime");
const uploadsDir = path.join(dataDir, "uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

export const config: AppConfig = {
  apiPort: Number(process.env.API_PORT || 3001),
  appUrl: process.env.APP_URL || "http://localhost:8080",
  apiUrl: process.env.API_URL || "http://localhost:3001",
  dataDir,
  uploadsDir,
  dbPath: process.env.MMS_DB_PATH || path.join(dataDir, "mms.sqlite"),
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  notificationRetryCount: Number(process.env.NOTIFICATION_RETRY_COUNT || 2),
  paymentSettlementDelayMs: Number(process.env.PAYMENT_SETTLEMENT_DELAY_MS || 5000),
  devMode: process.env.NODE_ENV !== "production",
};
