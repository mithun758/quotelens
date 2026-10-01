import { describe, expect, it } from "vitest";
import groundTruth from "@/seed/ground_truth.json";
import { LINE_ITEMS } from "@/seed/data";
import { buildComparison, cheapest, type ComparisonCellInput } from "@/lib/comparison/build";
import { formatInrCompact } from "@/lib/format/inr";

const cell = (value: number | null, extra: Partial<ComparisonCellInput> = {}): ComparisonCellInput => ({
  value,
  confidence: value === null ? "missing" : "extracted",
  isSubstitute: false,
  substituteStatus: null,
  ...extra,
});

const lines = [
  { lineNo: 1, quantity: 10, lastCycle: 100 },
  { lineNo: 2, quantity: 2, lastCycle: 50 },
];

describe("buildComparison", () => {
  it("finds L1, L2 and spread among countable cells", () => {
    const r = buildComparison({ suppliers: ["A", "B"], lines, cells: { A: { 1: cell(90), 2: cell(60) }, B: { 1: cell(110), 2: cell(40) } } });
    expect(r.lines[0]).toMatchObject({ l1: ["A"], l1Value: 90, l2Value: 110, spreadPct: 22.22 });
    expect(r.lines[1].l1).toEqual(["B"]);
  });

  it("common basket only includes lines every supplier can be counted on", () => {
    const r = buildComparison({ suppliers: ["A", "B"], lines, cells: { A: { 1: cell(90), 2: cell(60) }, B: { 1: cell(110), 2: cell(null) } } });
    expect(r.commonBasket).toEqual([1]);
    expect(r.suppliers.find((s) => s.code === "A")!.commonBasketTotal).toBe(900);
    expect(r.lastCycleCommonBasket).toBe(1000);
  });

  it("all-lines mode prices a gap at the lowest other quote and says which lines", () => {
    const r = buildComparison({ suppliers: ["A", "B"], lines, cells: { A: { 1: cell(90), 2: cell(60) }, B: { 1: cell(110), 2: cell(null) } } });
    const b = r.suppliers.find((s) => s.code === "B")!;
    expect(b.gapFilledLines).toEqual([2]);
    expect(b.allLinesTotal).toBe(110 * 10 + 60 * 2);
  });

  it("a pending substitute is shown but not counted until approved", () => {
    const pending = buildComparison({ suppliers: ["A", "B"], lines, cells: { A: { 1: cell(80, { isSubstitute: true, substituteStatus: "pending", confidence: "inferred" }), 2: cell(60) }, B: { 1: cell(110), 2: cell(70) } } });
    expect(pending.lines[0].l1).toEqual(["B"]);
    expect(pending.commonBasket).toEqual([2]);
    const approved = buildComparison({ suppliers: ["A", "B"], lines, cells: { A: { 1: cell(80, { isSubstitute: true, substituteStatus: "approved", confidence: "inferred" }), 2: cell(60) }, B: { 1: cell(110), 2: cell(70) } } });
    expect(approved.lines[0].l1).toEqual(["A"]);
    expect(approved.commonBasket).toEqual([1, 2]);
  });

  it("on the seeded ground truth, B is cheapest on the common basket and D is L1 on 9 lines", () => {
    const suppliers = ["A", "B", "C", "D", "E"] as const;
    const cells = Object.fromEntries(
      suppliers.map((s) => [
        s,
        Object.fromEntries(
          groundTruth.suppliers[s].lines.map((l) => [
            l.line_no,
            cell(l.expected_normalised_inr, {
              confidence: l.expected_confidence as ComparisonCellInput["confidence"],
              isSubstitute: s === "C" && (l.line_no === 1 || l.line_no === 22),
              substituteStatus: s === "C" && (l.line_no === 1 || l.line_no === 22) ? "pending" : null,
            }),
          ]),
        ),
      ]),
    );
    const r = buildComparison({
      suppliers: [...suppliers],
      lines: LINE_ITEMS.map((l) => ({ lineNo: l.line_no, quantity: l.quantity, lastCycle: l.last_cycle_price_inr })),
      cells,
    });
    expect(cheapest(r, "common")).toBe("B");
    expect(r.lines.filter((l) => l.l1.includes("D")).map((l) => l.lineNo)).toEqual([5, 6, 9, 10, 19, 21, 24, 26, 28]);
    expect(r.commonBasket).not.toContain(1); // C's laptop substitute is pending
  });
});

describe("formatInrCompact", () => {
  it("uses lakh and crore", () => {
    expect(formatInrCompact(9351720)).toBe("₹93.52 lakh");
    expect(formatInrCompact(14047000)).toBe("₹1.40 crore");
    expect(formatInrCompact(52000)).toBe("₹52,000");
  });
});
