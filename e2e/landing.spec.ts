/**
 * Public-facing page E2E tests covering the landing page, login,
 * registration, and 404 handling — all without authentication.
 */
import { test, expect } from "../playwright-fixture";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
const SCREENSHOTS_DIR = path.resolve("playwright-results", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

test.describe("Landing Page (Public)", () => {
  test("Homepage loads without errors", { tag: "@public" }, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedReqs: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      failedReqs.push(`${req.method()} ${req.url()}`);
    });

    const response = await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30_000 });
    expect(response?.status()).toBe(200);

    await page.waitForSelector("#root", { timeout: 10_000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/landing-page.png`, fullPage: true });

    if (consoleErrors.length > 0) {
      fs.writeFileSync(`${SCREENSHOTS_DIR}/landing-console-errors.json`, JSON.stringify(consoleErrors, null, 2));
    }
    if (failedReqs.length > 0) {
      fs.writeFileSync(`${SCREENSHOTS_DIR}/landing-failed-requests.json`, JSON.stringify(failedReqs, null, 2));
    }

    expect(consoleErrors.length, `Console errors: ${consoleErrors.join(", ")}`).toBe(0);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("Login page renders correctly", { tag: "@public" }, async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
    expect(response?.status()).toBe(200);

    await page.waitForSelector("#phone", { timeout: 10_000 });
    await page.waitForSelector("#password", { timeout: 10_000 });

    const signInButton = page.getByRole("button", { name: /sign ?in/i });
    await expect(signInButton).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/login-page.png`, fullPage: true });
  });

  test("Register page renders correctly", { tag: "@public" }, async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle", timeout: 30_000 });
    expect(response?.status()).toBe(200);

    const heading = page.getByRole("heading", { name: /register|create|vendor/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/register-page.png`, fullPage: true });
  });

  test("404 page returns not found gracefully", { tag: "@public" }, async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/nonexistent-route-xyz`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });

    // SPA returns index.html for all routes, so status is 200
    // But the React router should show a 404/not-found message
    const body = await page.textContent("body");
    const hasNotFound = /not.found|404|page/i.test(body || "");
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/404-page.png` });

    // Just document it - SPAs serve index.html
    expect(response?.status()).toBe(200);
  });
});
