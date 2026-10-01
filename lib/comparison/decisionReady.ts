// "Decision-ready" is a preset over the existing eligibility filters: suppliers who
// pass the questionnaire and whose quote is not Stale. Substitutes awaiting Arjun are
// never counted (buildComparison already excludes them). Pure: recomputes L1 and
// totals with the same buildComparison the Quote Comparison uses.
import { buildComparison, type ComparisonCellInput, type ComparisonResult } from "./build";

export type Exclusion = { code: string; reasons: string[] };
export type DecisionReady = { included: string[]; excluded: Exclusion[]; result: ComparisonResult };

export type DecisionReadyInput = {
  suppliers: { code: string; questionnairePassed: number; questionnaireTotal: number }[];
  freshness: Record<string, { status: string } | null | undefined>;
  lines: { line_no: number; quantity: number; last_cycle_price_inr: number | null }[];
  inputs: Record<string, Record<number, ComparisonCellInput | undefined>>;
};

export function decisionReady(view: DecisionReadyInput): DecisionReady {
  const excluded: Exclusion[] = [];
  const included: string[] = [];
  for (const s of view.suppliers) {
    const reasons: string[] = [];
    if (s.questionnairePassed < s.questionnaireTotal) reasons.push(`fails the questionnaire (${s.questionnairePassed}/${s.questionnaireTotal})`);
    if (view.freshness[s.code]?.status === "Stale") reasons.push("quote is Stale");
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
