// Extraction pipeline for one supplier response: read every document with the model,
// verify snippets, normalise in code, and replace the response's extracted data.
// Re-running it reproduces the comparison from the documents alone.
import { randomUUID } from "node:crypto";
import { asOfDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import { downloadDocument } from "@/lib/db/storage";
import type { DocumentRow, Insert, Json, LineItemRow, RfxRow, RunSnapshot, SourceLocator, SupplierRow } from "@/lib/db/types";
import { validUntil } from "@/lib/normalise/dates";
import { normaliseResponse, type NormalisedValue, type SourcedItem } from "@/lib/normalise/normaliseResponse";
import { evaluateQuestionnaire, type DocExtraction } from "@/lib/questionnaire/evaluate";
import { extractDocument } from "./extract";

// Response-level flag type that carries a clarification; never cleared by re-extraction.
export const CLARIFICATION_FLAG = "clarification_requested";
import { prepareDocument, snippetFound } from "./prepare";
import { extractionSystemPrompt } from "./prompt";
import { TERM_FIELDS, type Extraction, type ExtractionSource, type TermField } from "./schema";

type Loaded = {
  rfx: RfxRow;
  lines: LineItemRow[];
  supplier: SupplierRow;
  responseId: string;
  documents: DocumentRow[];
};

export type ExtractionSummary = {
  responseId: string;
  supplier: string;
  coverage: number;
  values: number;
  inferred: number;
  missing: number;
  flags: number;
  documents: { file: string; attempts: number; items: number }[];
};

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

function required<T>(result: { data: T; error: null } | { data: null; error: { message: string } }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: not found`);
  return result.data;
}

async function load(client: Db, responseId: string): Promise<Loaded> {
  const res = await client.from("response").select("*").eq("id", responseId).single();
  if (res.error || !res.data) throw new Error(`load response ${responseId}: ${res.error?.message ?? "not found"}`);
  const response = res.data;
  const [rfx, lines, supplier, documents] = await Promise.all([
    client.from("rfx").select("*").eq("id", response.rfx_id).single(),
    client.from("line_item").select("*").eq("rfx_id", response.rfx_id).order("line_no"),
    client.from("supplier").select("*").eq("id", response.supplier_id).single(),
    client.from("document").select("*").eq("response_id", responseId).order("file_name"),
  ]);
  return {
    rfx: required(rfx, "load rfx"),
    lines: required(lines, "load lines"),
    supplier: required(supplier, "load supplier"),
    responseId,
    documents: required(documents, "load documents"),
  };
}

const locator = (s: ExtractionSource): SourceLocator & Record<string, unknown> =>
  Object.fromEntries(Object.entries(s.locator).filter(([, v]) => v !== null)) as SourceLocator & Record<string, unknown>;

// Downgrade anything whose snippet is not in a text document to Inferred.
function verifySnippets(extraction: Extraction, text: string | null): Extraction {
  if (text === null) return extraction;
  const note = "Source snippet not found verbatim in the document.";
  return {
    ...extraction,
    items: extraction.items.map((item) =>
      snippetFound(item.source.snippet, text)
        ? item
        : { ...item, confidence: "inferred" as const, reason: [item.reason, note].filter(Boolean).join(" ") },
    ),
  };
}

type TermValue = { value: string; source: ExtractionSource; documentId: string };

// First non-empty value per term, preferring quotations and emails over attachments.
function mergeTerms(docs: DocExtraction[]): Partial<Record<TermField, TermValue>> {
  const rank = (d: DocExtraction) => (["quotation", "email"].includes(d.extraction.document_kind) ? 0 : 1);
  const ordered = [...docs].sort((a, b) => rank(a) - rank(b));
  const merged: Partial<Record<TermField, TermValue>> = {};
  for (const field of TERM_FIELDS) {
    for (const d of ordered) {
      const f = d.extraction.terms[field];
      if (f.value && f.source) {
        merged[field] = { value: f.value, source: f.source, documentId: d.documentId };
        break;
      }
    }
  }
  return merged;
}

const toInt = (v: string | undefined) => {
  const n = v ? parseInt(v.replace(/[^\d]/g, ""), 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function runExtractionForResponse(client: Db, responseId: string, runId: string | null = null): Promise<ExtractionSummary> {
  const data = await load(client, responseId);
  const asOf = asOfDate();
  const { data: fxRates } = await client.from("fx_rate").select("*");
  check(await client.from("response").update({ status: "processing" }).eq("id", responseId), "mark processing");

  try {
    const systemPrompt = extractionSystemPrompt(data.rfx, data.lines);
    const perDoc = await Promise.all(
      data.documents.map(async (doc) => {
        const buffer = await downloadDocument(client, doc.storage_path);
        const prepared = await prepareDocument(doc.file_name, doc.mime_type, buffer);
        const result = await extractDocument({
          systemPrompt,
          document: prepared,
          supplierName: data.supplier.name,
          fileName: doc.file_name,
          onCall: async (call) => {
            const { error } = await client.from("model_call").insert({
              run_id: runId,
              purpose: "extraction",
              supplier_code: data.supplier.code,
              document_name: doc.file_name,
              model: call.model,
              attempt: call.attempt,
              ...call.usage,
              cost_usd: call.costUsd,
              duration_ms: call.durationMs,
            });
            if (error) console.error(`log model call: ${error.message}`);
          },
        });
        return { doc, extraction: verifySnippets(result.extraction, prepared.text), attempts: result.attempts };
      }),
    );

    const docs: DocExtraction[] = perDoc.map((p) => ({ documentId: p.doc.id, extraction: p.extraction }));
    const items: SourcedItem[] = perDoc.flatMap((p) => p.extraction.items.map((i) => ({ ...i, documentId: p.doc.id })));
    const normalised = normaliseResponse(items, {
      lines: data.lines,
      fxRates: fxRates ?? [],
      asOfDate: asOf,
      supplierCode: data.supplier.code,
    });
    const terms = mergeTerms(docs);
    const questionnaire = evaluateQuestionnaire(docs, asOf);

    await replaceResponseData(client, data, { normalised: normalised.values, unmatched: normalised.unmatched, terms, questionnaire, docs, coverage: normalised.coverage });

    const summary: ExtractionSummary = {
      responseId,
      supplier: data.supplier.code,
      coverage: normalised.coverage,
      values: normalised.values.length,
      inferred: normalised.values.filter((v) => v.confidence_state === "inferred").length,
      missing: normalised.values.filter((v) => v.confidence_state === "missing").length,
      flags: normalised.values.reduce((s, v) => s + v.flags.length, 0),
      documents: perDoc.map((p) => ({ file: p.doc.file_name, attempts: p.attempts, items: p.extraction.items.length })),
    };
    await recordAuditEvent(
      { actor: "model", action: "extract_response", target: `response:${responseId}`, after: summary as unknown as Json },
      client,
    );
    return summary;
  } catch (error) {
    await client.from("response").update({ status: "failed" }).eq("id", responseId);
    throw error;
  }
}

async function replaceResponseData(
  client: Db,
  data: Loaded,
  result: {
    normalised: NormalisedValue[];
    unmatched: SourcedItem[];
    terms: Partial<Record<TermField, TermValue>>;
    questionnaire: ReturnType<typeof evaluateQuestionnaire>;
    docs: DocExtraction[];
    coverage: number;
  },
) {
  const { responseId, supplier, lines } = data;
  const lineId = new Map(lines.map((l) => [l.line_no, l.id]));

  // Priya's decisions survive re-extraction only while the value they were made on is unchanged.
  const { data: decided } = await client
    .from("extracted_value")
    .select("line_item_id, field, status, raw_value, normalised_value_inr, reason")
    .eq("response_id", responseId)
    .in("status", ["confirmed", "corrected"]);
  const decisions = new Map((decided ?? []).map((d) => [`${d.line_item_id ?? ""}|${d.field}`, d]));

  // Clear previous extraction for this response. Steps and value flags cascade.
  // Clarification flags are kept: they carry the conversation with the supplier.
  check(await client.from("extracted_value").delete().eq("response_id", responseId), "clear values");
  check(await client.from("flag").delete().eq("response_id", responseId).neq("type", CLARIFICATION_FLAG), "clear response flags");
  check(await client.from("quote_terms").delete().eq("response_id", responseId), "clear terms");
  check(await client.from("questionnaire_answer").delete().eq("supplier_id", supplier.id), "clear questionnaire");

  const values: Insert<"extracted_value">[] = [];
  const steps: Insert<"normalisation_step">[] = [];
  const flags: Insert<"flag">[] = [];

  for (const v of result.normalised) {
    const id = randomUUID();
    values.push({
      id,
      response_id: responseId,
      line_item_id: lineId.get(v.line_no!)!,
      field: "unit_price",
      raw_value: v.raw_value,
      raw_unit: v.raw_unit,
      raw_currency: v.raw_currency,
      normalised_value_inr: v.normalised_value_inr,
      confidence_state: v.confidence_state,
      reason: v.reason,
      source_document_id: v.documentId,
      source_locator: v.source ? locator(v.source) : null,
      source_snippet: v.source?.snippet ?? null,
      match_reason: v.match_reason,
      substitute_check: v.substitute_check,
      substitute_status: v.substitute_check ? "pending" : null,
      status: v.confidence_state === "extracted" ? "auto_accepted" : "needs_review",
    });
    v.steps.forEach((s, i) => steps.push({ extracted_value_id: id, step_order: i + 1, ...s }));
    v.flags.forEach((f) => flags.push({ extracted_value_id: id, ...f }));
  }

  for (const u of result.unmatched) {
    const id = randomUUID();
    values.push({
      id,
      response_id: responseId,
      line_item_id: null,
      field: "unmatched_item",
      raw_value: [u.quoted_description, u.raw_price].filter(Boolean).join(" @ "),
      raw_currency: u.currency,
      confidence_state: "inferred",
      reason: `Does not match any RFx line: ${u.match_reason}`,
      source_document_id: u.documentId,
      source_locator: locator(u.source),
      source_snippet: u.source.snippet,
      match_reason: u.match_reason,
      status: "needs_review",
    });
    flags.push({ extracted_value_id: id, type: "unmatched_item", severity: "low", message: `Quoted item matches no RFx line: ${u.quoted_description}` });
  }

  for (const [field, t] of Object.entries(result.terms)) {
    values.push({
      id: randomUUID(),
      response_id: responseId,
      line_item_id: null,
      field: `terms.${field}`,
      raw_value: t.value,
      confidence_state: "extracted",
      source_document_id: t.documentId,
      source_locator: locator(t.source),
      source_snippet: t.source.snippet,
      status: "auto_accepted",
    });
  }

  // Response-level flags from terms and discounts. Freshness rules come later.
  // Only concrete percentage discounts are discounts; "rates negotiable" is not one.
  for (const d of result.docs) {
    for (const disc of d.extraction.discounts.filter((x) => x.percent !== null)) {
      flags.push({
        response_id: responseId,
        type: disc.condition ? "conditional_discount" : "discount_not_applied",
        severity: "low",
        message: disc.condition
          ? `${disc.percent}% discount applies only if: ${disc.condition.replace(/\.$/, "")}. Not applied to normalised prices; the scenario applies it when the award meets the condition.`
          : `${disc.percent}% discount (${disc.description}). Not applied to normalised prices; confirm before award.`,
      });
    }
  }
  const freightBasis = result.docs.map((d) => d.extraction.terms.freight_basis).find((b) => b !== "not_stated");
  if (freightBasis === "extra" || freightBasis === "partly_extra") {
    flags.push({
      response_id: responseId,
      type: "freight_not_included",
      severity: "medium",
      message: `Freight is not fully included (${result.terms.freight_terms?.value ?? "freight extra"}). Prices are compared ex-freight; unknown freight is never added.`,
    });
  }
  const priced = result.normalised.filter((v) => v.raw_currency !== null && v.confidence_state !== "missing");
  const anyGstStatement = !!result.terms.gst_treatment;
  if (!anyGstStatement && priced.length && data.documents.length) {
    const allNotStated = result.docs.every((d) => d.extraction.items.every((i) => i.gst === "not_stated"));
    if (allNotStated) {
      flags.push({ response_id: responseId, type: "gst_basis_not_stated", severity: "low", message: "The quote does not say whether prices include GST. Treated as ex-GST." });
    }
  }

  check(await client.from("extracted_value").insert(values, { defaultToNull: false }), "insert values");
  if (steps.length) check(await client.from("normalisation_step").insert(steps, { defaultToNull: false }), "insert steps");
  if (flags.length) check(await client.from("flag").insert(flags, { defaultToNull: false }), "insert flags");

  const t = result.terms;
  const quoteDate = t.quote_date?.value ?? null;
  check(
    await client.from("quote_terms").insert({
      response_id: responseId,
      quote_date: quoteDate,
      valid_until: validUntil(quoteDate, t.valid_until?.value ?? null, toInt(t.validity_days?.value)),
      gst_treatment: t.gst_treatment?.value ?? null,
      freight_terms: t.freight_terms?.value ?? null,
      warranty: t.warranty?.value ?? null,
      payment_terms: t.payment_terms?.value ?? null,
      delivery_days: toInt(t.delivery_days?.value),
      references_prior_pricing: !!t.prior_pricing_reference,
    }),
    "insert terms",
  );

  check(
    await client.from("questionnaire_answer").insert(
      result.questionnaire.map((q) => ({ supplier_id: supplier.id, question_key: q.question_key, answer: q.answer, pass_fail: q.pass_fail, evidence_document_id: q.evidence_document_id })),
    ),
    "insert questionnaire",
  );

  check(await client.from("response").update({ status: "extracted", coverage_count: result.coverage }).eq("id", responseId), "mark extracted");

  for (const v of values) {
    const prior = decisions.get(`${v.line_item_id ?? ""}|${v.field}`);
    if (!prior) continue;
    decisions.delete(`${v.line_item_id ?? ""}|${v.field}`);
    if (prior.raw_value !== (v.raw_value ?? null)) {
      await recordAuditEvent(
        { actor: "system", action: "decision_dropped", target: `extracted_value:${v.id}`, before: prior as unknown as Json, reason: "Source value changed on re-extraction" },
        client,
      );
      continue;
    }
    check(
      await client
        .from("extracted_value")
        .update(prior.status === "corrected" ? { status: "corrected", normalised_value_inr: prior.normalised_value_inr, reason: prior.reason } : { status: "confirmed" })
        .eq("id", v.id!),
      "reapply decision",
    );
    if (prior.status === "confirmed" || prior.status === "corrected") {
      await client.from("flag").update({ status: "resolved" }).eq("extracted_value_id", v.id!).eq("status", "open");
    }
  }
}

export type RunReport = {
  runId: string;
  summaries: ExtractionSummary[];
  errors: { supplier: string; error: string }[];
  durationMs: number;
  costUsd: number;
};

// Runs every supplier (or the given codes) in parallel as one recorded run, then
// snapshots the resulting values so /eval can show run-to-run variance.
export async function runExtractionForAll(client: Db, codes: string[] = []): Promise<RunReport> {
  const started = Date.now();
  const [{ data: responses, error }, { data: suppliers }] = await Promise.all([
    client.from("response").select("id, supplier_id").order("received_at"),
    client.from("supplier").select("id, code"),
  ]);
  if (error || !responses) throw new Error(`list responses: ${error?.message ?? "none"}`);
  const codeOf = new Map((suppliers ?? []).map((sup) => [sup.id, sup.code]));
  const targets = responses.filter((r) => !codes.length || codes.includes(codeOf.get(r.supplier_id) ?? ""));

  const run = await client.from("extraction_run").insert({ scope: codes.length ? codes.join(",") : "all" }).select("id").single();
  if (run.error || !run.data) throw new Error(`start run: ${run.error?.message}`);
  const runId = run.data.id;

  const settled = await Promise.allSettled(targets.map((r) => runExtractionForResponse(client, r.id, runId)));
  const summaries = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const errors = settled.flatMap((r, i) =>
    r.status === "rejected" ? [{ supplier: codeOf.get(targets[i].supplier_id) ?? "?", error: r.reason instanceof Error ? r.reason.message : String(r.reason) }] : [],
  );

  const [{ data: calls }, snapshot] = await Promise.all([
    client.from("model_call").select("cost_usd").eq("run_id", runId),
    snapshotValues(client),
  ]);
  const costUsd = (calls ?? []).reduce((sum, c) => sum + Number(c.cost_usd), 0);
  const durationMs = Date.now() - started;
  await client
    .from("extraction_run")
    .update({
      status: errors.length === 0 ? "succeeded" : summaries.length ? "partial" : "failed",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      cost_usd: costUsd,
      snapshot,
      errors: errors.length ? (errors as unknown as Json) : null,
    })
    .eq("id", runId);

  return { runId, summaries, errors, durationMs, costUsd };
}

async function snapshotValues(client: Db): Promise<RunSnapshot> {
  const [values, responses, suppliers, lines] = await Promise.all([
    client.from("extracted_value").select("response_id, line_item_id, normalised_value_inr, confidence_state").eq("field", "unit_price"),
    client.from("response").select("id, supplier_id"),
    client.from("supplier").select("id, code"),
    client.from("line_item").select("id, line_no"),
  ]);
  const supplierOfResponse = new Map((responses.data ?? []).map((r) => [r.id, r.supplier_id]));
  const codeOf = new Map((suppliers.data ?? []).map((x) => [x.id, x.code]));
  const lineNo = new Map((lines.data ?? []).map((l) => [l.id, l.line_no]));
  const snapshot: RunSnapshot = {};
  for (const v of values.data ?? []) {
    const code = codeOf.get(supplierOfResponse.get(v.response_id) ?? "") ?? "?";
    (snapshot[code] ??= {})[String(lineNo.get(v.line_item_id ?? ""))] = { value: v.normalised_value_inr, confidence: v.confidence_state };
  }
  return snapshot;
}
