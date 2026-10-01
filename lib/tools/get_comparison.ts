import { z } from "zod";
import { counts } from "@/lib/comparison/build";
import { defineTool } from "./define";
import { Basis, LineFilter, SupplierFilter, applySupplierFilter, selectLines } from "./filters";

export const getComparison = defineTool({
  name: "get_comparison",
  description:
    "The normalised Quote Comparison matrix (INR per piece, ex-GST, delivered) for chosen lines and suppliers, with each cell's confidence state, whether it counts toward L1 and totals, and open flags. Use to look up specific prices.",
  input: z.object({ filter: SupplierFilter.optional(), lines: LineFilter.optional() }),
  output: z.object({
    basis: Basis,
    lines: z.array(
      z.object({
        line: z.number(),
        description: z.string(),
        category: z.string(),
        quantity: z.number(),
        last_cycle_unit_inr: z.number().nullable(),
        cells: z.array(
          z.object({
            supplier: z.string(),
            unit_inr: z.number().nullable(),
            confidence: z.string(),
            counts: z.boolean(),
            note: z.string().nullable(),
            open_flags: z.array(z.string()),
          }),
        ),
      }),
    ),
  }),
  run({ data }, input) {
    const basis = applySupplierFilter(data, input.filter);
    return {
      basis,
      lines: selectLines(data, input.lines).map((l) => ({
        line: l.line_no,
        description: l.description,
        category: l.category,
        quantity: l.quantity,
        last_cycle_unit_inr: l.last_cycle_price_inr,
        cells: basis.included_suppliers.map((s) => {
          const c = data.cells[s]?.[l.line_no];
          const countsHere = counts(c ? { value: c.normalised_value_inr, confidence: c.confidence_state, isSubstitute: c.substitute_status !== null, substituteStatus: c.substitute_status } : undefined);
          return {
            supplier: s,
            unit_inr: c?.normalised_value_inr ?? null,
            confidence: c?.confidence_state ?? "missing",
            counts: countsHere,
            note: c?.substitute_status === "pending" ? "substitute awaiting Arjun's sign-off; not counted" : c?.confidence_state === "inferred" ? c.reason : null,
            open_flags: c?.openFlags.map((f) => f.message) ?? [],
          };
        }),
      })),
    };
  },
});
