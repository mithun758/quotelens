// Headless Chrome for HTML -> PDF and HTML -> PNG. Seed tooling only (macOS dev machine).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Headless Chrome on macOS can write its output and then never exit, so wait for
// the output file to appear and stop growing, then shut Chrome down ourselves.
async function runChrome(args: string[], htmlPath: string, outPath: string): Promise<void> {
  rmSync(outPath, { force: true });
  const profile = mkdtempSync(path.join(tmpdir(), "ql-chrome-"));
  const child = spawn(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--disable-background-networking",
      "--disable-component-update",
      "--use-mock-keychain",
      "--password-store=basic",
      "--hide-scrollbars",
      `--user-data-dir=${profile}`,
      ...args,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: "ignore" },
  );
  let exited = false;
  child.on("exit", () => (exited = true));

  try {
    const start = Date.now();
    let lastSize = -1;
    while (Date.now() - start < TIMEOUT_MS) {
      await sleep(300);
      if (existsSync(outPath)) {
        const size = statSync(outPath).size;
        if (size > 0 && size === lastSize) return;
        lastSize = size;
      } else if (exited) {
        throw new Error(`Chrome exited without writing ${outPath}`);
      }
    }
    throw new Error(`Chrome timed out writing ${outPath}`);
  } finally {
    if (!exited) child.kill("SIGKILL");
    rmSync(profile, { recursive: true, force: true });
  }
}

export function htmlToPdf(htmlPath: string, pdfPath: string) {
  return runChrome(["--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`], htmlPath, pdfPath);
}

export function htmlToPng(htmlPath: string, pngPath: string, width: number, height: number) {
  return runChrome(
    [`--window-size=${width},${height}`, "--force-device-scale-factor=1", "--virtual-time-budget=2000", `--screenshot=${pngPath}`],
    htmlPath,
    pngPath,
  );
}

export function pngToJpeg(pngPath: string, jpgPath: string, quality = 78) {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(quality), pngPath, "--out", jpgPath], { stdio: "pipe" });
}
