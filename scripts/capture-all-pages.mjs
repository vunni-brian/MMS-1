/**
 * capture-all-pages.mjs
 *
 * Captures full-page screenshots of every route in the MMS application
 * for all four roles (vendor, manager, official, admin) plus the public pages.
 *
 * Prerequisites:
 *   1. npm run build          — build the frontend into dist/
 *   2. API must be reachable at http://localhost:3001 (starts automatically below)
 *   3. npx playwright install chromium  — if not already installed
 *
 * Usage:
 *   node scripts/capture-all-pages.mjs
 *
 * Output:
 *   docs/Pages/<role>/<page-name>.png
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

import { chromium } from "@playwright/test";

// ─── Config ──────────────────────────────────────────────
const rootDir    = path.resolve(import.meta.dirname, "..");
const outputDir  = path.join(rootDir, "docs", "Pages");
const apiUrl     = "http://localhost:3001";
const webUrl     = "http://localhost:8080";
const distDir    = path.join(rootDir, "dist");
const TOKEN_KEY  = "mms.session.token";
const VIEWPORT   = { width: 1440, height: 900 };

// ─── Route manifest ───────────────────────────────────────
// Each entry: { role, folder, path, file, waitFor?, width? }
const pages = [
  // ── Public ──────────────────────────────────────────────
  { role: "public", folder: "public", path: "/",               file: "01-landing.png",            waitFor: "h1" },
  { role: "public", folder: "public", path: "/login",          file: "02-login.png",               waitFor: "form" },
  { role: "public", folder: "public", path: "/register",       file: "03-register.png",            waitFor: "form" },

  // ── Vendor ──────────────────────────────────────────────
  { role: "vendor", folder: "vendor", path: "/vendor",              file: "01-dashboard.png" },
  { role: "vendor", folder: "vendor", path: "/vendor/stalls",       file: "02-stalls.png" },
  { role: "vendor", folder: "vendor", path: "/vendor/payments",     file: "03-payments.png" },
  { role: "vendor", folder: "vendor", path: "/vendor/complaints",   file: "04-complaints.png" },
  { role: "vendor", folder: "vendor", path: "/vendor/announcements",file: "05-announcements.png" },
  { role: "vendor", folder: "vendor", path: "/vendor/profile",      file: "06-profile.png" },

  // ── Manager ─────────────────────────────────────────────
  { role: "manager", folder: "manager", path: "/manager",               file: "01-dashboard.png" },
  { role: "manager", folder: "manager", path: "/manager/vendors",       file: "02-vendors.png" },
  { role: "manager", folder: "manager", path: "/manager/stalls",        file: "03-stalls.png" },
  { role: "manager", folder: "manager", path: "/manager/payments",      file: "04-payments.png" },
  { role: "manager", folder: "manager", path: "/manager/complaints",    file: "05-complaints.png" },
  { role: "manager", folder: "manager", path: "/manager/billing",       file: "06-billing.png" },
  { role: "manager", folder: "manager", path: "/manager/reports",       file: "07-reports.png" },
  { role: "manager", folder: "manager", path: "/manager/coordination",  file: "08-coordination.png" },
  { role: "manager", folder: "manager", path: "/manager/announcements", file: "09-announcements.png" },
  { role: "manager", folder: "manager", path: "/manager/audit",         file: "10-audit.png" },
  { role: "manager", folder: "manager", path: "/manager/profile",       file: "11-profile.png" },

  // ── Official ─────────────────────────────────────────────
  { role: "official", folder: "official", path: "/official",               file: "01-dashboard.png" },
  { role: "official", folder: "official", path: "/official/billing",       file: "02-billing.png" },
  { role: "official", folder: "official", path: "/official/reports",       file: "03-reports.png" },
  { role: "official", folder: "official", path: "/official/audit",         file: "04-audit.png" },
  { role: "official", folder: "official", path: "/official/coordination",  file: "05-coordination.png" },
  { role: "official", folder: "official", path: "/official/announcements", file: "06-announcements.png" },
  { role: "official", folder: "official", path: "/official/profile",       file: "07-profile.png" },

  // ── Admin ────────────────────────────────────────────────
  { role: "admin", folder: "admin", path: "/admin",               file: "01-dashboard.png" },
  { role: "admin", folder: "admin", path: "/admin/users",         file: "02-users.png" },
  { role: "admin", folder: "admin", path: "/admin/markets",       file: "03-markets.png" },
  { role: "admin", folder: "admin", path: "/admin/billing",       file: "04-billing.png" },
  { role: "admin", folder: "admin", path: "/admin/reports",       file: "05-reports.png" },
  { role: "admin", folder: "admin", path: "/admin/alerts",        file: "06-alerts.png" },
  { role: "admin", folder: "admin", path: "/admin/audit",         file: "07-audit.png" },
  { role: "admin", folder: "admin", path: "/admin/coordination",  file: "08-coordination.png" },
  { role: "admin", folder: "admin", path: "/admin/announcements", file: "09-announcements.png" },
  { role: "admin", folder: "admin", path: "/admin/integrations",  file: "10-integrations.png" },
  { role: "admin", folder: "admin", path: "/admin/settings",      file: "11-settings.png" },
  { role: "admin", folder: "admin", path: "/admin/profile",       file: "12-profile.png" },
];

// ─── Account preferences ─────────────────────────────────
const preferredAccounts = {
  vendor:   ["Amina Nakato", "Grace Auma", "Joseph Ochieng"],
  manager:  ["Kigozi Duncan", "Sarah Namutebi", "Brian Waiswa"],
  official: ["Nassanga Shakirah Kakembo", "David Lubega"],
  admin:    ["Vunni Brian", "Ruth Nansubuga"],
};

// ─── Infra helpers ────────────────────────────────────────
const childProcesses = [];
let webServer;

const startProcess = (label, args, env = {}) => {
  const logPath = path.join(outputDir, `${label}.log`);
  const out = fs.openSync(logPath, "w");
  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  childProcesses.push({ label, child });
  return child;
};

const stopAll = () => {
  webServer?.close();
  for (const { child } of childProcesses.reverse()) {
    if (!child.killed) child.kill();
  }
};

const contentTypes = {
  ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon",
  ".js": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

const createStaticServer = () =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
      reject(new Error("dist/index.html not found. Run: npm run build"));
      return;
    }
    webServer = http.createServer((req, res) => {
      const url   = new URL(req.url || "/", webUrl);
      const safe  = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      let   fPath = path.join(distDir, safe === "/" ? "index.html" : safe);
      if (!fPath.startsWith(distDir) || !fs.existsSync(fPath) || fs.statSync(fPath).isDirectory()) {
        fPath = path.join(distDir, "index.html");
      }
      res.setHeader("Content-Type", contentTypes[path.extname(fPath)] || "application/octet-stream");
      fs.createReadStream(fPath).pipe(res);
    });
    webServer.once("error", reject);
    webServer.listen(8080, "localhost", resolve);
  });

const waitForUrl = async (url, ms = 90_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const resolveUser = (users, role) => {
  const candidates = users.filter((u) => u.role === role);
  const preferred  = preferredAccounts[role] || [];
  return (
    preferred.map((name) => candidates.find((u) => u.name.toLowerCase() === name.toLowerCase())).find(Boolean)
    || candidates[0]
  );
};

// ─── Main ─────────────────────────────────────────────────
let totalCaptured = 0;
let totalFailed   = 0;

try {
  // Create output directories
  const folders = [...new Set(pages.map((p) => p.folder))];
  for (const folder of folders) {
    fs.mkdirSync(path.join(outputDir, folder), { recursive: true });
  }

  console.log("▶ Starting API server...");
  startProcess("api", ["--experimental-strip-types", "server/main.ts"], {
    MMS_SEED_ON_BOOT: "false",
  });

  console.log("▶ Starting static web server...");
  await createStaticServer();

  console.log("▶ Waiting for services to be ready...");
  await waitForUrl(`${apiUrl}/health`);
  await waitForUrl(webUrl);
  console.log("✓ Services ready\n");

  // Load server-side utilities
  const { createSessionForUser } = await import("../server/lib/session.ts");
  const { all, closeDatabase }   = await import("../server/lib/db.ts");
  const users = await all("SELECT id, name, role FROM users ORDER BY role, name");

  // Pre-create tokens for each role
  const tokens = {};
  for (const role of ["vendor", "manager", "official", "admin"]) {
    const account = resolveUser(users, role);
    if (account) {
      tokens[role] = await createSessionForUser(account.id);
      console.log(`✓ Session created for ${role}: ${account.name}`);
    } else {
      console.warn(`⚠ No ${role} user found — pages for this role will be skipped`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  console.log(`\n📸 Capturing ${pages.length} pages...\n`);

  for (const entry of pages) {
    const outPath = path.join(outputDir, entry.folder, entry.file);
    const label   = `${entry.folder}/${entry.file}`;

    try {
      const context = await browser.newContext({
        viewport: { width: entry.width || VIEWPORT.width, height: VIEWPORT.height },
        deviceScaleFactor: 1.5, // retina-quality output
      });

      // Inject session token for authenticated pages
      if (entry.role !== "public" && tokens[entry.role]) {
        await context.addInitScript(
          ([key, val]) => window.localStorage.setItem(key, val),
          [TOKEN_KEY, tokens[entry.role]],
        );
      }

      const page = await context.newPage();

      // Suppress console errors from appearing in terminal
      page.on("console", () => {});
      page.on("pageerror", () => {});

      await page.goto(`${webUrl}${entry.path}`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      // Wait for the page to finish rendering
      const waitSelector = entry.waitFor || "h1, [data-page-kind], .enterprise-page, .min-h-screen";
      await page.locator(waitSelector).first().waitFor({ timeout: 15_000 }).catch(() => {});

      // Extra settle time for data-driven pages
      await page.waitForTimeout(1_200);

      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`  ✓ ${label}`);
      totalCaptured++;

      await context.close();
    } catch (err) {
      console.error(`  ✗ ${label} — ${err instanceof Error ? err.message : String(err)}`);
      totalFailed++;
    }
  }

  await browser.close();
  await closeDatabase();

  // Write an index file
  const indexLines = [
    "# MMS — Page Screenshots Index",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Captured: ${totalCaptured} / ${pages.length} pages`,
    "",
  ];

  let currentFolder = "";
  for (const entry of pages) {
    if (entry.folder !== currentFolder) {
      currentFolder = entry.folder;
      indexLines.push(`\n## ${currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)}`);
    }
    const outPath = path.join(outputDir, entry.folder, entry.file);
    const exists  = fs.existsSync(outPath) ? "✓" : "✗";
    indexLines.push(`- ${exists} ${entry.file.replace(".png", "")} → ${entry.path}`);
  }

  fs.writeFileSync(path.join(outputDir, "INDEX.md"), indexLines.join("\n"));

  console.log(`\n✅ Done — ${totalCaptured} captured, ${totalFailed} failed`);
  console.log(`📁 Output folder: ${outputDir}`);
  console.log(`📋 Index:         ${path.join(outputDir, "INDEX.md")}`);
} catch (err) {
  console.error("\n❌ Fatal error:", err instanceof Error ? err.message : String(err));
} finally {
  stopAll();
}
