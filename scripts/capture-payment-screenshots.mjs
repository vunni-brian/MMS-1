import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { chromium } from "playwright";

const rootDir = path.resolve(import.meta.dirname, "..");
const baseUrl = process.env.SCREENSHOT_BASE_URL || "http://localhost:8080";
const apiUrl = process.env.VITE_API_BASE_URL || "http://localhost:3001";
const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-payments`;
const outputDir = path.join(rootDir, "runtime", "ui-screenshots", stamp);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHttp = async (url, timeoutMs = 30_000) => {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
};

const startApi = async () => {
  try {
    await waitForHttp(`${apiUrl}/health`, 2_000);
    return null;
  } catch {
    const child = spawn(process.execPath, ["--experimental-strip-types", "server/main.ts"], {
      cwd: rootDir,
      env: {
        ...process.env,
        APP_URLS: "http://localhost:8080,http://127.0.0.1:8080",
        MMS_SEED_ON_BOOT: "false",
      },
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForHttp(`${apiUrl}/health`, 60_000);
    return child;
  }
};

const stopProcess = (child) => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
};

const getJson = async (url, token) => {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
};

const createPendingReceiptIfNeeded = async ({ vendorToken, managerToken, vendor, all, run, createId, persistFilePayload }) => {
  const payments = await getJson(`${apiUrl}/payments`, managerToken);
  const hasPendingReceipt = payments.payments?.some((payment) => payment.method === "receipt" && payment.status === "pending");
  if (hasPendingReceipt) return;

  const charges = await getJson(`${apiUrl}/utility-charges`, vendorToken).catch(() => ({ utilityCharges: [] }));
  const charge = charges.utilityCharges?.find((item) => ["unpaid", "overdue"].includes(item.status) && item.amount > 0);
  if (!charge) return;

  await fetch(`${apiUrl}/payments/initiate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vendorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      utilityChargeId: charge.id,
      receiptNumber: `BANK-${Date.now()}`,
      receiptNote: "Bank transfer receipt uploaded for manager approval.",
          receiptFile: {
            name: "bank-transfer-receipt.pdf",
            mimeType: "application/pdf",
            size: Buffer.byteLength("receipt proof for screenshot"),
            base64: Buffer.from("receipt proof for screenshot").toString("base64"),
          },
        }),
  }).catch(() => undefined);

  const updatedPayments = await getJson(`${apiUrl}/payments`, managerToken);
  const createdByApi = updatedPayments.payments?.some((payment) => payment.method === "receipt" && payment.status === "pending");
  if (createdByApi) return;

  const target = await all(
    `SELECT id, market_id, amount, description, billing_period
     FROM utility_charges
     WHERE vendor_id = ?
       AND amount > 0
     ORDER BY CASE WHEN status IN ('unpaid', 'overdue', 'pending') THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [vendor.id],
  );
  const utility = target[0];
  if (!utility) return;

  const paymentId = createId("payment");
  const timestamp = new Date().toISOString();
  const receiptReference = `BANK-${Date.now()}`;
  const receiptProof = "receipt proof for screenshot";
  const file = await persistFilePayload("payment-receipts", paymentId, {
    name: "bank-transfer-receipt.pdf",
    mimeType: "application/pdf",
    size: Buffer.byteLength(receiptProof),
    base64: Buffer.from(receiptProof).toString("base64"),
  });

  await run(
    `INSERT INTO payments (
       id, market_id, booking_id, utility_charge_id, penalty_id, vendor_id, provider, charge_type,
       amount, status, transaction_id, provider_reference, external_reference, phone,
       receipt_id, receipt_message, receipt_file_name, receipt_file_path, receipt_file_mime_type,
       receipt_file_size, verification_note, gateway_response_json, created_at, updated_at, completed_at
     )
     VALUES (?, ?, NULL, ?, NULL, ?, 'receipt', 'utilities', ?, 'pending', NULL, ?, ?, '', ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
    [
      paymentId,
      utility.market_id,
      utility.id,
      vendor.id,
      utility.amount,
      receiptReference,
      paymentId,
      receiptReference,
      "Bank transfer receipt uploaded for manager approval.",
      file.name,
      file.storagePath,
      file.mimeType,
      file.size,
      timestamp,
      timestamp,
    ],
  );
  await run(
    `INSERT INTO payment_attempts (id, payment_id, provider, status, created_at, updated_at)
     VALUES (?, ?, 'receipt', 'pending', ?, ?)`,
    [createId("attempt"), paymentId, timestamp, timestamp],
  );
};

