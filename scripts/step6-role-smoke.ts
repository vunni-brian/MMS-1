import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { closeDatabase, get, getUserRecordByPhone } from "../server/lib/db.ts";

type RoleKey = "admin" | "manager" | "official" | "vendor";

type SmokeUser = {
  label: string;
  role: RoleKey;
  phone: string;
  password: string;
  requiresMfa: boolean;
  expectedHomePath: `/${RoleKey}`;
  dashboardHeading: string | RegExp;
  dashboardHeadingExact?: boolean;
  navVisible: string[];
  navHidden: string[];
};

type SmokeResult = {
  loginWorks: boolean;
  dashboardLoads: boolean;
  pages: Record<string, boolean>;
  routeProtection: Record<string, boolean>;
  navChecks: Record<string, boolean>;
  billingBehavior?: Record<string, boolean | string>;
  notes: string[];
  screenshotPath?: string;
  error?: string;
};

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const localApiUrl = process.env.SMOKE_API_URL || "http://localhost:3001/health";
const manageLocalStack = process.env.SMOKE_MANAGE_STACK !== "false" && /^http:\/\/localhost(?::\d+)?$/i.test(baseUrl);
const artifactsDir = path.resolve("runtime", "step6-smoke");

const users: SmokeUser[] = [
  {
    label: "admin",
    role: "admin",
    phone: "+256764854885",
    password: "Admin123!",
    requiresMfa: true,
    expectedHomePath: "/admin",
    dashboardHeading: "System Administration",
    dashboardHeadingExact: true,
    navVisible: ["Dashboard", "Billing & Utilities", "Reports", "Audit Log", "Coordination", "Profile"],
    navHidden: ["Stalls", "Payments & Receipts", "Notifications", "Complaints", "Vendors"],
  },
  {
    label: "manager",
    role: "manager",
    phone: "+256743180351",
    password: "Manager123!",
    requiresMfa: true,
    expectedHomePath: "/manager",
    dashboardHeading: /Good (morning|afternoon|evening),/,
    dashboardHeadingExact: false,
    navVisible: ["Dashboard", "Vendors", "Stalls", "Payments & Receipts", "Complaints", "Billing & Utilities", "Reports", "Audit Log", "Coordination", "Profile"],
    navHidden: ["Notifications"],
  },
  {
    label: "official",
    role: "official",
    phone: "+256758616651",
    password: "Official123!",
    requiresMfa: true,
    expectedHomePath: "/official",
    dashboardHeading: "National Market Oversight",
    dashboardHeadingExact: true,
    navVisible: ["Dashboard", "Billing & Utilities", "Reports", "Audit Log", "Coordination", "Profile"],
    navHidden: ["Stalls", "Payments & Receipts", "Notifications", "Complaints", "Vendors"],
  },
  {
    label: "vendor-james",
    role: "vendor",
    phone: "+256705366092",
    password: "Vendor123!",
    requiresMfa: false,
    expectedHomePath: "/vendor",
    dashboardHeading: /Good (morning|afternoon|evening),/,
    dashboardHeadingExact: false,
    navVisible: ["Dashboard", "Stalls", "Payments & Receipts", "Notifications", "Complaints", "Profile"],
    navHidden: ["Vendors", "Billing & Utilities", "Reports", "Audit Log", "Coordination"],
  },
  {
    label: "vendor-precious",
    role: "vendor",
    phone: "+256760749576",
    password: "Vendor123!",
    requiresMfa: false,
    expectedHomePath: "/vendor",
    dashboardHeading: /Good (morning|afternoon|evening),/,
    dashboardHeadingExact: false,
    navVisible: ["Dashboard", "Stalls", "Payments & Receipts", "Notifications", "Complaints", "Profile"],
    navHidden: ["Vendors", "Billing & Utilities", "Reports", "Audit Log", "Coordination"],
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ManagedProcess = {
  label: string;
  child: import("node:child_process").ChildProcess;
};

const ensureUserRecord = async (phone: string) => {
  const user = await getUserRecordByPhone(phone);
  if (!user) {
    throw new Error(`No user found for ${phone}.`);
  }
  return user;
};

const extractOtpCode = (message: string) => {
  const match = message.match(/\b(\d{6})\b/);
  return match?.[1] || null;
};

const waitForOtpCode = async (phone: string, issuedAfterIso: string) => {
  const user = await ensureUserRecord(phone);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const notification = await get<{ message: string; created_at: string }>(
      `SELECT message, created_at
       FROM notifications
       WHERE user_id = ?
         AND type = 'otp'
         AND created_at >= ?::timestamptz
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, issuedAfterIso],
    );

    const otp = notification ? extractOtpCode(notification.message) : null;
    if (otp) {
      return otp;
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for OTP notification for ${phone}.`);
};

const waitForPath = async (page: import("playwright").Page, expectedPath: string) => {
  await page.waitForURL(new RegExp(`${expectedPath.replace("/", "\\/")}(?:$|[/?#])`), { timeout: 20_000 });
};

const assertHeading = async (
  page: import("playwright").Page,
  heading: string | RegExp,
  exact = true,
) => {
  await page.getByRole("heading", { name: heading, exact: typeof heading === "string" ? exact : undefined }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
};

const linkVisible = async (page: import("playwright").Page, label: string) =>
  (await page.getByRole("link", { name: label, exact: true }).count()) > 0;

const labelVisible = async (page: import("playwright").Page, label: string) =>
  (await page.locator("label").filter({ hasText: new RegExp(`^${label}$`) }).count()) > 0;

const gotoAndCheckHeading = async (page: import("playwright").Page, pagePath: string, heading: string) => {
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded" });
  await assertHeading(page, heading);
};

const createLogHandles = (label: string) => {
  fs.mkdirSync(artifactsDir, { recursive: true });
  return {
    out: fs.openSync(path.join(artifactsDir, `${label}.out.log`), "a"),
    err: fs.openSync(path.join(artifactsDir, `${label}.err.log`), "a"),
  };
};

const waitForHttp = async (url: string, acceptedStatuses: number[] = [200]) => {
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      lastStatus = response.status;
      if (acceptedStatuses.includes(response.status)) {
        return;
      }
    } catch {
      // Ignore transient startup failures while the local stack is booting.
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for ${url}${lastStatus ? ` (last status ${lastStatus})` : ""}.`);
};

const startManagedProcess = (label: string, args: string[], env: NodeJS.ProcessEnv) => {
  const logs = createLogHandles(label);
  const child = spawn("node", args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", logs.out, logs.err],
    windowsHide: true,
  });

  return { label, child, logs };
};

const stopManagedProcesses = (processes: ManagedProcess[]) => {
  for (const processInfo of processes) {
    if (processInfo.child.exitCode !== null) {
      continue;
    }

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(processInfo.child.pid), "/t", "/f"], { stdio: "ignore" });
      continue;
    }

    processInfo.child.kill("SIGTERM");
  }
};

const startLocalStack = async () => {
  const managed: ManagedProcess[] = [];

  const api = startManagedProcess(
    "local-api",
    ["--experimental-strip-types", "server/main.ts"],
    {
      ...process.env,
      AFRICAS_TALKING_USERNAME: "",
      AFRICAS_TALKING_API_KEY: "",
      AFRICAS_TALKING_FROM: "",
    },
  );
  managed.push({ label: api.label, child: api.child });

  const web = startManagedProcess(
    "local-web",
    ["./node_modules/vite/bin/vite.js", "--host", "localhost", "--port", "8080"],
    {
      ...process.env,
      VITE_API_BASE_URL: "http://localhost:3001",
    },
  );
  managed.push({ label: web.label, child: web.child });

  try {
    await waitForHttp(localApiUrl, [200]);
    await waitForHttp(baseUrl, [200]);
  } catch (error) {
    stopManagedProcesses(managed);
    throw error;
  }

  return managed;
};

const readChargeEnabled = async (chargeTypeId: string) => {
  const row = await get<{ is_enabled: number }>(`SELECT is_enabled FROM charge_types WHERE id = ?`, [chargeTypeId]);
  if (!row) {
    throw new Error(`Charge type ${chargeTypeId} not found.`);
  }
  return Boolean(row.is_enabled);
};

const waitForChargeEnabled = async (chargeTypeId: string, expected: boolean) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await readChargeEnabled(chargeTypeId)) === expected) {
      return;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for charge type ${chargeTypeId} to become ${expected ? "enabled" : "disabled"}.`);
};

const login = async (page: import("playwright").Page, user: SmokeUser) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await assertHeading(page, "Market Management System");

  await page.locator("#phone").fill(user.phone);
  await page.locator("#password").fill(user.password);
  const otpIssuedAfter = new Date().toISOString();
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  if (user.requiresMfa) {
    await page.getByRole("heading", { name: "Verify privileged access", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    const otp = await waitForOtpCode(user.phone, otpIssuedAfter);
    await page.locator("#otp").fill(otp);
    await page.getByRole("button", { name: "Verify MFA", exact: true }).click();
  }

  await waitForPath(page, user.expectedHomePath);
  await assertHeading(page, user.dashboardHeading, user.dashboardHeadingExact ?? true);
};

const verifyNav = async (page: import("playwright").Page, user: SmokeUser, result: SmokeResult) => {
  for (const label of user.navVisible) {
    result.navChecks[`visible:${label}`] = await linkVisible(page, label);
  }
  for (const label of user.navHidden) {
    result.navChecks[`hidden:${label}`] = !(await linkVisible(page, label));
  }
};

const verifyAdminFlow = async (page: import("playwright").Page, result: SmokeResult) => {
  await gotoAndCheckHeading(page, "/admin/billing", "Billing Controls");
  const penaltiesCard = page
    .getByRole("heading", { name: "Penalties", exact: true })
    .locator("xpath=ancestor::div[contains(@class,'card-warm')][1]");
  const penaltiesButton = penaltiesCard.getByRole("button");
  const initialState = await readChargeEnabled("charge_penalties_global");
  result.billingBehavior = {
    penaltiesButtonEnabled: await penaltiesButton.isEnabled(),
    penaltiesInitialState: initialState ? "enabled" : "disabled",
  };

  await penaltiesButton.click();
  await waitForChargeEnabled("charge_penalties_global", !initialState);
  result.billingBehavior.penaltiesToggleWorked = true;

  await penaltiesButton.click();
  await waitForChargeEnabled("charge_penalties_global", initialState);
  result.billingBehavior.penaltiesRestored = true;

  await gotoAndCheckHeading(page, "/admin/reports", "Reports");
  result.pages.financialAuditVisible = (await page.getByText("Financial Audit", { exact: true }).count()) > 0;
  result.pages.reports = result.pages.financialAuditVisible;

  await gotoAndCheckHeading(page, "/admin/audit", "Audit Trail");
  result.pages.audit = (await page.getByText("Audit Events", { exact: true }).count()) > 0;

  await gotoAndCheckHeading(page, "/admin/coordination", "Manager & Official Coordination");
  result.pages.coordination = (await page.getByText("Shared Channel", { exact: true }).count()) > 0;
};

const verifyManagerFlow = async (page: import("playwright").Page, result: SmokeResult) => {
  await gotoAndCheckHeading(page, "/manager/vendors", "Vendor Directory");
  result.pages.vendors = true;

  await gotoAndCheckHeading(page, "/manager/stalls", "Stall Management");
  result.pages.stalls = true;

  await gotoAndCheckHeading(page, "/manager/payments", "Payments");
  result.pages.payments = true;

  await gotoAndCheckHeading(page, "/manager/complaints", "Complaints & Disputes");
  result.pages.complaints = true;

  await gotoAndCheckHeading(page, "/manager/billing", "Billing Controls");
  result.pages.billing = true;
  result.billingBehavior = {
    readOnlyBanner: (await page.getByText("This view is read-only for your role.", { exact: false }).count()) > 0,
    marketFilterHiddenInBilling: !(await labelVisible(page, "Market")),
    toggleDisabled: await page.getByRole("button", { name: /Charge Type/ }).first().isDisabled(),
  };

  await gotoAndCheckHeading(page, "/manager/reports", "Reports");
  result.pages.reports = !(await labelVisible(page, "Market"));

  await gotoAndCheckHeading(page, "/manager/audit", "Audit Trail");
  result.pages.audit = !(await labelVisible(page, "Market"));

  await gotoAndCheckHeading(page, "/manager/coordination", "Manager & Official Coordination");
  result.pages.coordination = true;

  await page.goto(`${baseUrl}/official`, { waitUntil: "domcontentloaded" });
  await waitForPath(page, "/manager");
  result.routeProtection["manager-blocked-from-official"] = true;
};

const verifyOfficialFlow = async (page: import("playwright").Page, result: SmokeResult) => {
  await gotoAndCheckHeading(page, "/official/billing", "Billing Controls");
  result.pages.billing = true;
  result.billingBehavior = {
    readOnlyBanner: (await page.getByText("This view is read-only for your role.", { exact: false }).count()) > 0,
    toggleDisabled: await page.getByRole("button", { name: /Charge Type/ }).first().isDisabled(),
  };

  await gotoAndCheckHeading(page, "/official/reports", "Reports");
  result.pages.reports = (await page.getByText("Financial Audit", { exact: true }).count()) > 0;

  await gotoAndCheckHeading(page, "/official/audit", "Audit Trail");
  result.pages.audit = (await page.getByText("Audit Events", { exact: true }).count()) > 0;

  await gotoAndCheckHeading(page, "/official/coordination", "Manager & Official Coordination");
  result.pages.coordination = (await page.getByText("Shared Channel", { exact: true }).count()) > 0;
  result.pages.marketFilter = (await page.getByText("All Markets", { exact: true }).count()) > 0 || (await labelVisible(page, "Market"));
};

const verifyVendorFlow = async (page: import("playwright").Page, result: SmokeResult) => {
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await waitForPath(page, "/vendor");
  result.routeProtection["vendor-blocked-from-admin"] = true;

  await page.goto(`${baseUrl}/manager/billing`, { waitUntil: "domcontentloaded" });
  await waitForPath(page, "/vendor");
  result.routeProtection["vendor-blocked-from-manager-billing"] = true;

  await gotoAndCheckHeading(page, "/vendor/stalls", "Stall Management");
  result.pages.stalls = true;

  await gotoAndCheckHeading(page, "/vendor/payments", "Payments");
  await page.getByText("Payment History & Evidence", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  result.pages.payments = true;

  await gotoAndCheckHeading(page, "/vendor/notifications", "Notifications");
  result.pages.notifications = true;

  await gotoAndCheckHeading(page, "/vendor/complaints", "Complaints & Disputes");
  result.pages.complaints = (await page.getByRole("button", { name: "New Complaint", exact: true }).count()) > 0;

  await gotoAndCheckHeading(page, "/vendor/profile", "General Information");
  result.pages.profile = (await page.getByRole("button", { name: "Save Changes", exact: true }).count()) > 0;
};

const runFlow = async (user: SmokeUser): Promise<SmokeResult> => {
  const result: SmokeResult = {
    loginWorks: false,
    dashboardLoads: false,
    pages: {},
    routeProtection: {},
    navChecks: {},
    notes: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();

  try {
    await login(page, user);
    result.loginWorks = true;
    result.dashboardLoads = true;

    await verifyNav(page, user, result);

    if (user.role === "admin") {
      await verifyAdminFlow(page, result);
    } else if (user.role === "manager") {
      await verifyManagerFlow(page, result);
    } else if (user.role === "official") {
      await verifyOfficialFlow(page, result);
    } else {
      await verifyVendorFlow(page, result);
    }

    fs.mkdirSync(artifactsDir, { recursive: true });
    const screenshotPath = path.join(artifactsDir, `${user.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshotPath = screenshotPath;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    await context.close();
    await browser.close();
  }
};

const summarize = (results: Record<string, SmokeResult>) => {
  const failures = Object.entries(results).filter(([, result]) => Boolean(result.error));
  return {
    baseUrl,
    failures: failures.map(([label, result]) => ({ label, error: result.error })),
    results,
  };
};

let managedProcesses: ManagedProcess[] = [];

try {
  managedProcesses = manageLocalStack ? await startLocalStack() : [];
  const results: Record<string, SmokeResult> = {};
  for (const user of users) {
    results[user.label] = await runFlow(user);
  }

  const summary = summarize(results);
  console.log(JSON.stringify(summary, null, 2));

  if (summary.failures.length > 0) {
    process.exitCode = 1;
  }
} finally {
  stopManagedProcesses(managedProcesses);
  await closeDatabase();
}
