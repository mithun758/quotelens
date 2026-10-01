"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { runExtractionForAll } from "@/lib/ai/extraction/pipeline";
import { PASSCODE_COOKIE, isValidSessionToken } from "@/lib/auth/passcode";
import { db } from "@/lib/db/client";
import { friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";

export type RunResult = { ok: true; seconds: number; costUsd: number; errors: string[] } | { ok: false; error: string };

export async function runExtraction(): Promise<RunResult> {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(PASSCODE_COOKIE)?.value)) return { ok: false, error: "Passcode required" };

  try {
    await enforceRateLimit(db(), "extraction");
    const run = await runExtractionForAll(db());
    revalidatePath("/", "layout");
    return { ok: true, seconds: Math.round(run.durationMs / 1000), costUsd: run.costUsd, errors: run.errors.map((e) => `${e.supplier}: ${e.error}`) };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Extraction") };
  }
}