const writeIndex = () => {
  fs.writeFileSync(
    path.join(outputDir, "index.html"),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment screenshots</title>
  <style>
    body { margin: 32px; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; }
    a { display: block; margin: 16px 0; color: #047857; font-weight: 700; }
    img { max-width: 100%; border: 1px solid #e2e8f0; background: #fff; }
  </style>
</head>
<body>
  <h1>Payment screenshots</h1>
  <a href="vendor-payments-bank-receipt-upload.png">Vendor bank receipt upload</a>
  <img src="vendor-payments-bank-receipt-upload.png" alt="Vendor bank receipt upload" />
  <a href="manager-payments-receipt-review.png">Manager receipt review</a>
  <img src="manager-payments-receipt-review.png" alt="Manager receipt review" />
</body>
</html>`,
    "utf8",
  );
};

fs.mkdirSync(outputDir, { recursive: true });

let apiProcess = null;

try {
  apiProcess = await startApi();
  await waitForHttp(baseUrl, 30_000);

  const { createSessionForUser } = await import("../server/lib/session.ts");
  const { all, run, createId, closeDatabase } = await import("../server/lib/db.ts");
  const { persistFilePayload } = await import("../server/lib/storage.ts");

  const users = await all("SELECT id, name, role, market_id FROM users ORDER BY role, name");
  const vendor = users.find((user) => user.role === "vendor" && (user.name || "").includes("Amina")) || users.find((user) => user.role === "vendor");
  const manager = users.find((user) => user.role === "manager" && user.market_id === vendor?.market_id) || users.find((user) => user.role === "manager") || users.find((user) => user.role === "admin");
  if (!vendor || !manager) {
    throw new Error("Missing vendor or manager user for screenshots.");
  }

  const vendorToken = await createSessionForUser(vendor.id);
  const managerToken = await createSessionForUser(manager.id);
  await createPendingReceiptIfNeeded({ vendorToken, managerToken, vendor, all, run, createId, persistFilePayload });

  const browser = await chromium.launch({ headless: true });

  const vendorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await vendorContext.addInitScript(([key, value]) => window.localStorage.setItem(key, value), ["mms.session.token", vendorToken]);
  const vendorPage = await vendorContext.newPage();
  await vendorPage.goto(`${baseUrl}/vendor/payments`, { waitUntil: "domcontentloaded" });
  await vendorPage.waitForLoadState("networkidle").catch(() => undefined);
  await vendorPage.getByRole("button", { name: /Bank Transfer/i }).click();
  await vendorPage.waitForTimeout(700);
  await vendorPage.screenshot({ path: path.join(outputDir, "vendor-payments-bank-receipt-upload.png"), fullPage: true });
  await vendorContext.close();

  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await managerContext.addInitScript(([key, value]) => window.localStorage.setItem(key, value), ["mms.session.token", managerToken]);
  const managerPage = await managerContext.newPage();
  await managerPage.goto(`${baseUrl}/manager/payments`, { waitUntil: "domcontentloaded" });
  await managerPage.waitForLoadState("networkidle").catch(() => undefined);
  await managerPage.waitForTimeout(700);
  await managerPage.screenshot({ path: path.join(outputDir, "manager-payments-receipt-review.png"), fullPage: true });
  await managerContext.close();

  await browser.close();
  await closeDatabase();
  writeIndex();

  console.log(JSON.stringify({
    outputDir,
    indexPath: path.join(outputDir, "index.html"),
    files: [
      path.join(outputDir, "vendor-payments-bank-receipt-upload.png"),
      path.join(outputDir, "manager-payments-receipt-review.png"),
    ],
  }, null, 2));
} finally {
  stopProcess(apiProcess);
}
