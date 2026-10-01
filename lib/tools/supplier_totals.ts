import { z } from "zod";
import { buildComparison, cheapest } from "@/lib/comparison/build";
import { formatInrCompact } from "@/lib/format/inr";
import { comparisonInputs } from "./shared";
import { defineTool, round2 } from "./define";
import { Basis, SupplierFilter, applySupplierFilter } from "./filters";

export const supplierTotals = defineTool({
  name: "supplier_totals",
  description:
    "Total per supplier on the common basket (lines every chosen supplier can be counted on; like-for-like, the default) or on all lines with gaps priced at the lowest other chosen supplier's quote. The common basket is recomputed for the chosen suppliers. Includes the cheapest supplier and the change against last cycle.",
  input: z.object({ filter: SupplierFilter.optional(), basket: z.enum(["common", "all"]).optional().describe("Default common") }),
  output: z.object({
    basis: Basis,
    basket: z.string(),
    basket_lines: z.array(z.number()),
    last_cycle_inr: z.number(),
    last_cycle_display: z.string(),
    cheapest: z.string().nullable(),
    suppliers: z.array(
      z.object({
        supplier: z.string(),
        total_inr: z.number(),
        total_display: z.string(),
        change_vs_last_cycle_pct: z.number().nullable(),
        lines_counted: z.number(),
        lines_not_counted: z.array(z.number()).describe("Lines this supplier has no countable price for: not quoted, Missing, or substitute awaiting sign-off"),
        gap_priced_lines: z.array(z.number()),
        inferred_lines_in_basket: z.array(z.number()),
        freshness: z.string().nullable(),
      }),
    ),
  }),
  run({ data }, input) {
    const basis = applySupplierFilter(data, input.filter);
    const basket = input.basket ?? "common";
    const r = buildComparison(comparisonInputs(data, basis.included_suppliers));
    const basketLines = basket === "common" ? r.commonBasket : r.pricedLines;
    const lastCycle = basket === "common" ? r.lastCycleCommonBasket : r.lastCycleAllLines;
    return {
      basis,
      basket: basket === "common" ? "common basket (like-for-like)" : "all lines, gaps priced at the lowest other quote",
      basket_lines: basketLines,
      last_cycle_inr: lastCycle,
      last_cycle_display: formatInrCompact(lastCycle),
      cheapest: cheapest(r, basket),
      suppliers: r.suppliers.map((s) => {
        const total = basket === "common" ? s.commonBasketTotal : s.allLinesTotal;
        return {
          supplier: s.code,
          total_inr: total,
          total_display: formatInrCompact(total),
          change_vs_last_cycle_pct: lastCycle ? round2(((total - lastCycle) / lastCycle) * 100) : null,
          lines_counted: basket === "common" ? basketLines.length : s.countable,
          lines_not_counted: r.lines.filter((l) => !l.countable[s.code]).map((l) => l.lineNo),
          gap_priced_lines: basket === "all" ? s.gapFilledLines : [],
          inferred_lines_in_basket: basketLines.filter((n) => data.cells[s.code]?.[n]?.confidence_state === "inferred"),
          freshness: data.suppliers.find((x) => x.code === s.code)?.freshness?.status ?? null,
        };
      }),
    };
  },
});
