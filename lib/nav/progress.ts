// Where Priya is in the sequence, for the step rail and header. Read-only: every
// count comes from the same loaders the screens use.
import { loadAwardView } from "@/lib/award/view";
import type { Db } from "@/lib/db/client";
import { loadQuotes } from "@/lib/quotes/load";

export type StepState = "done" | "attention" | "open";
export type Step = { href: "/rfx" | "/quotes" | "/comparison" | "/award"; label: string; state: StepState; note: string };
export type Progress = { rfxTitle: string; steps: Step[]; awardBlockers: number | null };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function loadProgress(client: Db, displayDate: (iso: string) => string): Promise<Progress> {
  const [{ rail, rfx }, award, pending] = await Promise.all([
    loadQuotes(client, null),
    loadAwardView(client).catch(() => null),
    client.from("extracted_value").select("id", { count: "exact", head: true }).eq("substitute_status", "pending"),
  ]);
  const notExtracted = rail.filter((r) => r.response && r.response.status !== "extracted").length;
  const toReview = rail.reduce((t, r) => t + r.queueCount, 0);
  const substitutes = pending.count ?? 0;
  const extracted = rail.length > 0 && notExtracted === 0;
  const blockers = extracted && award ? award.openBlockers : null;
  const memo = !!award?.award?.memo_markdown;

  const steps: Step[] = [
    { href: "/rfx", label: "RFx", state: rfx.sent_at ? "done" : "open", note: rfx.sent_at ? `Sent ${displayDate(rfx.sent_at.slice(0, 10))}` : "Draft" },
    {
      href: "/quotes",
      label: "Quotes",
      state: !extracted ? "attention" : toReview ? "attention" : "done",
      note: !extracted ? `${plural(notExtracted, "quote")} to extract` : toReview ? `${toReview} to review` : "All reviewed",
    },
    {
      href: "/comparison",
      label: "Comparison",
      state: !extracted ? "open" : substitutes ? "attention" : "done",
      note: !extracted ? "Waiting for quotes" : substitutes ? `${plural(substitutes, "substitute")} to sign off` : "Ready",
    },
    {
      href: "/award",
      label: "Award",
      state: blockers === null ? "open" : blockers ? "attention" : memo ? "done" : "open",
      note: blockers === null ? "Waiting for quotes" : blockers ? plural(blockers, "blocker") : memo ? "Memo ready" : "Ready for memo",
    },
  ];
  return { rfxTitle: rfx.title, steps, awardBlockers: blockers };
}
