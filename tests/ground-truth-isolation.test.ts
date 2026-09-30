import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// seed/ground_truth.json and the price design in seed/generate are for evaluation only.
// App code may reach them only from the eval page and its helpers.
const ROOT = process.cwd();
const SCANNED = ["app", "components", "lib", "proxy.ts"];
const ALLOWED = [path.join("lib", "eval"), path.join("app", "(app)", "eval")];
const FORBIDDEN = /ground_truth|seed\/generate|generate\/prices/;

function files(entry: string): string[] {
  const full = path.join(ROOT, entry);
  if (statSync(full).isFile()) return [entry];
  return readdirSync(full).flatMap((name) => files(path.join(entry, name)));
}

describe("ground truth isolation", () => {
  it("no app, extraction or analyst code references the ground truth or price design", () => {
    const offenders = SCANNED.flatMap(files)
      .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))
      .filter((f) => !ALLOWED.some((allowed) => f.startsWith(allowed)))
      .filter((f) => FORBIDDEN.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
