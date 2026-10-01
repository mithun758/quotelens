"use server";

import { revalidatePath } from "next/cache";
import { hasValidSession } from "@/lib/auth/gate";
import { db } from "@/lib/db/client";
import { decideSubstitute } from "@/lib/review/substitutes";

export async function decideSubstituteAction(
  valueId: string,
  decision: "approved" | "rejected",
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await hasValidSession())) return { ok: false, error: "Passcode required" };
  try {
    await decideSubstitute(db(), valueId, decision, reason);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
