import { describe, expect, it } from "vitest";
import { scenarioBlockers } from "@/lib/blockers/scenario";
import { negotiationLines } from "@/lib/award/negotiation";
import { DEFAULT_SPEC, toScenarioSpec } from "@/lib/award/spec";
import { computeScenario } from "@/lib/scenarios/compute";
import { dataFromGroundTruth } from "./helpers/groundTruthData";

describe("award spec", () => {
  it("defaults to questionnaire passed and substitutes approved, no freshness exclusion", () => {
    expect(toScenarioSpec(DEFAULT_SPEC)).toMatchObject({ scenario: "best_quote", filter: { questionnaire_passed_only: true, exclude_freshness: [] }, include_pending_substitutes: false });
  });

  it("maps freshness toggles and the substitute toggle", () => {
    const s = toScenarioSpec({ ...DEFAULT_SPEC, exclude_stale: true, exclude_reconfirm: true, require_substitute_approval: false });
    expect(s.filter?.exclude_freshness).toEqual(["Stale", "Reconfirm"]);
    expect(s.include_pending_substitutes).toBe(true);
  });

  it("counts pending substitutes only when the toggle allows it", () => {
    const data = dataFromGroundTruth();
    const strict = computeScenario(data, { scenario: "custom", default_supplier: "C" });
    const relaxed = computeScenario(data, { scenario: "custom", default_supplier: "C", include_pending_substitutes: true });
    expect(strict.unallocated.map((u) => u.line)).toEqual([1, 22]);
    expect(relaxed.unallocated).toEqual([]);
  });
});

describe("award blockers", () => {
  it("the Q6 award to A has exactly A's 8 Inferred lines as blockers, with stable keys", () => {
    const data = dataFromGroundTruth();
    const q6 = computeScenario(data, { scenario: "best_quote", filter: { questionnaire_passed_only: true, exclude_freshness: ["Stale"] } });
    const blockers = scenarioBlockers(data, q6);
    expect(blockers.map((b) => b.key)).toEqual([1, 20, 21, 22, 23, 24, 25, 30].map((n) => `inferred_value:A:${n}`));
    expect(blockers.every((b) => b.resolve.kind === "accept_value")).toBe(true);
  });

  it("a Stale supplier in the award is a blocker that cannot be resolved inline", () => {
    const data = dataFromGroundTruth();
    const withB = computeScenario(data, { scenario: "best_quote", filter: { questionnaire_passed_only: true } });
    const stale = scenarioBlockers(data, withB).find((b) => b.type === "stale_supplier")!;
    expect(stale).toMatchObject({ key: "stale_supplier:B", resolve: { kind: "none" } });
  });

  it("lines no eligible supplier can price are blockers", () => {
    const data = dataFromGroundTruth();
    const allB = computeScenario(data, { scenario: "custom", default_supplier: "B" });
    expect(scenarioBlockers(data, allB).filter((b) => b.type === "unallocated_line").map((b) => b.key)).toEqual(["unallocated_line:23", "unallocated_line:29"]);
  });
});

describe("send to negotiation", () => {
  it("lists awarded lines more than 5% above L1 or last cycle, with the lower as target", () => {
    const data = dataFromGroundTruth();
    const incumbent = computeScenario(data, { scenario: "incumbent" });
    const lines = negotiationLines(incumbent);
    const line28 = lines.find((l) => l.line === 28)!; // A at 9,350 vs last cycle 8,500 (+10%) and D's 7,820
    expect(line28.above_last_cycle_pct).toBe(10);
    expect(line28.target_unit_inr).toBe(7820);
    expect(lines.every((l) => (l.above_l1_pct ?? 0) > 5 || (l.above_last_cycle_pct ?? 0) > 5)).toBe(true);
    expect(lines.find((l) => l.line === 7)!.above_l1_pct).toBe(6.38); // A 9,500 vs L1 B 8,930
    expect(lines.map((l) => l.line)).not.toContain(3); // A 1,180: 1.72% above L1, below last cycle
  });
});
