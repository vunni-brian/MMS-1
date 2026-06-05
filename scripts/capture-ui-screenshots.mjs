import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { chromium } from "playwright";

const rootDir = path.resolve(import.meta.dirname, "..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(rootDir, "runtime", "ui-screenshots", stamp);
const distDir = path.join(rootDir, "dist");
const sessionTokenKey = "mms.session.token";
const defaultBaseUrl = process.env.SCREENSHOT_BASE_URL || "http://127.0.0.1:5173";
const fallbackBaseUrl = process.env.SCREENSHOT_FALLBACK_BASE_URL || "http://127.0.0.1:8081";
const apiHealthUrl = process.env.SCREENSHOT_API_HEALTH_URL || "http://127.0.0.1:3001/health";
const apiBaseUrl = process.env.VITE_API_BASE_URL || "http://127.0.0.1:3001";

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

const roleUsers = {
  vendor: {
    phone: "+256700100200",
    names: ["Amina Nakato", "James", "Precious"],
  },
  manager: {
    phone: "+256743180351",
    names: ["Kigozi Duncan", "Sarah Namutebi", "Brian Waiswa"],
  },
  official: {
    phone: "+256758616651",
    names: ["Nassanga Shakirah Kakembo", "David Lubega"],
  },
  admin: {
    phone: "+256764854885",
    names: ["Vunni Brian", "Ruth Nansubuga"],
  },
};

const publicScreens = [
  { group: "public", name: "home", path: "/" },
  { group: "public", name: "login", path: "/login" },
  { group: "public", name: "register", path: "/register" },
  { group: "public", name: "payment-callback", path: "/payments/callback" },
  { group: "public", name: "not-found", path: "/missing-route-for-screenshot" },
];

const roleScreens = {
  vendor: [
    { name: "dashboard", path: "/vendor" },
    { name: "my-stall", path: "/vendor/stalls" },
    { name: "payments", path: "/vendor/payments" },
    { name: "complaints", path: "/vendor/complaints" },
    { name: "notices", path: "/vendor/announcements" },
    { name: "notifications", path: "/vendor/notifications" },
    { name: "profile", path: "/vendor/profile" },
  ],
  manager: [
    { name: "dashboard", path: "/manager" },
    { name: "vendors", path: "/manager/vendors" },
    { name: "stalls", path: "/manager/stalls" },
    { name: "payments", path: "/manager/payments" },
    { name: "complaints", path: "/manager/complaints" },
    { name: "billing", path: "/manager/billing" },
    { name: "reports", path: "/manager/reports" },
    { name: "audit", path: "/manager/audit" },
    { name: "coordination", path: "/manager/coordination" },
    { name: "notices", path: "/manager/announcements" },
    { name: "notifications", path: "/manager/notifications" },
    { name: "profile", path: "/manager/profile" },
  ],
  official: [
    { name: "dashboard", path: "/official" },
    { name: "billing", path: "/official/billing" },
    { name: "reports", path: "/official/reports" },
    { name: "audit", path: "/official/audit" },
    { name: "coordination", path: "/official/coordination" },
    { name: "resources", path: "/official/announcements" },
    { name: "notifications", path: "/official/notifications" },
    { name: "profile", path: "/official/profile" },
  ],
  admin: [
    { name: "dashboard", path: "/admin" },
    { name: "users", path: "/admin/users" },
    { name: "roles-permissions", path: "/admin/users?tab=roles" },
    { name: "markets", path: "/admin/markets" },
    { name: "system-health", path: "/admin/alerts" },
    { name: "integrations", path: "/admin/integrations" },
    { name: "settings", path: "/admin/settings" },
    { name: "billing-controls", path: "/admin/billing" },
    { name: "reports", path: "/admin/reports" },
    { name: "audit-logs", path: "/admin/audit" },
    { name: "coordination", path: "/admin/coordination" },
    { name: "notices", path: "/admin/announcements" },
    { name: "notifications", path: "/admin/notifications" },
    { name: "profile", path: "/admin/profile" },
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const waitForHttp = async (url, acceptedStatuses = [200], timeoutMs = 20_000) => {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (acceptedStatuses.includes(response.status)) {
        return true;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  return lastError || "timed out";
};

const createStaticServer = () =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
      reject(new Error("dist/index.html was not found. Run npm run build before using the fallback server."));
      return;
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", fallbackBaseUrl);
      const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      let filePath = path.join(distDir, safePath === "/" ? "index.html" : safePath);

      if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html");
      }

      res.setHeader("Content-Type", contentTypes[path.extname(filePath)] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });

    server.once("error", reject);
    server.listen(new URL(fallbackBaseUrl).port || 8081, new URL(fallbackBaseUrl).hostname, () => resolve(server));
  });

const startProcess = (label, args, env = {}) => {
  const out = fs.openSync(path.join(outputDir, `${label}.out.log`), "w");
  const err = fs.openSync(path.join(outputDir, `${label}.err.log`), "w");
  return spawn(process.execPath, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    stdio: ["ignore", out, err],
    windowsHide: true,
  });
};

