import { cookies } from "next/headers";
import { runExtractionForAll } from "@/lib/ai/extraction/pipeline";
import { PASSCODE_COOKIE, isValidSessionToken } from "@/lib/auth/passcode";
import { db } from "@/lib/db/client";
import { UserFacingError, friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";

// All five suppliers run in parallel; a full run takes about a minute.
export const maxDuration = 300;

// POST /api/extract: run extraction for every supplier as one recorded run.
export async function POST() {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(PASSCODE_COOKIE)?.value)) {
    return Response.json({ error: "Passcode required" }, { status: 401 });
  }
  let run;
  try {
    await enforceRateLimit(db(), "extraction");
    run = await runExtractionForAll(db());
  } catch (error) {
    return Response.json({ error: friendlyError(error, "Extraction") }, { status: error instanceof UserFacingError ? 429 : 502 });
  }
  return Response.json({
    runId: run.runId,
    seconds: Math.round(run.durationMs / 1000),
    costUsd: Number(run.costUsd.toFixed(4)),
    suppliers: run.summaries.map((s) => ({ supplier: s.supplier, coverage: s.coverage, inferred: s.inferred, missing: s.missing })),
    errors: run.errors,
  });
}
