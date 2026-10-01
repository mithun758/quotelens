// The Lens system prompt: lib/ai/lens/system-prompt.md, static so it can be cached.
// Runtime values go in a <context> block at the start of each user turn (context.ts).
import fs from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function lensSystemPrompt(): string {
  if (cached === null) {
    const raw = fs.readFileSync(path.join(process.cwd(), "lib/ai/lens/system-prompt.md"), "utf8");
    // The usage note at the top is for developers, not the model.
    cached = raw.replace(/<!--[\s\S]*?-->\s*/g, "").trim();
    if (/\{\{\w+\}\}/.test(cached)) throw new Error("The Lens system prompt must be static: move runtime values into the context block");
  }
  return cached;
}
