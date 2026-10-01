import { z } from "zod";
import { formatInrCompact } from "@/lib/format/inr";
import { computeScenario, type ScenarioResult } from "@/lib/scenarios/compute";
import { ScenarioInput } from "./compute_scenario";
import { defineTool, round2 } from "./define";

const Summary = z.object({
  scenario: z.string(),
  included_suppliers: z.array(z.string()),
  total_inr: z.number(),
  total_display: z.string(),
  lines_allocated: z.number(),
  unallocated_lines: z.array(z.number()),
  discounts_applied: z.array(z.object({ supplier: z.string(), amount_inr: z.number() })),
  inferred_lines: z.array(z.number()),
  stale_suppliers_used: z.array(z.string()),
  reconfirm_suppliers_used: z.array(z.string()),
});

function summarise(r: ScenarioResult): z.infer<typeof Summary> {
  return {
    scenario: r.scenario,
    included_suppliers: r.basis.included_suppliers,
    total_inr: r.total_inr,
    total_display: r.total_display,
    lines_allocated: r.allocation.length,
    unallocated_lines: r.unallocated.map((u) => u.line),
    discounts_applied: r.discounts.filter((d) => d.applied).map((d) => ({ supplier: d.supplier, amount_inr: d.amount_inr })),
    inferred_lines: r.inferred_lines,
    stale_suppliers_used: r.stale_suppliers_used,
    reconfirm_suppliers_used: r.reconfirm_suppliers_used,
  };
}

export const compareScenarios = defineTool({
  name: "compare_scenarios",
  description:
    "Computes two award scenarios and the difference between them: the saving of B against A in rupees and percent, overall and on the lines both scenarios allocate (like-for-like, before conditional discounts). Use for 'how much do we save with X compared with Y'.",
  input: z.object({ a: ScenarioInput.describe("The reference scenario, e.g. the incumbent"), b: ScenarioInput.describe("The scenario being compared") }),
  output: z.object({
    a: Summary,
    b: Summary,
    saving_of_b_vs_a_inr: z.number().describe("a.total - b.total; negative means B costs more"),
    saving_of_b_vs_a_display: z.string(),
    saving_of_b_vs_a_pct: z.number().nullable(),
    same_lines_allocated: z.boolean(),
    common_lines: z.array(z.number()),
    common_lines_a_inr: z.number(),
    common_lines_b_inr: z.number(),
    common_lines_saving_inr: z.number().describe("Before conditional discounts"),
    common_lines_saving_display: z.string(),
    common_lines_saving_pct: z.number().nullable(),
  }),
  run({ data }, input) {
    const a = computeScenario(data, input.a);
    const b = computeScenario(data, input.b);
    const bLines = new Map(b.allocation.map((l) => [l.line, l.total_inr]));
    const common = a.allocation.filter((l) => bLines.has(l.line));
    const aCommon = round2(common.reduce((t, l) => t + l.total_inr, 0));
    const bCommon = round2(common.reduce((t, l) => t + bLines.get(l.line)!, 0));
    const saving = round2(a.total_inr - b.total_inr);
    const commonSaving = round2(aCommon - bCommon);
    return {
      a: summarise(a),
      b: summarise(b),
      saving_of_b_vs_a_inr: saving,
      saving_of_b_vs_a_display: formatInrCompact(saving),
      saving_of_b_vs_a_pct: a.total_inr ? round2((saving / a.total_inr) * 100) : null,
      same_lines_allocated: common.length === a.allocation.length && common.length === b.allocation.length,
      common_lines: common.map((l) => l.line),
      common_lines_a_inr: aCommon,
      common_lines_b_inr: bCommon,
      common_lines_saving_inr: commonSaving,
      common_lines_saving_display: formatInrCompact(commonSaving),
      common_lines_saving_pct: aCommon ? round2((commonSaving / aCommon) * 100) : null,
    };
  },
});
