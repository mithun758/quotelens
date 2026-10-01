import { describe, expect, it } from "vitest";
import { linesReady } from "@/lib/award/readiness";
import { decisionReady } from "@/lib/comparison/decisionReady";
import { extractionSummary } from "@/lib/quotes/extraction";
import { comparisonInputs } from "@/lib/tools/shared";
import { dataFromGroundTruth } from "./helpers/groundTruthData";

describe("decision-ready preset", () => {
  it("keeps only qualified suppliers whose quote is not Stale, and says why the rest are out", () => {
    const data = dataFromGroundTruth();
    const r = decisionReady({
      suppliers: data.suppliers,
      freshness: Object.fromEntries(data.suppliers.map((s) => [s.code, s.freshness])),
      lines: data.lines,
      inputs: comparisonInputs(data, data.suppliers.map((s) => s.code)).cells,
    });
    // Ground truth: A and B qualify; B is Stale.
    expect(r.included).toEqual(["A"]);
    expect(r.excluded.find((e) => e.code === "B")!.reasons).toEqual(["quote is Stale"]);
    expect(r.excluded.find((e) => e.code === "D")!.reasons).toHaveLength(2);
    expect(r.result.lines.every((l) => l.l1.every((s) => s === "A"))).toBe(true);
  });
});

describe("lines ready for award", () => {
  it("counts allocated lines with no open blocker on the line or its supplier", () => {
    const allocation = [
      { line: 1, supplier: "A" },
      { line: 2, supplier: "A" },
      { line: 3, supplier: "B" },
    ];
    expect(linesReady(allocation, [])).toBe(3);
    expect(linesReady(allocation, [{ supplier: "A", line: 2, override: null }])).toBe(2);
    expect(linesReady(allocation, [{ supplier: "B", line: null, override: null }])).toBe(2);
    expect(linesReady(allocation, [{ supplier: "B", line: null, override: { key: "x", reason: "ok", at: "" } as never }])).toBe(3);
  });
});

describe("extraction summary", () => {
  it("separates items found, lines mapped and lines missing", () => {
    const v = (line: number | null, field = "unit_price", confidence = "extracted") => ({ line_no: line, field, confidence_state: confidence }) as never;
    const s = extractionSummary({ values: [v(1), v(2), v(3, "unit_price", "missing"), v(null, "unmatched_item")], queue: [{} as never] }, 30);
    expect(s).toEqual({ found: 3, mapped: 2, needsReview: 1, missing: 28 });
  });
});
