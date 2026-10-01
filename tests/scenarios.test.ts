import { describe, expect, it } from "vitest";
import groundTruth from "@/seed/ground_truth.json";
import { LINE_ITEMS, QUESTIONNAIRE } from "@/seed/data";
import { computeScenario } from "@/lib/scenarios/compute";
import { PRIOR_PRICING_REASON } from "@/lib/normalise/normaliseResponse";
import type { AnalystData, Cell, SupplierInfo } from "@/lib/tools/data";
import type { LineItemRow } from "@/lib/db/types";

type Code = keyof typeof groundTruth.suppliers;
const CODES: Code[] = ["A", "B", "C", "D", "E"];
const FRESHNESS = { A: "Fresh", B: "Stale", C: "Fresh", D: "Stale", E: "Reconfirm" } as const;

// An analyst data snapshot built from the ground truth, as if extraction were perfect.
function dataFromGroundTruth({ eQualified = false, substitutesApproved = false } = {}): AnalystData {
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
        freshness: { status: FRESHNESS[code], fired: [], rules: [] },
        quoteDate: null,
        validUntil: null,
        discounts: code === "B" ? [{ percent: 4, threshold_inr: 2500000, condition: "orders above ₹25 lakh", applies_to_lines: [], description: "Footnote" }] : [],
        responseFlags: [],
        documents: {},
      }) as SupplierInfo,
  );
  return { asOfDate: "2026-09-30", rfx: { approval_days: 10 } as AnalystData["rfx"], lines, suppliers, cells, clarifications: [] };
}

const Q6 = { scenario: "best_quote" as const, filter: { questionnaire_passed_only: true, exclude_freshness: ["Stale" as const] } };

describe("computeScenario", () => {
  it("Q6 before clarification: everything to A, matching the ground truth", () => {
    const r = computeScenario(dataFromGroundTruth(), Q6);
    const gt = groundTruth.demo_beats.q6.before_clarification.summary;
    expect(r.by_supplier.map((b) => b.supplier)).toEqual(["A"]);
    expect(r.total_inr).toBe(gt.total_inr);
    expect(r.saving_vs_last_cycle_inr).toBe(gt.saving_vs_last_cycle_inr);
  });

  it("Q6 after clarification: A plus E, with E on both laptops, matching the ground truth", () => {
    const r = computeScenario(dataFromGroundTruth({ eQualified: true }), Q6);
    const gt = groundTruth.demo_beats.q6.after_clarification.summary;
    expect(r.by_supplier.map((b) => b.supplier)).toEqual(["A", "E"]);
    expect(r.allocation.filter((a) => a.supplier === "E").map((a) => a.line)).toEqual(gt.lines_by_supplier.E);
    expect(r.total_inr).toBe(gt.total_inr);
    expect(r.prior_pricing_lines).toEqual(gt.lines_on_prior_pricing);
  });

  it("applies B's 4% only when B's awarded subtotal is above ₹25 lakh", () => {
    const data = dataFromGroundTruth();
    const split = computeScenario(data, { scenario: "best_quote" });
    expect(split.discounts.find((d) => d.supplier === "B")!.applied).toBe(false);
    const allToB = computeScenario(data, { scenario: "custom", default_supplier: "B" });
    const d = allToB.discounts.find((x) => x.supplier === "B")!;
    expect(d.applied).toBe(true);
    expect(d.amount_inr).toBeCloseTo(allToB.by_supplier[0].subtotal_inr * 0.04, 2);
    expect(allToB.unallocated.map((u) => u.line)).toEqual([23, 29]);
  });

  it("never awards a substitute awaiting sign-off; approval makes it eligible", () => {
    const pending = computeScenario(dataFromGroundTruth(), { scenario: "custom", default_supplier: "C" });
    expect(pending.unallocated.map((u) => u.line)).toEqual([1, 22]);
    const approved = computeScenario(dataFromGroundTruth({ substitutesApproved: true }), { scenario: "custom", default_supplier: "C" });
    expect(approved.unallocated).toEqual([]);
  });

  it("incumbent and best-quote-without-incumbent use the incumbent flag", () => {
    const data = dataFromGroundTruth();
    expect(computeScenario(data, { scenario: "incumbent" }).by_supplier.map((b) => b.supplier)).toEqual(["A"]);
    expect(computeScenario(data, { scenario: "best_quote_without_incumbent" }).by_supplier.map((b) => b.supplier)).not.toContain("A");
  });
});
