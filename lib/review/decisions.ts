// Priya's review decisions: accept, correct, ask the supplier, and receive a reply.
// Every change writes an AuditEvent. Queue items are always re-read from the database,
// never trusted from the browser.
import { draftClarification } from "@/lib/ai/clarification/draft";
import { CLARIFICATION_FLAG, runExtractionForResponse } from "@/lib/ai/extraction/pipeline";
import type { Db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import type { Insert, Json } from "@/lib/db/types";
import { loadQuotes } from "@/lib/quotes/load";
import { inboxReplyFor } from "@/lib/stub/inbox";
import { QUESTIONNAIRE_TARGET, type QueueItem } from "./queue";

async function queueFor(client: Db, supplierCode: string) {
  const { detail, rfx } = await loadQuotes(client, supplierCode);
  if (!detail || detail.supplier.code !== supplierCode) throw new Error(`Unknown supplier ${supplierCode}`);
  return { detail, rfx };
}

function findItem(queue: QueueItem[], key: string): QueueItem {
  const item = queue.find((i) => i.key === key);
  if (!item) throw new Error("That item is no longer in the review queue. Refresh and try again.");
  return item;
}

export async function acceptItem(client: Db, supplierCode: string, key: string): Promise<void> {
  const { detail } = await queueFor(client, supplierCode);
  const item = findItem(detail.queue, key);
  if (!item.actions.includes("accept")) throw new Error("This item cannot be accepted.");

  if (item.kind === "value" && item.valueId) {
    const before = detail.values.find((v) => v.id === item.valueId)!;
    await client.from("extracted_value").update({ status: "confirmed" }).eq("id", item.valueId);
    await client.from("flag").update({ status: "resolved" }).eq("extracted_value_id", item.valueId).eq("status", "open");
    await recordAuditEvent(
      {
        actor: "priya",
        action: "accept_value",
        target: `${supplierCode} ${item.headline}`,
        before: { status: before.status, value: before.normalised_value_inr, confidence: before.confidence_state },
        after: { status: "confirmed", value: before.normalised_value_inr },
      },
      client,
    );
  } else if (item.kind === "response_flag" && item.flagId) {
    await client.from("flag").update({ status: "resolved" }).eq("id", item.flagId);
    await recordAuditEvent(
      { actor: "priya", action: "accept_flag", target: `${supplierCode} ${item.field}`, before: { status: "open" }, after: { status: "resolved" }, reason: item.detail ?? undefined },
      client,
    );
  }
}

export async function correctValue(client: Db, supplierCode: string, key: string, correctedInr: number, reason: string): Promise<void> {
  if (!Number.isFinite(correctedInr) || correctedInr <= 0) throw new Error("Enter a price above zero, in INR per piece, ex-GST.");
  if (!reason.trim()) throw new Error("Give a reason for the correction.");
  const { detail } = await queueFor(client, supplierCode);
  const item = findItem(detail.queue, key);
  if (!item.actions.includes("correct") || !item.valueId) throw new Error("This item cannot be corrected. Missing values are never filled in; ask the supplier.");

  const before = detail.values.find((v) => v.id === item.valueId)!;
  const value = Math.round(correctedInr * 100) / 100;
  await client
    .from("extracted_value")
    .update({ status: "corrected", normalised_value_inr: value, reason: `Corrected by Priya: ${reason.trim()}` })
    .eq("id", item.valueId);
  await client.from("flag").update({ status: "resolved" }).eq("extracted_value_id", item.valueId).eq("status", "open");
  await recordAuditEvent(
    {
      actor: "priya",
      action: "correct_value",
      target: `${supplierCode} ${item.headline}`,
      before: { value: before.normalised_value_inr, reason: before.reason, status: before.status },
      after: { value, status: "corrected" },
      reason: reason.trim(),
    },
    client,
  );
}

function issueFor(item: QueueItem) {
  const label = item.kind === "questionnaire" ? "Quality questionnaire" : item.headline;
  return { label, detail: item.detail ?? item.flags.map((f) => f.message).join(" ") };
}

export async function draftQuestion(client: Db, supplierCode: string, keys: string[]): Promise<{ subject: string; body: string }> {
  if (!keys.length) throw new Error("Select at least one item to ask about.");
  const { detail, rfx } = await queueFor(client, supplierCode);
  const items = keys.map((k) => findItem(detail.queue, k));
  if (items.some((i) => !i.actions.includes("ask"))) throw new Error("One of these items cannot be sent to the supplier.");
  return draftClarification(client, { supplierName: detail.supplier.name, supplierCode, rfxTitle: rfx.title, issues: items.map(issueFor) });
}

// Sending is stubbed: the clarification is recorded and the items show Awaiting supplier.
export async function sendClarification(client: Db, supplierCode: string, keys: string[], subject: string, body: string): Promise<void> {
  if (!body.trim()) throw new Error("The question is empty.");
  const { detail } = await queueFor(client, supplierCode);
  const items = keys.map((k) => findItem(detail.queue, k));
  if (!detail.response) throw new Error("This supplier has no response yet.");

  const flag = await client
    .from("flag")
    .insert({
      response_id: detail.response.id,
      type: CLARIFICATION_FLAG,
      severity: "medium",
      message: `Awaiting supplier: ${subject.trim() || "clarification"} (${items.length} item${items.length === 1 ? "" : "s"})`,
    })
    .select("id")
    .single();
  if (flag.error || !flag.data) throw new Error(`record clarification: ${flag.error?.message}`);

  const rows: Insert<"clarification">[] = items.map((i) => {
    const value = i.valueId ? detail.values.find((v) => v.id === i.valueId) : undefined;
    return {
      flag_id: flag.data.id,
      supplier_id: detail.supplier.id,
      question: body.trim(),
      status: "awaiting",
      line_item_id: value?.line_item_id ?? null,
      field: value?.field ?? null,
      target_flag_type: i.kind === "response_flag" ? i.field : i.kind === "questionnaire" ? QUESTIONNAIRE_TARGET : null,
    };
  });
  const inserted = await client.from("clarification").insert(rows, { defaultToNull: false });
  if (inserted.error) throw new Error(`record clarification: ${inserted.error.message}`);
  await recordAuditEvent(
    { actor: "priya", action: "ask_supplier", target: `${supplierCode}`, after: { subject, items: items.map((i) => i.headline) } as unknown as Json, reason: "Email sending is stubbed" },
    client,
  );
}

// Stubbed inbox: delivers the supplier's seeded reply, attaches its documents to the
// response and re-extracts the whole response with the real model.
export async function receiveReply(client: Db, supplierCode: string): Promise<{ attached: number }> {
  const { detail } = await queueFor(client, supplierCode);
  const awaiting = detail.clarifications.filter((c) => c.status === "awaiting");
  if (!awaiting.length) throw new Error("Nothing is awaiting a reply from this supplier.");
  const reply = inboxReplyFor(supplierCode);
  if (!reply) throw new Error(`No reply from ${detail.supplier.name} in the demo inbox yet.`);
  if (!detail.response) throw new Error("This supplier has no response.");

  const existing = new Set(detail.documents.map((d) => d.storage_path));
  const newDocs = reply.documents.filter((d) => !existing.has(d.storage_path));
  if (newDocs.length) {
    const { error } = await client.from("document").insert(
      newDocs.map((d) => ({ response_id: detail.response!.id, file_name: d.file_name, mime_type: d.mime_type, storage_path: d.storage_path, page_count: d.page_count })),
    );
    if (error) throw new Error(`attach reply: ${error.message}`);
  }

  await runExtractionForResponse(client, detail.response.id);

  const now = new Date().toISOString();
  await client.from("clarification").update({ status: "answered", reply_text: reply.body_text, answered_at: now }).in("id", awaiting.map((c) => c.id));
  await client.from("flag").update({ status: "resolved" }).in("id", [...new Set(awaiting.map((c) => c.flag_id))]);
  await recordAuditEvent(
    { actor: "system", action: "supplier_reply_received", target: supplierCode, after: { documents: newDocs.map((d) => d.file_name), re_extracted: true } as unknown as Json },
    client,
  );
  return { attached: newDocs.length };
}
