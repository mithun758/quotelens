// The Lens system prompt: lib/ai/lens/system-prompt.md with every {{placeholder}}
// filled for the turn. An unfilled placeholder is an error, never sent to the model.
import fs from "node:fs";
import path from "node:path";
import type { LensPlaceholders } from "./context";

let cached: string | null = null;

export function lensTemplate(): string {
  if (cached === null) {
    const raw = fs.readFileSync(path.join(process.cwd(), "lib/ai/lens/system-prompt.md"), "utf8");
    // The usage note at the top is for developers, not the model.
    cached = raw.replace(/<!--[\s\S]*?-->\s*/g, "").trim();
  }
  return cached;
}

export function renderLensPrompt(values: LensPlaceholders): string {
  const out = lensTemplate().replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
    const v = (values as Record<string, string | undefined>)[key];
    if (v === undefined) throw new Error(`Lens prompt placeholder {{${key}}} has no value`);
    return v;
  });
  return out;
}
