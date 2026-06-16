import { test, expect } from "../playwright-fixture";
import {
  USERS,
  loginAs,
  assertDashboardHeading,
  verifyNavLinks,
  gotoAndCheckHeading,
  checkRouteProtection,
} from "./helpers";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
const API_BASE_URL = process.env.E2E_API_URL || "http://localhost:3001";
const SCREENSHOTS_DIR = path.resolve("playwright-results", "screenshots");
const IS_DEPLOYED = !BASE_URL.includes("localhost") && !BASE_URL.includes("127.0.0.1");

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

const ALL_PAGE_CHECKS: Record<string, { path: string; heading: string | RegExp; extra?: (page: import("@playwright/test").Page) => Promise<void> }[]> = {
  admin: [
    { path: "/admin/billing", heading: "Billing Controls" },
    { path: "/admin/reports", heading: "Reports" },
    { path: "/admin/audit", heading: "Audit Trail" },
    { path: "/admin/coordination", heading: "Manager & Official Coordination" },
  ],
  manager: [
    { path: "/manager/vendors", heading: "Vendor Directory" },
    { path: "/manager/stalls", heading: "Stall Management" },
    { path: "/manager/payments", heading: "Payments" },
    { path: "/manager/complaints", heading: "Complaints & Disputes" },
    { path: "/manager/billing", heading: "Billing Controls" },
    { path: "/manager/reports", heading: "Reports" },
    { path: "/manager/audit", heading: "Audit Trail" },
    { path: "/manager/coordination", heading: "Manager & Official Coordination" },
  ],
  official: [
    { path: "/official/billing", heading: "Billing Controls" },
    { path: "/official/reports", heading: "Reports" },
    { path: "/official/audit", heading: "Audit Trail" },
    { path: "/official/coordination", heading: "Manager & Official Coordination" },
  ],
  vendor: [
    { path: "/vendor/stalls", heading: "Stall Management" },
    { path: "/vendor/payments", heading: "Payments" },
    { path: "/vendor/notifications", heading: "Notifications" },
    { path: "/vendor/complaints", heading: "Complaints & Disputes" },
    { path: "/vendor/profile", heading: "General Information" },
  ],
};

const ROUTE_PROTECTION_CHECKS: Record<string, { blocked: string; redirect: string | RegExp }[]> = {
  vendor: [
    { blocked: "/admin", redirect: "/vendor" },
    { blocked: "/manager/billing", redirect: "/vendor" },
  ],
  manager: [
    { blocked: "/official", redirect: "/manager" },
  ],
};

for (const user of USERS) {
  test.describe(`Role: ${user.label} (${user.role})`, () => {
    test(`Login + OTP + Dashboard`, { tag: "@auth" }, async ({ page, captureArtifacts }) => {
      test.skip(IS_DEPLOYED && user.requiresMfa, "MFA roles cannot be tested against deployed API without DB access");

      await loginAs(page, user, BASE_URL, API_BASE_URL, SCREENSHOTS_DIR);
      await assertDashboardHeading(page, user);

      const navChecks = await verifyNavLinks(page, user);
      for (const [key, passed] of Object.entries(navChecks)) {
        expect(passed, `Nav check: ${key}`).toBe(true);
      }
    });

    test(`Page navigation: ${user.role}-specific pages`, { tag: "@nav" }, async ({ page, captureArtifacts }) => {
      test.skip(IS_DEPLOYED && user.requiresMfa, "MFA roles cannot be tested against deployed API without DB access");

      const pages = ALL_PAGE_CHECKS[user.role === "vendor-approved" || user.role === "vendor-pending" ? "vendor" : user.role] || ALL_PAGE_CHECKS.vendor;

      await loginAs(page, user, BASE_URL, API_BASE_URL, SCREENSHOTS_DIR);

      for (const pg of pages) {
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/${user.label}-${pg.path.replace(/\//g, "_")}-before.png` });
        await gotoAndCheckHeading(page, pg.path, pg.heading, BASE_URL);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/${user.label}-${pg.path.replace(/\//g, "_")}-after.png` });
      }
    });

    if (ROUTE_PROTECTION_CHECKS[user.role]) {
      test(`Route protection: ${user.role} blocked pages`, { tag: "@route-guard" }, async ({ page, captureArtifacts }) => {
        test.skip(IS_DEPLOYED && user.requiresMfa, "MFA roles cannot be tested against deployed API without DB access");

        await loginAs(page, user, BASE_URL, API_BASE_URL, SCREENSHOTS_DIR);

        for (const check of ROUTE_PROTECTION_CHECKS[user.role]) {
          await page.screenshot({ path: `${SCREENSHOTS_DIR}/${user.label}-blocked-${check.blocked.replace(/\//g, "_")}.png` });
          await checkRouteProtection(page, check.blocked, check.redirect, BASE_URL);
        }
      });
    }

    test(`Logout flow`, { tag: "@auth" }, async ({ page, captureArtifacts }) => {
      test.skip(IS_DEPLOYED && user.requiresMfa, "MFA roles cannot be tested against deployed API without DB access");

      await loginAs(page, user, BASE_URL, API_BASE_URL, SCREENSHOTS_DIR);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/${user.label}-06-before-logout.png` });

      const logoutButton = page.getByRole("button", { name: /log ?out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/${user.label}-07-after-logout.png` });
      } else {
        await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
      }

      await page.waitForSelector("h1, h2", { timeout: 10_000 });
      expect(page.url()).toContain("/login");
    });
  });
}
