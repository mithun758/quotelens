// Scores the stored extraction against seed/ground_truth.json. Evaluation only:
// this is the one place app code reads the ground truth.
import groundTruth from "@/seed/ground_truth.json";
import type { Db } from "@/lib/db/client";
import { parseAmount } from "@/lib/normalise/amount";

type GtLine = {
  line_no: number;
  raw_value: string | null;
  raw_currency: string | null;
  expected_confidence: string;
  expected_normalised_inr: number | null;
};

export type LineResult = {
  line_no: number;
  expected: { value: number | null; confidence: string; raw: string | null };
  actual: { value: number | null; confidence: string | null; raw: string | null };
  valueOk: boolean;
  confidenceOk: boolean;
  rawOk: boolean;
};

export type SupplierScore = {
  code: string;
  name: string;
  status: string | null;
  lines: LineResult[];
  valueAccuracy: number;
  confidenceAccuracy: number;
  rawAccuracy: number;
  terms: { field: string; expected: string | null; actual: string | null; ok: boolean }[];
  questionnaire: { key: string; expected: string; actual: string | null; ok: boolean }[];
};

export type EvalReport = {
  suppliers: SupplierScore[];
  overall: { fields: number; correct: number; accuracy: number; valueAccuracy: number; confidenceAccuracy: number };
  extractedAt: string | null;
};

const VALUE_TOLERANCE_INR = 1;
const pct = (ok: number, total: number) => (total ? ok / total : 0);

function rawMatches(expected: GtLine, actualRaw: string | null): boolean {
  if (expected.expected_confidence === "missing") return true;
  if (expected.raw_currency === null) return actualRaw !== null; // "same as last year": any quoted reference
  return parseAmount(expected.raw_value) === parseAmount(actualRaw);
}

export async function scoreExtraction(client: Db): Promise<EvalReport> {
  const [suppliersRes, responsesRes, valuesRes, linesRes, termsRes, answersRes, eventRes, docsRes] = await Promise.all([
    client.from("supplier").select("*").order("code"),
    client.from("response").select("*"),
    client.from("extracted_value").select("*").eq("field", "unit_price"),
    client.from("line_item").select("id, line_no"),
    client.from("quote_terms").select("*"),
    client.from("questionnaire_answer").select("*"),
    client.from("audit_event").select("created_at").eq("action", "extract_response").order("created_at", { ascending: false }).limit(1),
    client.from("document").select("response_id, file_name"),
  ]);
  // After Sri Ganesh's reconfirmation reply arrives, its revised lines and terms are
  // scored against the "after" beat in the ground truth.
  const reconfirm = groundTruth.demo_beats.d_reconfirmation;
  const reconfirmFile = reconfirm.trigger.match(/\(([^)]+)\)/)?.[1] ?? "";
  for (const r of [suppliersRes, responsesRes, valuesRes, linesRes, termsRes, answersRes]) if (r.error) throw new Error(r.error.message);
  const lineNo = new Map((linesRes.data ?? []).map((l) => [l.id, l.line_no]));

  const suppliers: SupplierScore[] = [];
  for (const supplier of suppliersRes.data ?? []) {
    const gt = groundTruth.suppliers[supplier.code as keyof typeof groundTruth.suppliers];
    if (!gt) continue;
    const response = responsesRes.data!.find((r) => r.supplier_id === supplier.id);
    const values = (valuesRes.data ?? []).filter((v) => v.response_id === response?.id);
    const byLine = new Map(values.map((v) => [lineNo.get(v.line_item_id ?? ""), v]));

    const reconfirmed = supplier.code === "D" && (docsRes.data ?? []).some((d) => d.response_id === response?.id && d.file_name === reconfirmFile);
    const afterPrices = reconfirm.after.prices_inr as Record<string, number>;
    const lines: LineResult[] = (gt.lines as GtLine[]).map((original) => {
      const revisedPrice = reconfirmed ? afterPrices[String(original.line_no)] : undefined;
      const e: GtLine = revisedPrice ? { ...original, expected_normalised_inr: revisedPrice, raw_value: revisedPrice.toLocaleString("en-IN"), expected_confidence: "extracted" } : original;
      const a = byLine.get(e.line_no);
      const actualValue = a?.normalised_value_inr ?? null;
      const valueOk =
        e.expected_normalised_inr === null ? actualValue === null : actualValue !== null && Math.abs(actualValue - e.expected_normalised_inr) <= VALUE_TOLERANCE_INR;
      return {
        line_no: e.line_no,
        expected: { value: e.expected_normalised_inr, confidence: e.expected_confidence, raw: e.raw_value },
        actual: { value: actualValue, confidence: a?.confidence_state ?? null, raw: a?.raw_value ?? null },
        valueOk,
        confidenceOk: a?.confidence_state === e.expected_confidence,
        rawOk: rawMatches(e, a?.raw_value ?? null),
      };
    });

    const terms = termsRes.data!.find((t) => t.response_id === response?.id);
    const termChecks = [
      { field: "quote_date", expected: reconfirmed ? reconfirm.after.quote_date : gt.terms.quote_date, actual: terms?.quote_date ?? null },
      { field: "valid_until", expected: reconfirmed ? reconfirm.after.valid_until : gt.terms.valid_until, actual: terms?.valid_until ?? null },
    ].map((t) => ({ ...t, ok: t.expected === t.actual }));

    const qKey = supplier.code === "E" ? "E_before_clarification" : supplier.code;
    const expectedQ = groundTruth.questionnaire[qKey as keyof typeof groundTruth.questionnaire];
    const answers = (answersRes.data ?? []).filter((a) => a.supplier_id === supplier.id);
    const questionnaire = Object.entries(expectedQ).map(([key, exp]) => {
      const actual = answers.find((a) => a.question_key === key)?.pass_fail ?? null;
      return { key, expected: exp.result, actual, ok: exp.result === actual };
    });

    suppliers.push({
      code: supplier.code,
      name: supplier.name,
      status: response?.status ?? null,
      lines,
      valueAccuracy: pct(lines.filter((l) => l.valueOk).length, lines.length),
      confidenceAccuracy: pct(lines.filter((l) => l.confidenceOk).length, lines.length),
      rawAccuracy: pct(lines.filter((l) => l.rawOk).length, lines.length),
      terms: termChecks,
      questionnaire,
    });
  }

  // A field is one checked value: a line's value, its confidence state, a term or a question.
  let fields = 0;
  let correct = 0;
  for (const s of suppliers) {
    for (const l of s.lines) {
      fields += 2;
      correct += Number(l.valueOk) + Number(l.confidenceOk);
    }
    for (const t of s.terms) { fields++; correct += Number(t.ok); }
    for (const q of s.questionnaire) { fields++; correct += Number(q.ok); }
  }
  const allLines = suppliers.flatMap((s) => s.lines);
  return {
    suppliers,
    overall: {
      fields,
      correct,
      accuracy: pct(correct, fields),
      valueAccuracy: pct(allLines.filter((l) => l.valueOk).length, allLines.length),
      confidenceAccuracy: pct(allLines.filter((l) => l.confidenceOk).length, allLines.length),
    },
    extractedAt: eventRes.data?.[0]?.created_at ?? null,
  };
}
