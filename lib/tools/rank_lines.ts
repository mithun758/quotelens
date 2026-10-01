import { z } from "zod";
import { buildComparison } from "@/lib/comparison/build";
import { comparisonInputs } from "./shared";
import { defineTool } from "./define";
import { Basis, LineFilter, SupplierFilter, applySupplierFilter, selectLines } from "./filters";

export const rankLines = defineTool({
  name: "rank_lines",
  description:
    "L1 (lowest counted price), L2 and spread per line among the chosen suppliers, plus how many lines each supplier is L1 on. Substitutes awaiting sign-off and Missing values are never counted.",
  input: z.object({ filter: SupplierFilter.optional(), lines: LineFilter.optional() }),
  output: z.object({
    basis: Basis,
    lines: z.array(
      z.object({
        line: z.number(),
        description: z.string(),
        l1_suppliers: z.array(z.string()),
        l1_unit_inr: z.number().nullable(),
        l1_confidence: z.string().nullable(),
        l2_unit_inr: z.number().nullable(),
        spread_pct: z.number().nullable(),
      }),
    ),
    l1_line_count_by_supplier: z.record(z.string(), z.number()),
    lines_with_no_price: z.array(z.number()),
  }),
  run({ data }, input) {
    const basis = applySupplierFilter(data, input.filter);
    const lines = selectLines(data, input.lines);
    const result = buildComparison(comparisonInputs(data, basis.included_suppliers, lines));
    const tally: Record<string, number> = Object.fromEntries(basis.included_suppliers.map((s) => [s, 0]));
    const out = result.lines.map((lr) => {
      lr.l1.forEach((s) => (tally[s] += 1));
      const line = lines.find((l) => l.line_no === lr.lineNo)!;
      return {
        line: lr.lineNo,
        description: line.description,
        l1_suppliers: lr.l1,
        l1_unit_inr: lr.l1Value,
        l1_confidence: lr.l1[0] ? data.cells[lr.l1[0]][lr.lineNo].confidence_state : null,
        l2_unit_inr: lr.l2Value,
        spread_pct: lr.spreadPct,
      };
    });
    return { basis, lines: out, l1_line_count_by_supplier: tally, lines_with_no_price: out.filter((l) => l.l1_unit_inr === null).map((l) => l.line) };
  },
});
