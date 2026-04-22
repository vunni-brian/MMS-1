import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

import { chromium } from "@playwright/test";

const rootDir = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(rootDir, "runtime", "dashboard-pngs");
const sessionTokenKey = "mms.session.token";
const apiUrl = "http://localhost:3001";
const webUrl = "http://localhost:8080";
const distDir = path.join(rootDir, "dist");

fs.mkdirSync(outputDir, { recursive: true });

const childProcesses = [];
let webServer;

const startProcess = (label, args, env = {}) => {
  const out = fs.openSync(path.join(outputDir, `${label}.out.log`), "w");
  const err = fs.openSync(path.join(outputDir, `${label}.err.log`), "w");
  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    stdio: ["ignore", out, err],
    windowsHide: true,
  });

  childProcesses.push({ label, child });
  return child;
};

const stopProcesses = () => {
  if (webServer) {
    webServer.close();
  }
  for (const { child } of childProcesses.reverse()) {
    if (!child.killed) {
      child.kill();
    }
  }
};

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

const createStaticServer = () =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
      reject(new Error("dist/index.html was not found. Run npm run build before capturing screenshots."));
      return;
    }

    webServer = http.createServer((req, res) => {
      const url = new URL(req.url || "/", webUrl);
      const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      let filePath = path.join(distDir, safePath === "/" ? "index.html" : safePath);

      if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html");
      }

      const ext = path.extname(filePath);
      res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });

    webServer.once("error", reject);
    webServer.listen(8080, "localhost", resolve);
  });

const waitForUrl = async (url, timeoutMs = 90_000) => {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${url}. Last error: ${lastError}`);
};

const roles = [
  {
    role: "vendor",
    label: "Vendor Dashboard",
    preferredNames: ["Amina Nakato"],
    path: "/vendor",
    fileName: "vendor-dashboard.png",
  },
  {
    role: "manager",
    label: "Manager Dashboard",
    preferredNames: ["Kigozi Duncan", "Sarah Namutebi", "Brian Waiswa"],
    path: "/manager",
    fileName: "manager-dashboard.png",
  },
  {
    role: "official",
    label: "Official Dashboard",
    preferredNames: ["Nassanga Shakirah Kakembo", "David Lubega"],
    path: "/official",
    fileName: "official-dashboard.png",
  },
  {
    role: "admin",
    label: "Admin Dashboard",
    preferredNames: ["Vunni Brian", "Ruth Nansubuga"],
    path: "/admin",
    fileName: "admin-dashboard.png",
  },
];

const resolveUserId = (users, item) => {
  const roleUsers = users.filter((user) => user.role === item.role);
  const preferred = item.preferredNames
    .map((name) => roleUsers.find((user) => user.name.toLowerCase() === name.toLowerCase()))
    .find(Boolean);
  const user = preferred || roleUsers[0];

  if (!user) {
    throw new Error(`No ${item.role} user exists for screenshot capture.`);
  }

  return user.id;
};

try {
  startProcess("api", ["--experimental-strip-types", "server/main.ts"], {
    MMS_SEED_ON_BOOT: "false",
  });
  await createStaticServer();

  await waitForUrl(`${apiUrl}/health`);
  await waitForUrl(webUrl);

  const { createSessionForUser } = await import("../server/lib/session.ts");
  const { all, closeDatabase } = await import("../server/lib/db.ts");
  const users = await all("SELECT id, name, role FROM users ORDER BY role, name");

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const item of roles) {
    const token = await createSessionForUser(resolveUserId(users, item));
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });

    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [sessionTokenKey, token],
    );

    const page = await context.newPage();
    await page.goto(`${webUrl}${item.path}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 20_000 });
    await page.screenshot({
      path: path.join(outputDir, item.fileName),
      fullPage: true,
    });

    results.push({
      role: item.role,
      label: item.label,
      path: path.join(outputDir, item.fileName),
    });

    await context.close();
  }

  await browser.close();
  await closeDatabase();

  console.log(JSON.stringify(results, null, 2));
} finally {
  stopProcesses();
}
