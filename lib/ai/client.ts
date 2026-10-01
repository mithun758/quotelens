import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

// Server-side only. Reads a workspace-scoped ANTHROPIC_API_KEY from the environment.
export function anthropic(): Anthropic {
  if (typeof window !== "undefined") throw new Error("lib/ai must never run in the browser");
  cached ??= new Anthropic({ timeout: 10 * 60 * 1000, maxRetries: 2 });
  return cached;
}

export function modelId(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

// Server-side refusal fallback: if a safety classifier declines, the API re-runs the
// request on a fallback model inside the same call.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
