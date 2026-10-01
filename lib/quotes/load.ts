// Data for the Quotes screen: the supplier rail and one supplier's documents,
// extracted values, ledger, flags, clarifications and review queue.
import type { Db } from "@/lib/db/client";
import type {
  ClarificationRow,
  DocumentRow,
  ExtractedValueRow,
  FlagRow,
  NormalisationStepRow,
  QuestionnaireAnswerRow,
  QuoteTermsRow,
  ResponseRow,
  RfxRow,
  SupplierRow,
} from "@/lib/db/types";
import { buildReviewQueue, type QueueItem } from "@/lib/review/queue";

export type ValueWithLine = ExtractedValueRow & { line_no: number | null; description: string | null; steps: NormalisationStepRow[] };

export type SupplierSummary = {
  supplier: SupplierRow;
  response: ResponseRow | null;
  formats: string[];
  queueCount: number;
  awaiting: number;
};

export type SupplierDetail = SupplierSummary & {
  documents: DocumentRow[];
  values: ValueWithLine[];
  flags: FlagRow[];
  terms: QuoteTermsRow | null;
  questionnaire: QuestionnaireAnswerRow[];
  clarifications: ClarificationRow[];
  queue: QueueItem[];
};

const FORMAT: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "Photo",
  "image/png": "Image",
  "text/plain": "Email",
};
export const formatLabel = (mime: string) =>
  FORMAT[mime] ?? (mime.includes("spreadsheetml") ? "Excel" : mime.includes("wordprocessingml") ? "Word" : "File");

function ok<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

type All = {
  rfx: RfxRow;
  suppliers: SupplierRow[];
  responses: ResponseRow[];
  documents: DocumentRow[];
  values: ExtractedValueRow[];
  steps: NormalisationStepRow[];
  flags: FlagRow[];
  clarifications: ClarificationRow[];
  questionnaire: QuestionnaireAnswerRow[];
  terms: QuoteTermsRow[];
  lines: { id: string; line_no: number; description: string }[];
};

async function loadAll(client: Db): Promise<All> {
  const [rfx, suppliers, responses, documents, values, steps, flags, clarifications, questionnaire, terms, lines] = await Promise.all([
    client.from("rfx").select("*").single(),
    client.from("supplier").select("*").order("code"),
    client.from("response").select("*"),
    client.from("document").select("*").order("file_name"),
    client.from("extracted_value").select("*"),
    client.from("normalisation_step").select("*").order("step_order"),
    client.from("flag").select("*").order("created_at"),
    client.from("clarification").select("*").order("created_at"),
    client.from("questionnaire_answer").select("*"),
    client.from("quote_terms").select("*"),
    client.from("line_item").select("id, line_no, description").order("line_no"),
  ]);
  if (rfx.error || !rfx.data) throw new Error(`load rfx: ${rfx.error?.message}`);
  return {
    rfx: rfx.data,
    suppliers: ok(suppliers, "suppliers"),
    responses: ok(responses, "responses"),
    documents: ok(documents, "documents"),
    values: ok(values, "values"),
    steps: ok(steps, "steps"),
    flags: ok(flags, "flags"),
    clarifications: ok(clarifications, "clarifications"),
    questionnaire: ok(questionnaire, "questionnaire"),
    terms: ok(terms, "terms"),
    lines: ok(lines, "lines"),
  };
}

function detailFor(all: All, supplier: SupplierRow): SupplierDetail {
  const response = all.responses.find((r) => r.supplier_id === supplier.id) ?? null;
  const documents = all.documents.filter((d) => d.response_id === response?.id);
  const lineById = new Map(all.lines.map((l) => [l.id, l]));
  const values: ValueWithLine[] = all.values
    .filter((v) => v.response_id === response?.id)
    .map((v) => {
      const line = v.line_item_id ? lineById.get(v.line_item_id) : undefined;
      return { ...v, line_no: line?.line_no ?? null, description: line?.description ?? null, steps: all.steps.filter((s) => s.extracted_value_id === v.id) };
    })
    .sort((a, b) => (a.line_no ?? 999) - (b.line_no ?? 999) || a.field.localeCompare(b.field));
  const valueIds = new Set(values.map((v) => v.id));
  const flags = all.flags.filter((f) => (f.response_id && f.response_id === response?.id) || (f.extracted_value_id && valueIds.has(f.extracted_value_id)));
  const clarifications = all.clarifications.filter((c) => c.supplier_id === supplier.id);
  const questionnaire = all.questionnaire.filter((q) => q.supplier_id === supplier.id);
  const queue = response?.status === "extracted" ? buildReviewQueue({ values, flags, clarifications, questionnaire, questions: all.rfx.questionnaire }) : [];
  return {
    supplier,
    response,
    formats: [...new Set(documents.map((d) => formatLabel(d.mime_type)))],
    queueCount: queue.length,
    awaiting: clarifications.filter((c) => c.status === "awaiting").length,
    documents,
    values,
    flags,
    terms: all.terms.find((t) => t.response_id === response?.id) ?? null,
    questionnaire,
    clarifications,
    queue,
  };
}

export async function loadQuotes(client: Db, code: string | null): Promise<{ rail: SupplierSummary[]; detail: SupplierDetail | null; rfx: RfxRow }> {
  const all = await loadAll(client);
  const details = all.suppliers.map((s) => detailFor(all, s));
  const rail = details.map(({ supplier, response, formats, queueCount, awaiting }) => ({ supplier, response, formats, queueCount, awaiting }));
  const detail = details.find((d) => d.supplier.code === code) ?? details[0] ?? null;
  return { rail, detail, rfx: all.rfx };
}
