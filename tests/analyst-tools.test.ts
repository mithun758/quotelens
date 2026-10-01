import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { computeScenario } from "@/lib/scenarios/compute";
import { compareScenarios } from "@/lib/tools/compare_scenarios";
import { getFreshness } from "@/lib/tools/get_freshness";
import { rankLines } from "@/lib/tools/rank_lines";
import { dataFromGroundTruth } from "./helpers/groundTruthData";

const ctx = (data = dataFromGroundTruth()) => ({ data, client: {} as Db });

describe("rank_lines", () => {
  it("separates the L1-to-L2 gap from the spread, and reports the incumbent's premium", async () => {
    const data = dataFromGroundTruth();
    const out = await rankLines.run(ctx(data), {});
    for (const l of out.lines.filter((x) => x.l1_unit_inr !== null && x.l2_unit_inr !== null)) {
      expect(l.l1_to_l2_gap_line_inr).toBeCloseTo((l.l2_unit_inr! - l.l1_unit_inr!) * l.quantity, 2);
      expect(l.highest_unit_inr!).toBeGreaterThanOrEqual(l.l2_unit_inr!);
      expect(l.l2_suppliers.length).toBeGreaterThan(0);
    }
    expect(out.incumbent).toBe("A");
    const withA = out.lines.filter((l) => l.incumbent_unit_inr !== null);
    expect(withA.length).toBe(30);
    for (const l of withA) expect(l.incumbent_premium_over_l1_pct!).toBeGreaterThanOrEqual(0);
  });
});

describe("compare_scenarios", () => {
  it("returns the saving of B against A, and a like-for-like saving on common lines", async () => {
    const data = dataFromGroundTruth();
    const a = { scenario: "incumbent" as const };
    const b = { scenario: "custom" as const, default_supplier: "B" };
    const out = await compareScenarios.run(ctx(data), { a, b });
    const ra = computeScenario(data, a);
    const rb = computeScenario(data, b);
    expect(out.saving_of_b_vs_a_inr).toBeCloseTo(ra.total_inr - rb.total_inr, 2);
    expect(out.same_lines_allocated).toBe(false);
    expect(out.common_lines).not.toContain(23);
    expect(out.common_lines_a_inr).toBeLessThan(ra.total_inr);
  });
});

describe("get_freshness", () => {
  it("reports no FX exposure for suppliers with no converted lines", async () => {
    const out = await getFreshness.run(ctx(), {});
    expect(out.suppliers.every((s) => s.fx_exposure === null)).toBe(true);
  });

  it("totals the rupee exposure on lines converted from USD", async () => {
    const data = dataFromGroundTruth();
    data.cells.E[1] = { ...data.cells.E[1], line_no: 1, raw_currency: "USD", normalised_value_inr: 62604, steps: [{ kind: "fx", rate: 84.6, rate_date: "2026-09-30" }] } as never;
    const out = await getFreshness.run(ctx(data), { suppliers: ["E"] });
    const fx = out.suppliers[0].fx_exposure!;
    const qty = data.lines.find((l) => l.line_no === 1)!.quantity;
    expect(fx.currencies).toEqual(["USD"]);
    expect(fx.total_inr).toBeCloseTo(62604 * qty, 2);
    expect(fx.total_foreign).toBeCloseTo(740 * qty, 0);
    expect(fx.inr_change_per_1pct_rate_move).toBeCloseTo(626.04 * qty, 2);
  });
});

describe("describeDelta", () => {
  it("words a difference without a minus sign", async () => {
    const { describeDelta } = await import("@/lib/format/inr");
    expect(describeDelta(-132000, "last cycle")).toBe("₹1.32 lakh more than last cycle");
    expect(describeDelta(358000, "the recommendation")).toBe("₹3.58 lakh less than the recommendation");
    expect(describeDelta(0, "last cycle")).toBe("the same as last cycle");
  });
});
