// Plain-language basis for an analyst answer, read from the tools' own outputs:
// which suppliers were considered and excluded (and why), which basket, which scenario.
import type { ToolRun } from "@/lib/tools";

const SCENARIO_NAMES: Record<string, string> = {
  best_quote: "Best Quote (split award)",
  best_supplier: "Best Supplier",
  incumbent: "Incumbent",
  best_quote_without_incumbent: "Best Quote Without Incumbent",
  custom: "Custom allocation",
};

export function basisNotes(runs: ToolRun[]): string[] {
  const notes = new Set<string>();
  for (const r of runs) {
    if (r.error || !r.output || typeof r.output !== "object") continue;
    const o = r.output as Record<string, unknown>;
    const basis = o.basis as { included_suppliers: string[]; excluded_suppliers: { supplier: string; reason: string }[] } | undefined;
    if (basis) {
      notes.add(`Suppliers considered: ${basis.included_suppliers.join(", ") || "none"}`);
      for (const e of basis.excluded_suppliers) notes.add(`Excluded ${e.supplier}: ${e.reason}`);
    }
    if (typeof o.basket === "string") notes.add(`Basket: ${o.basket}${Array.isArray(o.basket_lines) ? ` (${o.basket_lines.length} lines)` : ""}`);
    if (typeof o.scenario === "string") notes.add(`Scenario: ${SCENARIO_NAMES[o.scenario] ?? o.scenario}`);
    if (typeof o.scope === "string") notes.add(`Blockers checked for: ${o.scope}`);
    if (r.name === "get_freshness" && typeof o.as_of_date === "string") notes.add(`Freshness as of ${o.as_of_date}, approval completes ${o.approval_completes}`);
  }
  return [...notes];
}
