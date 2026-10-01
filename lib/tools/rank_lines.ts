import { z } from "zod";
import { buildComparison, counts } from "@/lib/comparison/build";
import { comparisonInputs } from "./shared";
import { defineTool, round2 } from "./define";
import { Basis, LineFilter, SupplierFilter, applySupplierFilter, selectLines } from "./filters";

const pct = (from: number | null, to: number | null) => (from && to !== null ? round2(((to - from) / from) * 100) : null);

export const rankLines = defineTool({
  name: "rank_lines",
  description:
    "Per line among the chosen suppliers: L1 (lowest counted price) and L2 (next-best price) with their suppliers, the L1-to-L2 gap, the highest price and spread, and the incumbent's price and premium over L1, as unit and line-total figures. Plus how many lines each supplier is L1 on. Substitutes awaiting sign-off and Missing values are never counted. Use for 'where are we overpaying the incumbent', 'which lines have the biggest gap' and 'what do we lose if the L1 falls through'.",
  input: z.object({ filter: SupplierFilter.optional(), lines: LineFilter.optional() }),
  output: z.object({
    basis: Basis,
    incumbent: z.string().nullable(),
    lines: z.array(
      z.object({
        line: z.number(),
        description: z.string(),
        quantity: z.number(),
        l1_suppliers: z.array(z.string()),
        l1_unit_inr: z.number().nullable(),
        l1_confidence: z.string().nullable(),
        l2_suppliers: z.array(z.string()),
        l2_unit_inr: z.number().nullable(),
        l1_to_l2_gap_pct: z.number().nullable().describe("How far L2 sits above L1, as a percentage of L1"),
        l1_to_l2_gap_line_inr: z.number().nullable().describe("(L2 - L1) x quantity: the line cost of losing the L1"),
        highest_unit_inr: z.number().nullable(),
        spread_pct: z.number().nullable().describe("Highest counted price over L1, as a percentage of L1. Not the L1-to-L2 gap"),
        incumbent_unit_inr: z.number().nullable(),
        incumbent_premium_over_l1_pct: z.number().nullable(),
        incumbent_premium_over_l1_line_inr: z.number().nullable().describe("(incumbent - L1) x quantity"),
      }),
    ),
    l1_line_count_by_supplier: z.record(z.string(), z.number()),
    lines_with_no_price: z.array(z.number()),
  }),
  run({ data }, input) {
    const basis = applySupplierFilter(data, input.filter);
    const lines = selectLines(data, input.lines);
    const inputs = comparisonInputs(data, basis.included_suppliers, lines);
    const result = buildComparison(inputs);
    const incumbent = data.suppliers.find((s) => s.isIncumbent)?.code ?? null;
    const incumbentInputs = incumbent ? comparisonInputs(data, [incumbent], lines).cells[incumbent] : {};
    const tally: Record<string, number> = Object.fromEntries(basis.included_suppliers.map((s) => [s, 0]));
    const out = result.lines.map((lr) => {
      lr.l1.forEach((s) => (tally[s] += 1));
      const line = lines.find((l) => l.line_no === lr.lineNo)!;
      const offers = basis.included_suppliers.filter((s) => counts(inputs.cells[s]?.[lr.lineNo]));
      const value = (s: string) => inputs.cells[s]![lr.lineNo]!.value!;
      const highest = offers.length ? Math.max(...offers.map(value)) : null;
      const incCell = incumbent ? incumbentInputs?.[lr.lineNo] : undefined;
      const incumbentUnit = counts(incCell) ? incCell.value : null;
      const lineInr = (a: number | null, b: number | null) => (a !== null && b !== null ? round2((b - a) * line.quantity) : null);
      return {
        line: lr.lineNo,
        description: line.description,
        quantity: line.quantity,
        l1_suppliers: lr.l1,
        l1_unit_inr: lr.l1Value,
        l1_confidence: lr.l1[0] ? data.cells[lr.l1[0]][lr.lineNo].confidence_state : null,
        l2_suppliers: lr.l2Value === null ? [] : offers.filter((s) => value(s) === lr.l2Value),
        l2_unit_inr: lr.l2Value,
        l1_to_l2_gap_pct: pct(lr.l1Value, lr.l2Value),
        l1_to_l2_gap_line_inr: lineInr(lr.l1Value, lr.l2Value),
        highest_unit_inr: highest,
        spread_pct: lr.spreadPct,
        incumbent_unit_inr: incumbentUnit,
        incumbent_premium_over_l1_pct: incumbentUnit === null ? null : pct(lr.l1Value, incumbentUnit),
        incumbent_premium_over_l1_line_inr: incumbentUnit === null ? null : lineInr(lr.l1Value, incumbentUnit),
      };
    });
    return { basis, incumbent, lines: out, l1_line_count_by_supplier: tally, lines_with_no_price: out.filter((l) => l.l1_unit_inr === null).map((l) => l.line) };
  },
});
