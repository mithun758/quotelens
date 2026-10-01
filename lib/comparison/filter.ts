// The Quote Comparison's supplier filter chips: All, Qualified (passes the
// questionnaire) or Not stale. Each is one half of the Decision-ready preset; like it,
// the filter recomputes L1 and totals with the same buildComparison, over the
// suppliers it keeps. Pure.
import { buildComparison } from "./build";
import type { DecisionReady, DecisionReadyInput, Exclusion } from "./decisionReady";

export type SupplierFilter = "all" | "qualified" | "not_stale";

export function filterSuppliers(view: DecisionReadyInput, filter: SupplierFilter): DecisionReady {
  const excluded: Exclusion[] = [];
  const included: string[] = [];
  for (const s of view.suppliers) {
    const reasons: string[] = [];
    if (filter === "qualified" && s.questionnairePassed < s.questionnaireTotal) reasons.push(`fails the questionnaire (${s.questionnairePassed}/${s.questionnaireTotal})`);
    if (filter === "not_stale" && view.freshness[s.code]?.status === "Stale") reasons.push("quote is Stale");
    if (reasons.length) excluded.push({ code: s.code, reasons });
    else included.push(s.code);
  }
  const result = buildComparison({
    suppliers: included,
    lines: view.lines.map((l) => ({ lineNo: l.line_no, quantity: l.quantity, lastCycle: l.last_cycle_price_inr })),
    cells: Object.fromEntries(included.map((c) => [c, view.inputs[c] ?? {}])),
  });
  return { included, excluded, result };
}
