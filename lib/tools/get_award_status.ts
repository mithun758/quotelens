import { z } from "zod";
import { AwardSpec, SCENARIO_LABEL, describeEligibility, toScenarioSpec } from "@/lib/award/spec";
import { getAward } from "@/lib/award/store";
import { scenarioBlockers } from "@/lib/blockers/scenario";
import { describeDelta } from "@/lib/format/inr";
import { computeScenario } from "@/lib/scenarios/compute";
import { defineTool } from "./define";

const KINDS = ["best_quote", "best_supplier", "incumbent", "best_quote_without_incumbent"] as const;

export const getAwardStatus = defineTool({
  name: "get_award_status",
  description:
    "The award exactly as Priya has set it on the Award screen: the chosen scenario under her eligibility settings, its total and savings, suppliers, open blockers (after her overrides), overrides with reasons, whether the memo is written, and the other scenarios under the same settings. Use this, not compute_scenario, for questions about the award, its blockers or the memo.",
  input: z.object({}),
  output: z.object({
    chosen_scenario: z.string(),
    eligibility: z.array(z.string()),
    total_display: z.string(),
    vs_last_cycle: z.string(),
    suppliers: z.array(z.string()),
    lines_awarded: z.number(),
    lines_not_covered: z.array(z.number()),
    open_blocker_count: z.number(),
    open_blockers: z.array(z.object({ type: z.string(), supplier: z.string().nullable(), line: z.number().nullable(), detail: z.string() })),
    overrides: z.array(z.object({ supplier: z.string().nullable(), line: z.number().nullable(), reason: z.string() })),
    memo_written: z.boolean(),
    other_scenarios: z.array(z.object({ scenario: z.string(), total_display: z.string(), vs_last_cycle: z.string(), open_blocker_count: z.number(), available: z.boolean() })),
  }),
  async run({ data, client }) {
    const { award, spec } = await getAward(client);
    const overrides = award?.overrides ?? [];
    const evaluate = (kind: AwardSpec["scenario"]) => {
      const result = computeScenario(data, toScenarioSpec(spec, kind));
      const open = scenarioBlockers(data, result).filter((b) => !overrides.some((o) => o.key === b.key));
      return { result, open };
    };
    const chosen = evaluate(spec.scenario);
    return {
      chosen_scenario: SCENARIO_LABEL[spec.scenario],
      eligibility: describeEligibility(spec),
      total_display: chosen.result.total_display,
      vs_last_cycle: describeDelta(chosen.result.saving_vs_last_cycle_inr, "last cycle"),
      suppliers: chosen.result.by_supplier.map((b) => `${b.supplier}. ${data.suppliers.find((s) => s.code === b.supplier)?.name ?? ""}`),
      lines_awarded: chosen.result.allocation.length,
      lines_not_covered: chosen.result.unallocated.map((u) => u.line),
      open_blocker_count: chosen.open.length,
      open_blockers: chosen.open.map((b) => ({ type: b.type, supplier: b.supplier, line: b.line, detail: b.detail })),
      overrides: overrides.map((o) => ({ supplier: o.supplier, line: o.line, reason: o.reason })),
      memo_written: !!award?.memo_markdown,
      other_scenarios: KINDS.filter((k) => k !== spec.scenario).map((k) => {
        const e = evaluate(k);
        return { scenario: SCENARIO_LABEL[k], total_display: e.result.total_display, vs_last_cycle: describeDelta(e.result.saving_vs_last_cycle_inr, "last cycle"), open_blocker_count: e.open.length, available: e.result.allocation.length > 0 };
      }),
    };
  },
});
