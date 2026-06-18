import type { Page, Request, Response } from "@playwright/test";

export interface RoleUser {
  label: string;
  role: "vendor" | "manager" | "official" | "admin";
  phone: string;
  password: string;
  requiresMfa: boolean;
  expectedHomePath: string;
  dashboardHeading: string | RegExp;
  dashboardHeadingExact: boolean;
  navVisible: string[];
  navHidden: string[];
}

export const USERS: RoleUser[] = [
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
    navVisible: [
      "Dashboard", "Vendors", "Stalls", "Payments & Receipts",
      "Complaints", "Billing & Utilities", "Reports", "Audit Log",
      "Coordination", "Profile",
    ],
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
    label: "vendor-approved",
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
    label: "vendor-pending",
    role: "vendor",
    phone: "+256770200300",
    password: "Vendor123!",
    requiresMfa: false,
    expectedHomePath: "/vendor",
    dashboardHeading: /Good (morning|afternoon|evening),/,
    dashboardHeadingExact: false,
    navVisible: ["Dashboard", "Stalls", "Payments & Receipts", "Notifications", "Complaints", "Profile"],
    navHidden: ["Vendors", "Billing & Utilities", "Reports", "Audit Log", "Coordination"],
  },
];

export const DELAY = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function loginAs(
  page: Page,
  user: RoleUser,
  baseUrl: string,
  apiBaseUrl: string,
  screenshotsDir: string,
): Promise<string | null> {
  const label = user.label;
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });

  await page.waitForSelector("h1, h2", { timeout: 15_000 });
  await page.screenshot({ path: `${screenshotsDir}/${label}-01-login-page.png` });

  await page.locator("#phone").fill(user.phone);
  await page.locator("#password").fill(user.password);
  await page.screenshot({ path: `${screenshotsDir}/${label}-02-login-filled.png` });

  let loginResponseChallengeId: string | undefined;

  if (user.requiresMfa) {
    loginResponseChallengeId = await new Promise<string | undefined>((resolve) => {
      page.on("response", async (res: Response) => {
        const req = res.request();
        if (req.method() === "POST" && req.url().includes("/auth/login")) {
          try {
            const body = await res.json();
            if (body?.mfaRequired && body?.challengeId) {
              resolve(body.challengeId);
              return;
            }
          } catch {
            // ignore parse errors
          }
          resolve(undefined);
        }
      });
      // Timeout safety
      setTimeout(() => resolve(undefined), 15_000);
    });
  }

  await page.getByRole("button", { name: /sign ?in/i, exact: true }).click();

  if (user.requiresMfa) {
    await page.waitForSelector("text=Verify privileged access", { timeout: 20_000 });
    await page.screenshot({ path: `${screenshotsDir}/${label}-03-mfa-challenge.png` });

    const otp = await extractOtpFromApi(user.phone, apiBaseUrl, loginResponseChallengeId);
    if (!otp) {
      throw new Error(`Could not extract OTP for ${user.label} (${user.phone})`);
    }

    await page.locator("#otp").fill(otp);
    await page.screenshot({ path: `${screenshotsDir}/${label}-04-mfa-filled.png` });

    await page.getByRole("button", { name: /verify mfa/i, exact: true }).click();
  }

  await page.waitForURL(new RegExp(`${user.expectedHomePath.replace("/", "\\/")}(?:$|[/?#])`), { timeout: 30_000 });
  await page.screenshot({ path: `${screenshotsDir}/${label}-05-dashboard.png` });

  return page.url();
}

export async function assertDashboardHeading(page: Page, user: RoleUser) {
  if (typeof user.dashboardHeading === "string" && user.dashboardHeadingExact) {
    await page.getByRole("heading", { name: user.dashboardHeading, exact: true }).waitFor({
      state: "visible",
      timeout: 10_000,
    });
  } else {
    await page.getByRole("heading").filter({ hasText: user.dashboardHeading }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });
  }
}

export async function verifyNavLinks(page: Page, user: RoleUser): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {};
  for (const label of user.navVisible) {
    checks[`visible:${label}`] = (await page.getByRole("link", { name: label, exact: true }).count()) > 0;
  }
  for (const label of user.navHidden) {
    checks[`hidden:${label}`] = (await page.getByRole("link", { name: label, exact: true }).count()) === 0;
  }
  return checks;
}

export async function gotoAndCheckHeading(
  page: Page,
  pagePath: string,
  heading: string | RegExp,
  baseUrl: string,
  timeout = 15_000,
) {
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "domcontentloaded", timeout });
  const headingEl = typeof heading === "string"
    ? page.getByRole("heading", { name: heading, exact: true })
    : page.getByRole("heading").filter({ hasText: heading }).first();
  await headingEl.waitFor({ state: "visible", timeout });
}

export async function checkRouteProtection(
  page: Page,
  blockedPath: string,
  expectedRedirect: string | RegExp,
  baseUrl: string,
) {
  await page.goto(`${baseUrl}${blockedPath}`, { waitUntil: "domcontentloaded" });
  if (typeof expectedRedirect === "string") {
    await page.waitForURL(new RegExp(expectedRedirect.replace("/", "\\/")), { timeout: 15_000 });
  } else {
    await page.waitForURL(expectedRedirect, { timeout: 15_000 });
  }
}

async function extractOtpFromApi(phone: string, apiBaseUrl: string, challengeId?: string): Promise<string | null> {
  // For deployed API, use the debug/sandbox OTP endpoint
  if (!apiBaseUrl.includes("localhost") && !apiBaseUrl.includes("127.0.0.1")) {
    if (challengeId) {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/debug/otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId }),
        });
        if (response.ok) {
          const data = await response.json() as { code?: string };
          if (data?.code) return data.code;
        }
        console.warn(`[OTP] Debug endpoint returned ${response.status} for challenge ${challengeId}`);
      } catch (err) {
        console.warn(`[OTP] Failed to call debug endpoint:`, err);
      }
    }
    return null;
  }

  // Local: use DB directly
  if (process.env.DATABASE_URL) {
    try {
      const { get, getUserRecordByPhone } = await import("../server/lib/db.ts");
      const user = await getUserRecordByPhone(phone);
      if (!user) throw new Error(`User not found: ${phone}`);

      const issuedAfter = new Date(Date.now() - 120_000).toISOString();
      for (let attempt = 0; attempt < 15; attempt++) {
        const notification = await get<{ message: string }>(
          `SELECT message FROM notifications WHERE user_id = ? AND type = 'otp' AND created_at >= ?::timestamptz ORDER BY created_at DESC LIMIT 1`,
          [user.id, issuedAfter],
        );
        if (notification) {
          const match = notification.message.match(/\b(\d{6})\b/);
          if (match) return match[1];
        }
        await DELAY(1_000);
      }
      throw new Error("Timed out waiting for OTP notification");
    } catch (err) {
      console.warn(`[OTP] Local DB extraction failed:`, err);
      return null;
    }
  }

  return null;
}
