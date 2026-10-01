"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PASSCODE_COOKIE, isValidSessionToken } from "@/lib/auth/passcode";
import { db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import { friendlyError } from "@/lib/errors";
import { runSeed } from "@/seed/runSeed";

export type ResetDemoResult = { ok: true } | { ok: false; error: string };

export async function resetDemo(): Promise<ResetDemoResult> {
  // Server actions are POST endpoints, so check the gate here too.
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(PASSCODE_COOKIE)?.value)) {
    return { ok: false, error: "Passcode required" };
  }

  try {
    const client = db();
    await runSeed(client);
    await recordAuditEvent(
      { actor: "priya", action: "reset_demo", target: "database", reason: "Reset demo" },
      client,
    );
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Reset") };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
