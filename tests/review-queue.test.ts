import { describe, expect, it } from "vitest";
import type { ClarificationRow, ExtractedValueRow, FlagRow, QuestionnaireAnswerRow } from "@/lib/db/types";
import { buildReviewQueue } from "@/lib/review/queue";

let n = 0;
function value(overrides: Partial<ExtractedValueRow> & { line_no?: number }): ExtractedValueRow & { line_no: number | null; description: string | null } {
  n++;
  return {
    id: `v${n}`, response_id: "r", line_item_id: `l${overrides.line_no ?? n}`, field: "unit_price", raw_value: "100", raw_unit: "per piece",
    raw_currency: "INR", normalised_value_inr: 100, confidence_state: "extracted", reason: null, source_document_id: "d",
    source_locator: { page: 1 }, source_snippet: "100", match_reason: null, substitute_check: null, substitute_status: null,
    status: "auto_accepted", created_at: "", line_no: n, description: `Line ${n}`, ...overrides,
  };
}
const flag = (o: Partial<FlagRow>): FlagRow => ({ id: `f${++n}`, extracted_value_id: null, response_id: null, type: "x", severity: "medium", message: "m", status: "open", created_at: "", ...o });
const answer = (key: string, pass: "pass" | "fail"): QuestionnaireAnswerRow => ({ id: key, supplier_id: "s", question_key: key, answer: pass === "pass" ? "Yes" : "Not answered.", pass_fail: pass, evidence_document_id: null, created_at: "" });

const base = { flags: [] as FlagRow[], clarifications: [] as ClarificationRow[], questionnaire: [] as QuestionnaireAnswerRow[], questions: [] };

describe("review queue", () => {
  it("shows only Inferred, Missing and flagged values", () => {
    const clean = value({});
    const inferred = value({ confidence_state: "inferred", status: "needs_review", reason: "pack of 10" });
    const missing = value({ confidence_state: "missing", status: "needs_review", normalised_value_inr: null, raw_value: null });
    const flagged = value({});
    const queue = buildReviewQueue({ ...base, values: [clean, inferred, missing, flagged], flags: [flag({ extracted_value_id: flagged.id, message: "GST printed at 28%" })] });
    expect(queue.map((i) => i.valueId).sort()).toEqual([inferred.id, missing.id, flagged.id].sort());
  });

  it("drops a value once accepted and its flags are resolved", () => {
    const accepted = value({ confidence_state: "inferred", status: "confirmed" });
    const queue = buildReviewQueue({ ...base, values: [accepted], flags: [flag({ extracted_value_id: accepted.id, status: "resolved" })] });
    expect(queue).toEqual([]);
  });

  it("never offers Correct on a Missing value", () => {
    const missing = value({ confidence_state: "missing", status: "needs_review", normalised_value_inr: null });
    expect(buildReviewQueue({ ...base, values: [missing] })[0].actions).toEqual(["accept", "ask"]);
  });

  it("lists open response flags but not clarification flags", () => {
    const queue = buildReviewQueue({
      ...base,
      values: [],
      flags: [flag({ response_id: "r", type: "freight_not_included" }), flag({ response_id: "r", type: "clarification_requested" })],
    });
    expect(queue.map((i) => i.field)).toEqual(["freight_not_included"]);
  });

  it("groups failed questionnaire answers into one item, gone once all pass", () => {
    const failing = buildReviewQueue({ ...base, values: [], questionnaire: [answer("iso_9001", "fail"), answer("gst_registration", "pass")] });
    expect(failing.map((i) => i.headline)).toEqual(["Questionnaire: fails 1 of 2"]);
    expect(buildReviewQueue({ ...base, values: [], questionnaire: [answer("iso_9001", "pass")] })).toEqual([]);
  });

  it("shows Awaiting supplier on the value a clarification targets, across re-extraction", () => {
    const missing = value({ confidence_state: "missing", status: "needs_review", normalised_value_inr: null, line_item_id: "line-17" });
    const clarification: ClarificationRow = {
      id: "c1", flag_id: "f", supplier_id: "s", question: "Can you quote line 17?", reply_text: null, status: "awaiting",
      line_item_id: "line-17", field: "unit_price", target_flag_type: null, answered_at: null, created_at: "",
    };
    const [item] = buildReviewQueue({ ...base, values: [missing], clarifications: [clarification] });
    expect(item.clarification?.status).toBe("awaiting");
  });

  it("puts Missing first", () => {
    const inferred = value({ confidence_state: "inferred", status: "needs_review", reason: "x" });
    const missing = value({ confidence_state: "missing", status: "needs_review", normalised_value_inr: null });
    expect(buildReviewQueue({ ...base, values: [inferred, missing] })[0].valueId).toBe(missing.id);
  });
});
