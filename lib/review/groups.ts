// Presentation grouping for the review queue: items that share a reason sit together
// so Priya can review them as one decision. The same rule tells the analyst's
// accept_values tool which values are "similar". Pure.
import type { NormalisationKind } from "@/lib/db/types";
import { PRIOR_PRICING_REASON } from "@/lib/normalise/normaliseResponse";
import type { QueueItem } from "./queue";

export type QueueGroup = { key: string; title: string; note: string; items: QueueItem[] };

const STEP_GROUP: Partial<Record<NormalisationKind, [string, string]>> = {
  gst: ["GST-inclusive, back-calculated", "Quoted including GST; code divided out the rate to compare ex-GST."],
  pack_size: ["Priced per pack", "Code divided the pack price by the pack size."],
  bundle: ["Bundle split", "A bundle price less the standalone price of the other item."],
  uom: ["Unit converted", "Code converted the quoted unit to per piece."],
};

const FLAG_TITLE: Record<string, string> = {
  gst_rate_mismatch: "GST rate differs from the expected rate",
  substitute_offered: "Substitute models",
};

// The reason group of an Inferred value: "prior", "step:<kind>" or "judgement".
export function inferredGroup(reason: string | null, stepKinds: NormalisationKind[]): { key: string; title: string; note: string } {
  if (reason === PRIOR_PRICING_REASON) return { key: "prior", title: "Same as last year", note: "Shown at Meridian's last-cycle price; the supplier gave no number." };
  const kind = stepKinds.find((k) => STEP_GROUP[k]);
  if (kind) return { key: `step:${kind}`, title: STEP_GROUP[kind]![0], note: STEP_GROUP[kind]![1] };
  return { key: "judgement", title: "Judgement calls", note: "Claude read the document and made a call; the reason is shown on each." };
}

export function groupQueue(items: QueueItem[], stepsByValue: Map<string, NormalisationKind[]>): QueueGroup[] {
  const groups = new Map<string, QueueGroup>();
  const add = (g: { key: string; title: string; note: string }, item: QueueItem) => {
    if (!groups.has(g.key)) groups.set(g.key, { ...g, items: [] });
    groups.get(g.key)!.items.push(item);
  };
  for (const item of items) {
    if (item.kind === "questionnaire") add({ key: "questionnaire", title: "Questionnaire", note: "Failed answers leave the queue only when the supplier's reply passes." }, item);
    else if (item.kind === "response_flag") add({ key: "terms", title: "Quote terms", note: "Flags on the quote as a whole." }, item);
    else if (item.confidence === "missing") add({ key: "missing", title: "Not quoted", note: "Never imputed. Accept as not quoted, or ask the supplier." }, item);
    else if (item.confidence === "inferred") add(inferredGroup(item.detail, stepsByValue.get(item.valueId ?? "") ?? []), item);
    else {
      const type = item.flags[0]?.type ?? "other";
      add({ key: `flag:${type}`, title: FLAG_TITLE[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), note: "Extracted values with an open flag." }, item);
    }
  }
  const order = ["missing", "judgement", "prior", "step:gst", "step:pack_size", "step:bundle", "step:uom", "terms", "questionnaire"];
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : k.startsWith("flag:") ? 2.5 : 99);
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key));
}
