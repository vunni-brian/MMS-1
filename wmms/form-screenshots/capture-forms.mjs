import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const outputDir = path.resolve("wmms/form-screenshots");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = "http://127.0.0.1:5173";

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 1800 },
});

const save = async (name) => {
  await page.screenshot({
    path: path.join(outputDir, name),
    fullPage: true,
  });
};

await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('h1:has-text("Market Management System")');
await save("login-form.png");

await page.fill("#phone", "+256701111222");
await page.fill("#password", "Admin123!");
await save("login-form-filled.png");

await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('h1:has-text("Vendor Registration")');
await save("register-details-form.png");

await page.fill("#name", "Screenshot Vendor");
await page.fill("#national-id-number", "CF12345678901234");
await page.fill("#district", "Kampala");

const productSection = page.locator('[id="product-section"]');
await productSection.click();
await page.getByRole("option", { name: "Fresh Produce" }).click();

await page.fill("#phone", "+256700123456");
await page.fill("#email", "screenshot.vendor@example.com");
await page.fill("#password", "Vendor123!");
await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll("button")).find((element) =>
    element.textContent?.includes("Continue to Documents"),
  );
  if (button) {
    button.removeAttribute("disabled");
  }
});
await page.click('button:has-text("Continue to Documents")');
await page.waitForTimeout(1000);
await save("register-documents-form.png");

await browser.close();
