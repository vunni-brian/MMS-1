import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { all, closeDatabase } from "../server/lib/db.ts";

const baseUrl = "http://127.0.0.1:5173";
const outputRoot = path.resolve("runtime", "ui-runthrough", new Date().toISOString().replace(/[:.]/g, "-"));

const accounts = {
  vendor: { phone: "+256700100200", password: "Vendor123!", home: "/vendor" },
  manager: { phone: "+256700500600", password: "Manager123!", home: "/manager" },
  official: { phone: "+256700600700", password: "Official123!", home: "/official" },
  admin: { phone: "+256701111222", password: "Admin123!", home: "/admin" },
};

const routes = {
  public: ["/", "/login", "/register", "/payments/callback", "/not-a-real-route"],
  vendor: ["/vendor", "/vendor/stalls", "/vendor/payments", "/vendor/complaints", "/vendor/announcements", "/vendor/settings", "/vendor/profile"],
  manager: [
    "/manager",
    "/manager/vendors",
    "/manager/stalls",
    "/manager/payments",
    "/manager/complaints",
    "/manager/billing",
    "/manager/reports",
    "/manager/audit",
    "/manager/coordination",
    "/manager/announcements",
    "/manager/settings",
    "/manager/profile",
  ],
  official: ["/official", "/official/billing", "/official/reports", "/official/audit", "/official/coordination", "/official/announcements", "/official/settings", "/official/profile"],
  admin: [
    "/admin",
    "/admin/users",
    "/admin/markets",
    "/admin/alerts",
    "/admin/integrations",
    "/admin/settings",
    "/admin/billing",
    "/admin/reports",
    "/admin/audit",
    "/admin/coordination",
    "/admin/announcements",
    "/admin/profile",
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slug = (value) => value.replace(/^\/$/, "home").replace(/^\//, "").replace(/[/?=&]+/g, "-") || "home";

const latestOtpForPhone = async (phone, sinceIso) => {
  const rows = await all(
    `SELECT notifications.message, notifications.created_at
     FROM notifications
     JOIN users ON users.id = notifications.user_id
     WHERE notifications.type = 'otp'
       AND users.phone = ?
       AND notifications.created_at >= ?
     ORDER BY notifications.created_at DESC
     LIMIT 1`,
    [phone, sinceIso],
  );
  const match = rows[0]?.message?.match(/\b(\d{6})\b/);
  if (!match) {
    throw new Error(`No OTP found for ${phone}`);
  }
  return match[1];
};

const pageSignals = async (page) => {
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const headings = await page.locator("h1, h2").evaluateAll((nodes) =>
    nodes
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .slice(0, 6),
  );
  const visibleProblemText = [
    "Something went wrong",
    "Unable to load",
    "Request failed",
    "Route not found.",
    "Invalid phone number or password",
    "No matching settings",
  ].filter((needle) => text.includes(needle));

  return {
    title: await page.title(),
    url: page.url(),
    headings,
    textLength: text.length,
    textSample: text.replace(/\s+/g, " ").slice(0, 360),
    visibleProblemText,
  };
};

const createTrackedPage = async (browser, role) => {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || "unknown";
    requestFailures.push({ url, failure });
  });

  return { page, role, consoleErrors, pageErrors, requestFailures };
};

const login = async (tracked, account) => {
  const { page } = tracked;
  const loginStartedAt = new Date(Date.now() - 2000).toISOString();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#phone").fill(account.phone);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Sign In Securely" }).click();
  await sleep(2500);

  if (page.url().includes("/login") && (await page.locator("#otp").count())) {
    const otp = await latestOtpForPhone(account.phone, loginStartedAt);
    await page.locator("#otp").fill(otp);
    await page.getByRole("button", { name: "Verify Securely" }).click();
  }

  await page.waitForURL(`**${account.home}`, { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await sleep(1500);
};

const inspectRoute = async (tracked, route) => {
  const { page, role, consoleErrors, pageErrors, requestFailures } = tracked;
  const errorStart = consoleErrors.length;
  const pageErrorStart = pageErrors.length;
  const failureStart = requestFailures.length;

  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await sleep(1300);

  const screenshot = path.join(outputRoot, role, `${slug(route)}.png`);
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });

  const failedRequests = requestFailures
    .slice(failureStart)
    .filter((entry) => !entry.url.includes("fonts.googleapis.com") && !entry.url.includes("fonts.gstatic.com"));

  return {
    role,
    route,
    screenshot,
    ...(await pageSignals(page)),
    consoleErrors: consoleErrors.slice(errorStart),
    pageErrors: pageErrors.slice(pageErrorStart),
    failedRequests,
  };
};

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  const publicTracked = await createTrackedPage(browser, "public");
  for (const route of routes.public) {
    results.push(await inspectRoute(publicTracked, route));
  }
  await publicTracked.page.close();

  for (const role of ["vendor", "manager", "official", "admin"]) {
    const tracked = await createTrackedPage(browser, role);
    await login(tracked, accounts[role]);
    for (const route of routes[role]) {
      results.push(await inspectRoute(tracked, route));
    }
    await tracked.page.close();
  }
} finally {
  await browser.close();
  await closeDatabase();
}

const report = {
  baseUrl,
  outputRoot,
  checkedAt: new Date().toISOString(),
  results,
  issueCount: results.filter((result) =>
    result.visibleProblemText.length || result.consoleErrors.length || result.pageErrors.length || result.failedRequests.length
  ).length,
};

await fs.writeFile(path.join(outputRoot, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
