"use server";

import { runCopilot } from "@/lib/ai/copilot";
import { hasValidSession } from "@/lib/auth/gate";
import { asOfDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
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

export async function chatAction(message: string) {
  return guarded(async () => {
    if (!message.trim()) throw new Error("Type a message.");
    const client = db();
    const state = await getDraft(client);
    if (state.status === "sent") throw new Error("This RFx has been sent. Start a new draft to change it.");
    await enforceRateLimit(client, "copilot");
    const turn = await runCopilot(client, state.draft, state.conversation.slice(-20), message.trim());
    const conversation = [...state.conversation, { role: "user" as const, content: message.trim() }, { role: "assistant" as const, content: turn.reply }];
    await saveDraft(client, turn.draft, conversation);
    if (turn.toolCalls.some((t) => !t.error && !t.name.startsWith("get_"))) {
      await recordAuditEvent({ actor: "model", action: "update_rfx_draft", target: turn.draft.title || "rfx draft", after: { tools: turn.toolCalls.map((t) => t.name), lines: turn.draft.lines.length } }, client);
    }
    return { reply: turn.reply, draft: turn.draft, conversation };
  });
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
