// Assembles the Quote Comparison from stored extraction: cells for display and the
// pure comparison result for every total, L1 and spread.
import type { Db } from "@/lib/db/client";
import type { LineItemRow, QuestionnaireAnswerRow, QuestionnaireQuestion, SupplierRow } from "@/lib/db/types";
import { formatLabel, loadAllDetails, type ValueWithLine } from "@/lib/quotes/load";
import { loadFreshness } from "@/lib/freshness/load";
import type { FreshnessResult } from "@/lib/freshness/rules";
import { buildComparison, type ComparisonCellInput, type ComparisonResult } from "./build";

export type ComparisonCell = ValueWithLine & {
  documentName: string | null;
  openFlags: { type: string; severity: string; message: string }[];
};

export type ComparisonView = {
  lines: LineItemRow[];
  suppliers: (SupplierRow & { formats: string[]; questionnairePassed: number; questionnaireTotal: number; documents: { id: string; file_name: string; format: string }[] })[];
  cells: Record<string, Record<number, ComparisonCell>>;
  result: ComparisonResult;
  questions: QuestionnaireQuestion[];
  answers: Record<string, Record<string, QuestionnaireAnswerRow>>;
  freshness: Record<string, FreshnessResult>;
  terms: Record<string, { quoteDate: string | null; validUntil: string | null; freight: string | null; payment: string | null; warranty: string | null }>;
  approvalDays: number;
};

export async function loadComparison(client: Db): Promise<ComparisonView> {
  const [{ rfx, lines, details }, freshness] = await Promise.all([loadAllDetails(client), loadFreshness(client)]);
  const cells: ComparisonView["cells"] = {};
  const inputs: Record<string, Record<number, ComparisonCellInput>> = {};

  for (const d of details) {
    const code = d.supplier.code;
    cells[code] = {};
    inputs[code] = {};
    const docName = new Map(d.documents.map((doc) => [doc.id, doc.file_name]));
    for (const v of d.values.filter((x) => x.field === "unit_price" && x.line_no !== null)) {
      cells[code][v.line_no!] = {
        ...v,
        documentName: v.source_document_id ? (docName.get(v.source_document_id) ?? null) : null,
        openFlags: d.flags.filter((f) => f.extracted_value_id === v.id && f.status === "open").map(({ type, severity, message }) => ({ type, severity, message })),
      };
      inputs[code][v.line_no!] = {
        value: v.normalised_value_inr,
        confidence: v.confidence_state,
        // Only substitutes that deviate need sign-off; compliant equivalents count at once.
        isSubstitute: v.substitute_status !== null,
        substituteStatus: v.substitute_status,
      };
    }
  }

  const result = buildComparison({
    suppliers: details.map((d) => d.supplier.code),
    lines: lines.map((l) => ({ lineNo: l.line_no, quantity: l.quantity, lastCycle: l.last_cycle_price_inr })),
    cells: inputs,
  });

  return {
    lines,
    suppliers: details.map((d) => ({
      ...d.supplier,
      formats: d.formats,
      questionnairePassed: d.questionnaire.filter((q) => q.pass_fail === "pass").length,
      questionnaireTotal: rfx.questionnaire.length,
      documents: d.documents.map((doc) => ({ id: doc.id, file_name: doc.file_name, format: formatLabel(doc.mime_type) })),
    })),
    cells,
    result,
    questions: rfx.questionnaire,
    answers: Object.fromEntries(details.map((d) => [d.supplier.code, Object.fromEntries(d.questionnaire.map((q) => [q.question_key, q]))])),
    freshness,
    terms: Object.fromEntries(
      details.map((d) => [
        d.supplier.code,
        { quoteDate: d.terms?.quote_date ?? null, validUntil: d.terms?.valid_until ?? null, freight: d.terms?.freight_terms ?? null, payment: d.terms?.payment_terms ?? null, warranty: d.terms?.warranty ?? null },
      ]),
    ),
    approvalDays: rfx.approval_days,
  };
}
