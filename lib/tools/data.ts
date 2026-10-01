// One consistent snapshot of the comparison data for an analyst question. Every tool
// reads from it, so all numbers in one answer come from the same state.
import { asOfDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import type { ClarificationRow, LineItemRow, QuoteDiscount, RfxRow } from "@/lib/db/types";
import { loadFreshness } from "@/lib/freshness/load";
import type { FreshnessResult } from "@/lib/freshness/rules";
import { loadAllDetails, type ValueWithLine } from "@/lib/quotes/load";

export type SupplierInfo = {
  code: string;
  name: string;
  isIncumbent: boolean;
  questionnairePassed: number;
  questionnaireTotal: number;
  questionnaireFailures: { key: string; answer: string | null }[];
  freshness: FreshnessResult | null;
  quoteDate: string | null;
  validUntil: string | null;
  discounts: QuoteDiscount[];
  responseFlags: { id: string; type: string; severity: string; message: string; status: string }[];
  documents: Record<string, string>;
};

export type Cell = ValueWithLine & {
  openFlags: { id: string; type: string; severity: string; message: string }[];
};

export type AnalystData = {
  asOfDate: string;
  rfx: RfxRow;
  lines: LineItemRow[];
  suppliers: SupplierInfo[];
  // cells[supplierCode][lineNo]
  cells: Record<string, Record<number, Cell>>;
  clarifications: (ClarificationRow & { supplierCode: string; lineNo: number | null })[];
};

export async function loadAnalystData(client: Db): Promise<AnalystData> {
  const [{ rfx, lines, details }, freshness] = await Promise.all([loadAllDetails(client), loadFreshness(client)]);
  const lineNoById = new Map(lines.map((l) => [l.id, l.line_no]));
  const cells: AnalystData["cells"] = {};
  const clarifications: AnalystData["clarifications"] = [];

  const suppliers = details.map((d): SupplierInfo => {
    const code = d.supplier.code;
    cells[code] = {};
    for (const v of d.values.filter((x) => x.field === "unit_price" && x.line_no !== null)) {
      cells[code][v.line_no!] = {
        ...v,
        openFlags: d.flags.filter((f) => f.extracted_value_id === v.id && f.status === "open").map(({ id, type, severity, message }) => ({ id, type, severity, message })),
      };
    }
    for (const c of d.clarifications) clarifications.push({ ...c, supplierCode: code, lineNo: c.line_item_id ? (lineNoById.get(c.line_item_id) ?? null) : null });
    return {
      code,
      name: d.supplier.name,
      isIncumbent: d.supplier.is_incumbent,
      questionnairePassed: d.questionnaire.filter((q) => q.pass_fail === "pass").length,
      questionnaireTotal: rfx.questionnaire.length,
      questionnaireFailures: d.questionnaire.filter((q) => q.pass_fail !== "pass").map((q) => ({ key: q.question_key, answer: q.answer })),
      freshness: freshness[code] ?? null,
      quoteDate: d.terms?.quote_date ?? null,
      validUntil: d.terms?.valid_until ?? null,
      discounts: d.terms?.discounts ?? [],
      responseFlags: d.flags.filter((f) => f.response_id).map(({ id, type, severity, message, status }) => ({ id, type, severity, message, status })),
      documents: Object.fromEntries(d.documents.map((doc) => [doc.id, doc.file_name])),
    };
  });

  return { asOfDate: asOfDate(), rfx, lines, suppliers, cells, clarifications };
}
