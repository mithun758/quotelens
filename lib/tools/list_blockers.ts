import { z } from "zod";
import { scenarioBlockers } from "@/lib/blockers/scenario";
import { computeScenario } from "@/lib/scenarios/compute";
import { ScenarioInput } from "./compute_scenario";
import { defineTool } from "./define";

const Blocker = z.object({
  type: z.enum(["inferred_value", "open_flag", "stale_supplier", "awaiting_clarification", "questionnaire_failure", "unallocated_line"]),
  supplier: z.string().nullable(),
  line: z.number().nullable(),
  detail: z.string(),
  resolve_by: z.string(),
});

export const listBlockers = defineTool({
  name: "list_blockers",
  description:
    "What must be resolved before an award memo can go to Meera. With a scenario, only blockers on the awarded lines and suppliers; without, everything open. The memo is blocked while any awarded line rests on an Inferred value, an open flag or a Stale supplier, unless Priya overrides with a typed reason.",
  input: z.object({ scenario: ScenarioInput.optional().describe("The award being considered; omit for all open blockers") }),
  output: z.object({
    scope: z.string(),
    total_blockers: z.number(),
    counts_by_type: z.record(z.string(), z.number()),
    blockers: z.array(Blocker),
  }),
  run({ data }, input) {
    const scenario = input.scenario ? computeScenario(data, input.scenario) : null;
    const blockers = scenarioBlockers(data, scenario).map((b) => ({ type: b.type, supplier: b.supplier, line: b.line, detail: b.detail, resolve_by: b.resolveBy }));
    const counts: Record<string, number> = {};
    for (const b of blockers) counts[b.type] = (counts[b.type] ?? 0) + 1;
    return {
      scope: scenario ? `${scenario.scenario} among ${scenario.basis.included_suppliers.join(", ") || "no suppliers"}: ${scenario.allocation.length} awarded lines` : "all suppliers and lines",
      total_blockers: blockers.length,
      counts_by_type: counts,
      blockers,
    };
  },
});
