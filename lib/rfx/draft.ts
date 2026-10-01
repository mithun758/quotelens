// The RFx draft built with the co-pilot. Separate from the seeded RFx, which the rest
// of the app keeps using. Pure: schema, the update operations the co-pilot (and Priya's
// edits) apply, and the checks before sending.
import { z } from "zod";

export const SpecAttribute = z.object({ attribute: z.string().min(1), value: z.string().min(1) });

export const DraftLine = z.object({
  line_no: z.number().int().positive(),
  description: z.string().min(1),
  category: z.string().min(1),
  spec: z.array(SpecAttribute),
  quantity: z.number().positive(),
  uom: z.string().min(1),
  memory_exposed: z.boolean(),
});
export type DraftLine = z.infer<typeof DraftLine>;

export const DraftQuestion = z.object({ key: z.string().regex(/^[a-z0-9_]+$/), text: z.string().min(1), evidence_required: z.boolean() });

export const DraftTerms = z.object({
  validity_days_required: z.number().int().nonnegative(),
  gst_basis: z.string(),
  delivery_basis: z.string(),
  delivery_days: z.number().int().nonnegative(),
  warranty: z.string(),
  payment: z.string(),
  currency: z.string(),
});

export const RfxDraft = z.object({
  title: z.string(),
  category: z.string(),
  need_by_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  approval_days: z.number().int().nonnegative(),
  delivery_hubs: z.array(z.string()),
  lines: z.array(DraftLine),
  questionnaire: z.array(DraftQuestion),
  terms: DraftTerms,
});
export type RfxDraft = z.infer<typeof RfxDraft>;

export const EMPTY_DRAFT: RfxDraft = {
  title: "",
  category: "",
  need_by_date: "",
  approval_days: 10,
  delivery_hubs: [],
  lines: [],
  questionnaire: [],
  terms: { validity_days_required: 0, gst_basis: "", delivery_basis: "", delivery_days: 0, warranty: "", payment: "", currency: "INR" },
};

// Lines are always numbered 1..n in order.
const renumber = (lines: DraftLine[]) => lines.map((l, i) => ({ ...l, line_no: i + 1 }));

export function setHeader(d: RfxDraft, h: Partial<Pick<RfxDraft, "title" | "category" | "need_by_date" | "approval_days" | "delivery_hubs">>): RfxDraft {
  return RfxDraft.parse({ ...d, ...Object.fromEntries(Object.entries(h).filter(([, v]) => v !== undefined)) });
}

// Replace lines by line number, or append when the number is past the end.
export function upsertLines(d: RfxDraft, lines: DraftLine[]): RfxDraft {
  const next = [...d.lines];
  for (const l of [...lines].sort((a, b) => a.line_no - b.line_no)) {
    const i = next.findIndex((x) => x.line_no === l.line_no);
    if (i >= 0) next[i] = DraftLine.parse(l);
    else next.push(DraftLine.parse(l));
  }
  return { ...d, lines: renumber(next.sort((a, b) => a.line_no - b.line_no)) };
}

export function removeLines(d: RfxDraft, lineNos: number[]): RfxDraft {
  return { ...d, lines: renumber(d.lines.filter((l) => !lineNos.includes(l.line_no))) };
}

export function setTerms(d: RfxDraft, terms: Partial<RfxDraft["terms"]>): RfxDraft {
  return { ...d, terms: DraftTerms.parse({ ...d.terms, ...Object.fromEntries(Object.entries(terms).filter(([, v]) => v !== undefined)) }) };
}

export function setQuestionnaire(d: RfxDraft, questions: RfxDraft["questionnaire"]): RfxDraft {
  const keys = questions.map((q) => q.key);
  if (new Set(keys).size !== keys.length) throw new Error("Questionnaire keys must be unique");
  return { ...d, questionnaire: questions.map((q) => DraftQuestion.parse(q)) };
}

// What must be true before "Send to suppliers".
export function sendProblems(d: RfxDraft, asOfDate: string): string[] {
  const p: string[] = [];
  if (!d.title.trim()) p.push("Give the RFx a title.");
  if (!d.lines.length) p.push("Add at least one line.");
  d.lines.forEach((l) => {
    if (!l.spec.length) p.push(`Line ${l.line_no} has no specification.`);
  });
  if (!d.need_by_date) p.push("Set a need-by date.");
  else if (d.need_by_date <= asOfDate) p.push("The need-by date must be after the as-of date.");
  if (!d.delivery_hubs.length) p.push("Name at least one delivery hub.");
  if (!d.questionnaire.length) p.push("Add the quality questionnaire.");
  if (!d.terms.warranty.trim() || !d.terms.payment.trim() || !d.terms.gst_basis.trim()) p.push("Complete the terms: GST basis, warranty and payment.");
  if (!d.terms.validity_days_required) p.push("Set the quote validity you require.");
  return p;
}
