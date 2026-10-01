"use server";

import { hasValidSession } from "@/lib/auth/gate";
import { asOfDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { friendlyError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/db/queries";
import { RfxDraft, sendProblems } from "@/lib/rfx/draft";
import { getDraft, markSent, saveDraft, startNewDraft } from "@/lib/rfx/store";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guarded<T>(fn: () => Promise<T>): Promise<Result<T>> {
  if (!(await hasValidSession())) return { ok: false, error: "Passcode required" };
  try {
    // No revalidation: the client holds the draft and conversation, so a refresh would
    // only keep the screen busy after each save or reply.
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "The co-pilot") };
  }
}

export async function saveDraftAction(draft: RfxDraft) {
  return guarded(async () => {
    const client = db();
    const valid = RfxDraft.parse(draft);
    await saveDraft(client, valid);
    await recordAuditEvent({ actor: "priya", action: "edit_rfx_draft", target: valid.title || "rfx draft", after: { lines: valid.lines.length } }, client);
    return valid;
  });
}

export async function sendRfxAction() {
  return guarded(async () => {
    const client = db();
    const state = await getDraft(client);
    const problems = sendProblems(state.draft, asOfDate());
    if (problems.length) throw new Error(problems.join(" "));
    const { data: suppliers } = await client.from("supplier").select("code, name, state").order("code");
    const sentAt = await markSent(client, (suppliers ?? []).map((s) => s.code));
    return { sentAt, suppliers: suppliers ?? [] };
  });
}

export async function newDraftAction() {
  return guarded(async () => startNewDraft(db()));
}
