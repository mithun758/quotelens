// Persistence for the co-pilot's RFx draft: one at a time, with its conversation.
import type { Db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import type { Json, RfxDraftRow } from "@/lib/db/types";
import { EMPTY_DRAFT, RfxDraft } from "./draft";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type DraftState = { id: string | null; draft: RfxDraft; conversation: ChatTurn[]; status: RfxDraftRow["status"]; sentAt: string | null };

export async function getDraft(client: Db): Promise<DraftState> {
  const { data, error } = await client.from("rfx_draft").select("*").order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`load draft: ${error.message}`);
  const row = data?.[0];
  if (!row) return { id: null, draft: EMPTY_DRAFT, conversation: [], status: "draft", sentAt: null };
  const parsed = RfxDraft.safeParse(row.draft);
  return { id: row.id, draft: parsed.success ? parsed.data : EMPTY_DRAFT, conversation: (row.conversation as ChatTurn[]) ?? [], status: row.status, sentAt: row.sent_at };
}

export async function saveDraft(client: Db, draft: RfxDraft, conversation?: ChatTurn[]): Promise<void> {
  const valid = RfxDraft.parse(draft);
  const current = await getDraft(client);
  if (current.status === "sent") throw new Error("This RFx has been sent. Start a new draft to make changes.");
  const fields = { draft: valid as unknown as Json, updated_at: new Date().toISOString(), ...(conversation ? { conversation: conversation as unknown as Json } : {}) };
  const { error } = current.id
    ? await client.from("rfx_draft").update(fields).eq("id", current.id)
    : await client.from("rfx_draft").insert({ ...fields, conversation: (conversation ?? []) as unknown as Json });
  if (error) throw new Error(`save draft: ${error.message}`);
}

export async function startNewDraft(client: Db): Promise<void> {
  await client.from("rfx_draft").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await recordAuditEvent({ actor: "priya", action: "new_rfx_draft", target: "rfx draft" }, client);
}

export async function markSent(client: Db, suppliers: string[]): Promise<string> {
  const current = await getDraft(client);
  if (!current.id) throw new Error("There is no draft to send.");
  const sentAt = new Date().toISOString();
  const { error } = await client.from("rfx_draft").update({ status: "sent", sent_at: sentAt }).eq("id", current.id);
  if (error) throw new Error(`mark sent: ${error.message}`);
  await recordAuditEvent(
    {
      actor: "priya",
      action: "send_rfx",
      target: current.draft.title,
      after: { lines: current.draft.lines.length, suppliers } as unknown as Json,
      reason: "Stubbed: email sending is simulated",
    },
    client,
  );
  return sentAt;
}
