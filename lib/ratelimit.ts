// Per-session rate limits on AI calls, so a stranger at a live demo cannot burn the
// API credit. Counted in Postgres because serverless instances share no memory.
import { cookies } from "next/headers";
import type { Db } from "@/lib/db/client";
import { SESSION_COOKIE } from "@/lib/auth/passcode";
import { UserFacingError } from "@/lib/errors";

export const LIMITS = {
  analyst: { max: 30, minutes: 10 },
  copilot: { max: 20, minutes: 10 },
  extraction: { max: 4, minutes: 30 },
  extraction_supplier: { max: 15, minutes: 30 },
  memo: { max: 10, minutes: 10 },
  clarification: { max: 15, minutes: 10 },
  upload: { max: 6, minutes: 30 },
} as const;
export type AiKind = keyof typeof LIMITS;

// Across every session: a ceiling on spend per hour.
export const GLOBAL_PER_HOUR = 300;

export async function enforceRateLimit(client: Db, kind: AiKind): Promise<void> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value ?? "no-session";
  await enforceRateLimitFor(client, sid, kind);
}

export async function enforceRateLimitFor(client: Db, sid: string, kind: AiKind): Promise<void> {
  const { max, minutes } = LIMITS[kind];
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const [mine, all] = await Promise.all([
    client.from("ai_request").select("id", { count: "exact", head: true }).eq("session_id", sid).eq("kind", kind).gte("created_at", since),
    client.from("ai_request").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
  ]);
  if ((mine.count ?? 0) >= max) {
    throw new UserFacingError(`That is ${max} ${kind} requests in ${minutes} minutes from this browser, the demo limit. Try again in a few minutes.`);
  }
  if ((all.count ?? 0) >= GLOBAL_PER_HOUR) {
    throw new UserFacingError("The demo has reached its hourly AI limit across all visitors. Try again later.");
  }
  await client.from("ai_request").insert({ session_id: sid, kind });
}
