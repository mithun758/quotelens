// npm run smoke -- [baseUrl] [outDir]
// Visits every page at a 1280x800 laptop viewport with the passcode cookie, records
// console errors, page errors, failed requests and horizontal overflow, and screenshots
// each page. Needs Google Chrome and DEMO_PASSCODE in the environment.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? path.join(process.cwd(), ".smoke");
const PAGES = ["/login", "/rfx", "/quotes?supplier=A", "/quotes?supplier=B", "/quotes?supplier=D", "/comparison", "/award", "/eval"];

const token = crypto.createHmac("sha256", process.env.DEMO_PASSCODE ?? "").update("quotelens-gate-v1").digest("hex");
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: { width: 1280, height: 800 },
});
const url = new URL(base);
let failures = 0;
for (const p of PAGES) {
  // A fresh context per page: signed in everywhere except /login.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  if (p !== "/login") await context.setCookie({ name: "ql_gate", value: token, domain: url.hostname, path: "/", secure: url.protocol === "https:" });
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => problems.push(`page error: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("favicon") && problems.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`));
  const started = Date.now();
  await page.goto(base + p, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`page scrolls horizontally by ${overflow}px`);
  const file = path.join(out, `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${problems.length ? "FAIL" : "ok  "} ${p} (${Date.now() - started} ms)${problems.map((x) => `\n     ${x}`).join("")}`);
  failures += problems.length ? 1 : 0;
  await context.close();
}
await browser.close();
console.log(`\n${failures} page(s) with problems. Screenshots in ${out}`);
process.exit(failures ? 1 : 0);
