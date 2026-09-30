import { describe, expect, it } from "vitest";
import { gstinState, isValidGstin } from "@/lib/gstin";
import { LINE_ITEMS, MEMORY_INDEX, QUESTIONNAIRE, SUPPLIERS, USD_INR } from "@/seed/data";

// Value on or before a date, as the freshness rules will read it.
function valueOn(points: [string, number][], date: string): number {
  const match = points.filter(([d]) => d <= date).at(-1);
  if (!match) throw new Error(`no point on or before ${date}`);
  return match[1];
}
const pctChange = (from: number, to: number) => ((to - from) / from) * 100;

describe("seed line items match the Dataset section", () => {
  it("has 30 lines numbered 1 to 30", () => {
    expect(LINE_ITEMS.map((l) => l.line_no)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("totals about ₹1.40 crore at last-cycle prices", () => {
    const total = LINE_ITEMS.reduce((sum, l) => sum + l.quantity * l.last_cycle_price_inr, 0);
    expect(total).toBeGreaterThan(1.35e7);
    expect(total).toBeLessThan(1.45e7);
  });

  it("marks exactly lines 1, 2, 5, 6 and 28 as memory-exposed", () => {
    expect(LINE_ITEMS.filter((l) => l.memory_exposed).map((l) => l.line_no)).toEqual([1, 2, 5, 6, 28]);
  });
});

describe("seed suppliers and questionnaire", () => {
  it("has suppliers A to E with Prakash as the only incumbent", () => {
    expect(SUPPLIERS.map((s) => s.code)).toEqual(["A", "B", "C", "D", "E"]);
    expect(SUPPLIERS.filter((s) => s.is_incumbent).map((s) => s.name)).toEqual(["Prakash Distributors"]);
  });

  it("gives every supplier a valid GSTIN whose state code matches its state", () => {
    for (const s of SUPPLIERS) {
      expect(isValidGstin(s.gstin), s.code).toBe(true);
      expect(gstinState(s.gstin), s.code).toBe(s.state);
    }
  });

  it("registers E in Tamil Nadu (Chennai branch) while it quotes in USD", () => {
    const e = SUPPLIERS.find((s) => s.code === "E")!;
    expect(e.gstin.slice(0, 2)).toBe("33");
    expect(e.state).toBe("Tamil Nadu");
    expect(e.default_currency).toBe("USD");
  });

  it("has the 8 questionnaire questions with unique keys", () => {
    expect(QUESTIONNAIRE).toHaveLength(8);
    expect(new Set(QUESTIONNAIRE.map((q) => q.key)).size).toBe(8);
  });
});

describe("illustrative memory index", () => {
  const points = MEMORY_INDEX.points;
  const asOf = "2026-09-30";

  it("rises about 11% from June to September", () => {
    const overall = pctChange(points[0][1], points.at(-1)![1]);
    expect(overall).toBeGreaterThan(10.5);
    expect(overall).toBeLessThan(11.5);
  });

  it("moves more than 10% since D's 4 Jun rate card (High)", () => {
    expect(pctChange(valueOn(points, "2026-06-04"), valueOn(points, asOf))).toBeGreaterThan(10);
  });

  it("moves less than 3% after 14 Sep, so no quote from then gets a market flag", () => {
    const since14 = pctChange(valueOn(points, "2026-09-14"), valueOn(points, asOf));
    expect(since14).toBeLessThan(3);
  });
});

describe("illustrative USD/INR", () => {
  it("runs from 83.10 on 14 Sep to 84.60 on 30 Sep", () => {
    expect(USD_INR.points[0]).toEqual(["2026-09-14", 83.1]);
    expect(USD_INR.points.at(-1)).toEqual(["2026-09-30", 84.6]);
  });

  it("moves more than 1.5% over E's quote window", () => {
    expect(pctChange(valueOn(USD_INR.points, "2026-09-14"), valueOn(USD_INR.points, "2026-09-30"))).toBeGreaterThan(1.5);
  });
});
