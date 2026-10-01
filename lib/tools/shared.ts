import type { ComparisonInput } from "@/lib/comparison/build";
import type { LineItemRow } from "@/lib/db/types";
import type { AnalystData } from "./data";

// Builds the pure comparison input for a set of suppliers and lines.
export function comparisonInputs(data: AnalystData, suppliers: string[], lines: LineItemRow[] = data.lines): ComparisonInput {
  return {
    suppliers,
    lines: lines.map((l) => ({ lineNo: l.line_no, quantity: l.quantity, lastCycle: l.last_cycle_price_inr })),
    cells: Object.fromEntries(
      suppliers.map((s) => [
        s,
        Object.fromEntries(
          lines.map((l) => {
            const c = data.cells[s]?.[l.line_no];
            return [
              l.line_no,
              c && { value: c.normalised_value_inr, confidence: c.confidence_state, isSubstitute: c.substitute_status !== null, substituteStatus: c.substitute_status },
            ];
          }),
        ),
      ]),
    ),
  };
}
