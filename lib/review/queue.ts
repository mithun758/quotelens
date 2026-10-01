// Which extracted values and flags need Priya, and what she can do with each.
// Only exceptions reach the queue: Inferred, Missing, or anything with an open flag.
import type { ClarificationRow, ExtractedValueRow, FlagRow, QuestionnaireAnswerRow, QuestionnaireQuestion } from "@/lib/db/types";

export type ReviewAction = "accept" | "correct" | "ask";

export type QueueItem = {
  key: string;
  kind: "value" | "response_flag" | "questionnaire";
  valueId: string | null;
  flagId: string | null;
  lineNo: number | null;
  field: string;
  confidence: ExtractedValueRow["confidence_state"] | null;
  headline: string;
  detail: string | null;
  flags: Pick<FlagRow, "id" | "type" | "severity" | "message">[];
  actions: ReviewAction[];
  clarification: Pick<ClarificationRow, "id" | "status" | "question" | "reply_text"> | null;
};

type Inputs = {
  values: (ExtractedValueRow & { line_no: number | null; description: string | null })[];
  flags: FlagRow[];
  clarifications: ClarificationRow[];
  questionnaire: QuestionnaireAnswerRow[];
  questions: QuestionnaireQuestion[];
};

// Clarification target for the questionnaire as a whole.
export const QUESTIONNAIRE_TARGET = "questionnaire";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function buildReviewQueue({ values, flags, clarifications, questionnaire, questions }: Inputs): QueueItem[] {
  const openFlags = flags.filter((f) => f.status === "open");
  const latest = (match: (c: ClarificationRow) => boolean) => {
    const c = clarifications.filter(match).at(-1);
    return c ? { id: c.id, status: c.status, question: c.question, reply_text: c.reply_text } : null;
  };

  const items: QueueItem[] = [];
  for (const v of values) {
    if (v.field !== "unit_price" && v.field !== "unmatched_item") continue;
    const valueFlags = openFlags.filter((f) => f.extracted_value_id === v.id);
    const needsReview = v.status === "needs_review" || valueFlags.length > 0;
    if (!needsReview) continue;
    items.push({
      key: `value:${v.id}`,
      kind: "value",
      valueId: v.id,
      flagId: null,
      lineNo: v.line_no,
      field: v.field,
      confidence: v.confidence_state,
      headline: v.field === "unmatched_item" ? `Unmatched item: ${v.raw_value ?? ""}` : `Line ${v.line_no}: ${v.description ?? ""}`,
      detail: v.reason,
      flags: valueFlags.map(({ id, type, severity, message }) => ({ id, type, severity, message })),
      // Missing is never imputed, so it cannot be corrected here; ask the supplier instead.
      actions: v.confidence_state === "missing" ? ["accept", "ask"] : ["accept", "correct", "ask"],
      clarification: latest((c) => c.line_item_id === v.line_item_id && c.field === v.field),
    });
  }

  for (const f of openFlags.filter((x) => x.response_id && x.type !== "clarification_requested")) {
    items.push({
      key: `flag:${f.id}`,
      kind: "response_flag",
      valueId: null,
      flagId: f.id,
      lineNo: null,
      field: f.type,
      confidence: null,
      headline: f.type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      detail: f.message,
      flags: [{ id: f.id, type: f.type, severity: f.severity, message: f.message }],
      actions: ["accept", "ask"],
      clarification: latest((c) => c.target_flag_type === f.type),
    });
  }

  // Failed questionnaire answers: one item per supplier. They leave the queue only by passing.
  const failed = questionnaire.filter((q) => q.pass_fail !== "pass");
  if (failed.length) {
    const text = (key: string) => questions.find((q) => q.key === key)?.text ?? key;
    items.push({
      key: "questionnaire",
      kind: "questionnaire",
      valueId: null,
      flagId: null,
      lineNo: null,
      field: QUESTIONNAIRE_TARGET,
      confidence: null,
      headline: `Questionnaire: fails ${failed.length} of ${questionnaire.length}`,
      detail: failed.map((q) => `${text(q.question_key)} ${q.answer ?? ""}`.trim()).join("\n"),
      flags: [{ id: "questionnaire", type: "questionnaire_failed", severity: "high", message: `${failed.length} questions fail` }],
      actions: ["ask"],
      clarification: latest((c) => c.target_flag_type === QUESTIONNAIRE_TARGET),
    });
  }

  // Missing first (they block comparison), then by worst flag, then line order.
  const rank = (i: QueueItem) =>
    (i.confidence === "missing" ? 0 : 10) + Math.min(...i.flags.map((f) => SEVERITY_ORDER[f.severity]), 3);
  return items.sort((a, b) => rank(a) - rank(b) || (a.lineNo ?? 99) - (b.lineNo ?? 99));
}
