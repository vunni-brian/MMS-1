/**
 * Custom Playwright fixture that automatically captures console errors,
 * failed network requests, and page crashes during each test.
 * Artifacts are saved to disk for debugging failed E2E tests.
 */
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve("playwright-results");
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, "screenshots");

/**
 * Extended Playwright test object with automatic artifact capture.
 * During each test, console errors, failed requests, and page crashes
 * are collected, then written to disk after the test completes.
 */
export const test = base.extend<{
  captureArtifacts: void;
}>({
  captureArtifacts: [
    async ({ page }, use) => {
      const consoleErrors: string[] = [];
      const failedRequests: { url: string; status: number; method: string }[] = [];
      const pageCrashes: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      page.on("requestfailed", (req) => {
        failedRequests.push({
          url: req.url(),
          status: 0,
          method: req.method(),
        });
      });

      page.on("response", (res) => {
        if (!res.ok() && res.status() >= 400) {
          failedRequests.push({
            url: res.url(),
            status: res.status(),
            method: res.request().method(),
          });
        }
      });

      page.on("crash", () => {
        pageCrashes.push("Page crashed");
      });

      page.on("pageerror", (err) => {
        pageCrashes.push(err.message);
      });

      await use();

      const testPath = test.info().titlePath.slice(1).join(" > ");
      const safePath = testPath.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);

      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

      if (consoleErrors.length > 0) {
        fs.writeFileSync(
          path.join(SCREENSHOTS_DIR, `${safePath}-console-errors.json`),
          JSON.stringify(consoleErrors, null, 2),
        );
      }

      if (failedRequests.length > 0) {
        fs.writeFileSync(
          path.join(SCREENSHOTS_DIR, `${safePath}-failed-requests.json`),
          JSON.stringify(failedRequests, null, 2),
        );
      }

      if (pageCrashes.length > 0) {
        fs.writeFileSync(
          path.join(SCREENSHOTS_DIR, `${safePath}-page-errors.json`),
          JSON.stringify(pageCrashes, null, 2),
        );
      }
    },
    { auto: true },
  ],
});

/** Re-exported Playwright expect for use with the extended test fixture */
export { expect };