const stopProcess = (child) => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
};

const getBaseUrl = async () => {
  const ready = await waitForHttp(defaultBaseUrl, [200], 5_000);
  if (ready === true) {
    return { baseUrl: defaultBaseUrl, staticServer: null };
  }

  const staticServer = await createStaticServer();
  const fallbackReady = await waitForHttp(fallbackBaseUrl, [200], 10_000);
  if (fallbackReady !== true) {
    throw new Error(`Fallback web server did not start: ${fallbackReady}`);
  }
  return { baseUrl: fallbackBaseUrl, staticServer };
};

const getApi = async () => {
  const ready = await waitForHttp(apiHealthUrl, [200], 5_000);
  if (ready === true) {
    return null;
  }

  const screenshotOrigins = [defaultBaseUrl, fallbackBaseUrl].join(",");
  const child = startProcess("api", ["--experimental-strip-types", "server/main.ts"], {
    APP_URLS: screenshotOrigins,
    VITE_API_BASE_URL: apiBaseUrl,
    MMS_SEED_ON_BOOT: "false",
  });
  const apiReady = await waitForHttp(apiHealthUrl, [200], 60_000);
  if (apiReady !== true) {
    stopProcess(child);
    throw new Error(`API did not start: ${apiReady}`);
  }
  return child;
};

const normalizePhone = (phone) => phone.replace(/\s+/g, "");

const chooseUser = (users, role) => {
  const spec = roleUsers[role];
  const roleMatches = users.filter((user) => user.role === role);
  const byPhone = roleMatches.find((user) => normalizePhone(user.phone || "") === normalizePhone(spec.phone));
  if (byPhone) return byPhone;

  for (const name of spec.names) {
    const byName = roleMatches.find((user) => (user.name || "").toLowerCase().includes(name.toLowerCase()));
    if (byName) return byName;
  }

  const fallback = roleMatches[0];
  if (!fallback) {
    throw new Error(`No ${role} user found in the database.`);
  }
  return fallback;
};

const waitForStablePage = async (page) => {
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(650);
};

const capture = async (page, baseUrl, item) => {
  const url = `${baseUrl}${item.path}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await waitForStablePage(page);

  const fileName = `${item.group}-${item.name}.png`;
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });

  return {
    ...item,
    url: page.url(),
    fileName,
    filePath,
    title: await page.title(),
  };
};

const writeIndex = (results) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MMS UI Screenshots</title>
  <style>
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, Arial, sans-serif; }
    main { max-width: 1280px; margin: 0 auto; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { color: #64748b; margin: 0 0 24px; }
    h2 { margin: 32px 0 16px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { display: block; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: inherit; text-decoration: none; }
    .card img { width: 100%; height: 180px; object-fit: cover; object-position: top left; border-bottom: 1px solid #e2e8f0; }
    .meta { padding: 12px; }
    .meta strong { display: block; font-size: 14px; }
    .meta span { display: block; margin-top: 4px; color: #64748b; font-size: 12px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>MMS UI Screenshots</h1>
  <p>${results.length} screenshots generated at ${new Date().toLocaleString()}.</p>
  ${Object.entries(Object.groupBy(results, (item) => item.group)).map(([group, items]) => `
    <section>
      <h2>${group}</h2>
      <div class="grid">
        ${items.map((item) => `
          <a class="card" href="${item.fileName}">
            <img src="${item.fileName}" alt="${item.group} ${item.name}" loading="lazy" />
            <span class="meta">
              <strong>${item.name}</strong>
              <span>${item.url}</span>
            </span>
          </a>
        `).join("")}
      </div>
    </section>
  `).join("")}
</main>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "index.html"), html, "utf8");
};

ensureDir(outputDir);

let apiProcess = null;
let staticServer = null;
const results = [];

try {
  apiProcess = await getApi();
  const base = await getBaseUrl();
  staticServer = base.staticServer;
  const baseUrl = base.baseUrl;

  const { createSessionForUser } = await import("../server/lib/session.ts");
  const { all, closeDatabase } = await import("../server/lib/db.ts");
  const users = await all("SELECT id, name, phone, role FROM users ORDER BY role, name");

  const browser = await chromium.launch({ headless: true });

  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const publicPage = await publicContext.newPage();
  for (const item of publicScreens) {
    results.push(await capture(publicPage, baseUrl, item));
  }
  await publicContext.close();

  for (const [role, screens] of Object.entries(roleScreens)) {
    const user = chooseUser(users, role);
    const token = await createSessionForUser(user.id);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [sessionTokenKey, token],
    );

    const page = await context.newPage();
    for (const screen of screens) {
      results.push(await capture(page, baseUrl, { ...screen, group: role }));
    }
    await context.close();
  }

  await browser.close();
  await closeDatabase();
  writeIndex(results);

  console.log(JSON.stringify({
    outputDir,
    indexPath: path.join(outputDir, "index.html"),
    count: results.length,
    files: results.map((item) => item.filePath),
  }, null, 2));
} finally {
  if (staticServer) staticServer.close();
  stopProcess(apiProcess);
}
