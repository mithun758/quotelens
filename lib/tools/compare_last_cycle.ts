import { z } from "zod";
import { counts } from "@/lib/comparison/build";
import { PRIOR_PRICING_REASON } from "@/lib/normalise/normaliseResponse";
import { defineTool, round2 } from "./define";
import { Basis, LineFilter, SupplierFilter, applySupplierFilter, selectLines } from "./filters";

export const compareLastCycle = defineTool({
  name: "compare_last_cycle",
  description:
    "Price change per line and supplier against Meridian's last-cycle price, and per supplier which lines rose. Lines priced from a 'same as last year' reference are reported separately, since they equal last cycle by construction.",
  input: z.object({ filter: SupplierFilter.optional(), lines: LineFilter.optional(), only_increases: z.boolean().optional() }),
  output: z.object({
    basis: Basis,
    changes: z.array(
      z.object({ line: z.number(), description: z.string(), supplier: z.string(), unit_inr: z.number(), last_cycle_unit_inr: z.number(), change_inr: z.number(), change_pct: z.number(), confidence: z.string() }),
    ),
    by_supplier: z.array(z.object({ supplier: z.string(), lines_raised: z.array(z.number()), lines_lowered: z.array(z.number()), lines_on_prior_pricing: z.array(z.number()) })),
  }),
  run({ data }, input) {
    const basis = applySupplierFilter(data, input.filter);
    const lines = selectLines(data, input.lines);
    const changes = [];
    const bySupplier = [];
    for (const s of basis.included_suppliers) {
      const raised: number[] = [];
      const lowered: number[] = [];
      const prior: number[] = [];
      for (const l of lines) {
        const c = data.cells[s]?.[l.line_no];
        const ok = c && counts({ value: c.normalised_value_inr, confidence: c.confidence_state, isSubstitute: c.substitute_status !== null, substituteStatus: c.substitute_status });
        if (!ok || l.last_cycle_price_inr === null) continue;
        if ((c.reason ?? "").startsWith(PRIOR_PRICING_REASON)) {
          prior.push(l.line_no);
          continue;
        }
        const v = c.normalised_value_inr!;
        const pct = round2(((v - l.last_cycle_price_inr) / l.last_cycle_price_inr) * 100);
        if (pct > 0) raised.push(l.line_no);
        if (pct < 0) lowered.push(l.line_no);
        if (!input.only_increases || pct > 0) {
          changes.push({ line: l.line_no, description: l.description, supplier: s, unit_inr: v, last_cycle_unit_inr: l.last_cycle_price_inr, change_inr: round2(v - l.last_cycle_price_inr), change_pct: pct, confidence: c.confidence_state });
        }
      }
      bySupplier.push({ supplier: s, lines_raised: raised, lines_lowered: lowered, lines_on_prior_pricing: prior });
    }
    return { basis, changes, by_supplier: bySupplier };
  },
});
