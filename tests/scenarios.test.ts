import { describe, expect, it } from "vitest";
import groundTruth from "@/seed/ground_truth.json";
import { computeScenario } from "@/lib/scenarios/compute";
import { dataFromGroundTruth } from "./helpers/groundTruthData";

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
