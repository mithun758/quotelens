import { describe, expect, it } from "vitest";
import type { ComparisonCellInput } from "@/lib/comparison/build";
import { decisionReady } from "@/lib/comparison/decisionReady";
import { filterSuppliers } from "@/lib/comparison/filter";
import { daysAfterApproval } from "@/lib/freshness/margin";

const cell = (value: number): ComparisonCellInput => ({ value, confidence: "extracted", isSubstitute: false, substituteStatus: null });
const view = {
  suppliers: [
    { code: "A", questionnairePassed: 8, questionnaireTotal: 8 },
    { code: "B", questionnairePassed: 8, questionnaireTotal: 8 },
    { code: "C", questionnairePassed: 6, questionnaireTotal: 8 },
  ],
  freshness: { A: { status: "Fresh" }, B: { status: "Stale" }, C: { status: "Fresh" } },
  lines: [{ line_no: 1, quantity: 10, last_cycle_price_inr: 100 }],
  inputs: { A: { 1: cell(90) }, B: { 1: cell(80) }, C: { 1: cell(70) } },
};

describe("comparison filter chips", () => {
  it("All keeps every supplier and L1 is the lowest quote", () => {
    const r = filterSuppliers(view, "all");
    expect(r.excluded).toEqual([]);
    expect(r.result.lines[0].l1).toEqual(["C"]);
  });

  it("Qualified drops suppliers failing the questionnaire and recomputes L1", () => {
    const r = filterSuppliers(view, "qualified");
    expect(r.excluded.map((e) => e.code)).toEqual(["C"]);
    expect(r.result.lines[0].l1).toEqual(["B"]);
  });

  it("Not stale drops Stale quotes", () => {
    const r = filterSuppliers(view, "not_stale");
    expect(r.excluded.map((e) => e.code)).toEqual(["B"]);
    expect(r.result.lines[0].l1).toEqual(["C"]);
  });

  it("together the two chips exclude exactly what Decision-ready excludes", () => {
    const out = new Set([...filterSuppliers(view, "qualified").excluded, ...filterSuppliers(view, "not_stale").excluded].map((e) => e.code));
    expect([...out].sort()).toEqual(decisionReady(view).excluded.map((e) => e.code).sort());
  });
});

describe("days after approval", () => {
  it("is negative when the quote lapses before approval completes", () => {
    expect(daysAfterApproval("2026-10-01", "2026-09-30", 10)).toBe(-9);
    expect(daysAfterApproval("2026-10-22", "2026-09-30", 10)).toBe(12);
    expect(daysAfterApproval(null, "2026-09-30", 10)).toBeNull();
  });
});
