import groundTruth from "@/seed/ground_truth.json";
import { LINE_ITEMS, QUESTIONNAIRE } from "@/seed/data";
import { PRIOR_PRICING_REASON } from "@/lib/normalise/normaliseResponse";
import type { AnalystData, Cell, SupplierInfo } from "@/lib/tools/data";
import type { LineItemRow } from "@/lib/db/types";

type Code = keyof typeof groundTruth.suppliers;
const CODES: Code[] = ["A", "B", "C", "D", "E"];
const FRESHNESS = { A: "Fresh", B: "Stale", C: "Fresh", D: "Stale", E: "Reconfirm" } as const;

// An analyst data snapshot built from the ground truth, as if extraction were perfect.
export function dataFromGroundTruth({ eQualified = false, substitutesApproved = false } = {}): AnalystData {
  const lines = LINE_ITEMS.map((l) => ({ ...l, id: `l${l.line_no}`, rfx_id: "r", acceptable_equivalents: null, created_at: "" })) as LineItemRow[];
  const cells: AnalystData["cells"] = {};
  for (const code of CODES) {
    cells[code] = {};
    for (const l of groundTruth.suppliers[code].lines) {
      const sub = code === "C" && (l.line_no === 1 || l.line_no === 22);
      cells[code][l.line_no] = {
        normalised_value_inr: l.expected_normalised_inr,
        confidence_state: l.expected_confidence,
        status: "needs_review",
        substitute_status: sub ? (substitutesApproved ? "approved" : "pending") : null,
        id: `${code}-${l.line_no}`,
        reason: l.raw_value === "same as last year's rates" ? PRIOR_PRICING_REASON : null,
        openFlags: [],
      } as unknown as Cell;
    }
  }
  const passed = (code: Code) => (code === "A" || code === "B" || (code === "E" && eQualified) ? QUESTIONNAIRE.length : 1);
  const suppliers = CODES.map(
    (code) =>
      ({
        code,
        name: groundTruth.suppliers[code].name,
        isIncumbent: code === "A",
        questionnairePassed: passed(code),
        questionnaireTotal: QUESTIONNAIRE.length,
        questionnaireFailures: [],
        freshness: { status: FRESHNESS[code], fired: FRESHNESS[code] === "Fresh" ? [] : [{ key: "x", label: "Rule", fired: true, severity: FRESHNESS[code] === "Stale" ? "high" : "medium", reason: "Reason", action: "Action", lines: [] }], rules: [] },
        quoteDate: null,
        validUntil: null,
        discounts: code === "B" ? [{ percent: 4, threshold_inr: 2500000, condition: "orders above ₹25 lakh", applies_to_lines: [], description: "Footnote" }] : [],
        responseFlags: [],
        documents: {},
      }) as unknown as SupplierInfo,
  );
  return { asOfDate: "2026-09-30", rfx: { approval_days: 10 } as AnalystData["rfx"], lines, suppliers, cells, clarifications: [] };
}

