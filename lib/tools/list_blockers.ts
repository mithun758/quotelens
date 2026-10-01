import { z } from "zod";
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
    const lineScope = (supplier: string, line: number) => !scenario || scenario.allocation.some((a) => a.supplier === supplier && a.line === line);
    const suppliers = scenario ? scenario.by_supplier.map((b) => b.supplier) : data.suppliers.map((s) => s.code);
    const blockers: z.infer<typeof Blocker>[] = [];

    for (const s of suppliers) {
      const info = data.suppliers.find((x) => x.code === s)!;
      for (const [lineNo, c] of Object.entries(data.cells[s] ?? {})) {
        const line = Number(lineNo);
        if (!lineScope(s, line)) continue;
        if (c.confidence_state === "inferred" && c.status === "needs_review") {
          blockers.push({ type: "inferred_value", supplier: s, line, detail: c.reason ?? "Inferred value", resolve_by: "Accept or correct it in the Quotes review queue, or ask the supplier" });
        }
        for (const f of c.openFlags) blockers.push({ type: "open_flag", supplier: s, line, detail: f.message, resolve_by: "Resolve the flag in the Quotes review queue" });
      }
      for (const f of info.responseFlags.filter((x) => x.status === "open" && x.type !== "clarification_requested")) {
        blockers.push({ type: "open_flag", supplier: s, line: null, detail: f.message, resolve_by: "Acknowledge or resolve it in the Quotes review queue" });
      }
      if (info.freshness?.status === "Stale") {
        blockers.push({
          type: "stale_supplier",
          supplier: s,
          line: null,
          detail: info.freshness.fired.filter((r) => r.severity === "high").map((r) => r.reason).join(" "),
          resolve_by: info.freshness.fired.filter((r) => r.severity === "high").map((r) => r.action).join("; "),
        });
      }
      if (info.questionnairePassed < info.questionnaireTotal) {
        blockers.push({ type: "questionnaire_failure", supplier: s, line: null, detail: `Fails ${info.questionnaireTotal - info.questionnairePassed} of ${info.questionnaireTotal} questionnaire questions`, resolve_by: "Ask the supplier for the missing answers or evidence" });
      }
      for (const c of data.clarifications.filter((x) => x.supplierCode === s && x.status === "awaiting" && (x.lineNo === null || lineScope(s, x.lineNo)))) {
        blockers.push({ type: "awaiting_clarification", supplier: s, line: c.lineNo, detail: `Awaiting supplier reply: ${c.question.slice(0, 160)}`, resolve_by: "Wait for the reply, then review it in Quotes" });
      }
    }
    for (const u of scenario?.unallocated ?? []) {
      blockers.push({ type: "unallocated_line", supplier: null, line: u.line, detail: `${u.description}: ${u.reason}`, resolve_by: "Choose a supplier for the line or record why it is not being bought" });
    }

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
