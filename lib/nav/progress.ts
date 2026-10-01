// Where Priya is in the sequence, for the step rail and header: four steps, each with
// the stages of the journey nested under it. Read-only: every count comes from the
// same loaders and helpers the screens use.
import { readinessFor } from "@/lib/award/readiness";
import { loadAwardView } from "@/lib/award/view";
import { decisionReady } from "@/lib/comparison/decisionReady";
import type { Db } from "@/lib/db/client";
import { loadQuotes } from "@/lib/quotes/load";
import { comparisonInputs } from "@/lib/tools/shared";
import { asOfDate } from "@/lib/config";
import { sendProblems } from "@/lib/rfx/draft";
import { getDraft } from "@/lib/rfx/store";
import type { LensScreen } from "@/lib/ai/lens/context";

export type StageState = "done" | "attention" | "open";
// Where a stage lives: a path, plus the view (?view=) or section (#id) on that screen.
export type StageTarget = { path: "/rfx" | "/quotes" | "/comparison" | "/award"; view?: string; section?: string; analyst?: boolean };
export type Stage = { key: string; label: string; target: StageTarget; state: StageState; count: number | null; note: string };
export type Step = { href: StageTarget["path"]; label: string; stages: Stage[] };
// attention: what the collapsed Lens tab counts on each screen.
// status: where the event stands, for the badge beside its name in the top bar.
// search: what the Cmd+K bar can jump to.
export type EventStatus = "Draft" | "Collecting quotes" | "Evaluating" | "Awarded";
export type Progress = {
  rfxTitle: string;
  status: EventStatus;
  steps: Step[];
  awardBlockers: number | null;
  attention: Partial<Record<LensScreen, number>>;
  search: { suppliers: { code: string; name: string }[]; lines: { line_no: number; description: string }[] };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const href = (t: StageTarget) => `${t.path}${t.view ? `?view=${t.view}` : ""}${t.analyst ? `${t.view ? "&" : "?"}analyst=1` : ""}${t.section ? `#${t.section}` : ""}`;
export const stageHref = href;

export async function loadProgress(client: Db, displayDate: (iso: string) => string): Promise<Progress> {
  const [{ rail, rfx }, award, pending, draft, lineRows] = await Promise.all([
    loadQuotes(client, null),
    loadAwardView(client).catch(() => null),
    client.from("extracted_value").select("id", { count: "exact", head: true }).eq("substitute_status", "pending"),
    getDraft(client).catch(() => null),
    client.from("line_item").select("line_no, description").order("line_no"),
  ]);
  const received = rail.filter((r) => r.response).length;
  const notExtracted = rail.filter((r) => r.response && r.response.status !== "extracted").length;
  const extracted = rail.length > 0 && notExtracted === 0;
  const toReview = rail.reduce((t, r) => t + r.queueCount, 0);
  const substitutes = pending.count ?? 0;
  const data = extracted ? award?.data : undefined;
  const lineCount = data?.lines.length ?? 0;

  const failing = data?.suppliers.filter((s) => s.questionnairePassed < s.questionnaireTotal).length ?? 0;
  const stale = data?.suppliers.filter((s) => s.freshness?.status === "Stale").length ?? 0;
  const reconfirm = data?.suppliers.filter((s) => s.freshness?.status === "Reconfirm").length ?? 0;
  const ready = data
    ? decisionReady({
        suppliers: data.suppliers,
        freshness: Object.fromEntries(data.suppliers.map((s) => [s.code, s.freshness])),
        lines: data.lines,
        inputs: comparisonInputs(data, data.suppliers.map((s) => s.code)).cells,
      })
    : null;
  const uncovered = ready ? lineCount - ready.result.pricedLines.length : 0;
  const readiness = extracted && award ? readinessFor(award.chosen.allocation, award.blockers, lineCount) : null;
  const blockers = extracted && award ? award.openBlockers : null;
  const waiting = { state: "open" as const, count: null, note: "Waiting for quotes" };

  const steps: Step[] = [
    {
      href: "/rfx",
      label: "RFx",
      stages: [{ key: "rfx", label: "RFx workspace", target: { path: "/rfx" }, state: rfx.sent_at ? "done" : "open", count: null, note: rfx.sent_at ? `Sent ${displayDate(rfx.sent_at.slice(0, 10))}` : "Draft" }],
    },
    {
      href: "/quotes",
      label: "Quotes",
      stages: [
        { key: "inbox", label: "Supplier inbox", target: { path: "/quotes", section: "inbox" }, state: received === rail.length && received > 0 ? "done" : "open", count: null, note: `${received} of ${rail.length} received` },
        {
          key: "extraction",
          label: "Extraction and mapping",
          target: { path: "/quotes", section: "extraction" },
          state: notExtracted ? "attention" : "done",
          count: notExtracted || null,
          note: notExtracted ? `${plural(notExtracted, "quote")} to read` : `${rail.length} of ${rail.length} read`,
        },
        {
          key: "exceptions",
          label: "Exception review",
          target: { path: "/quotes", section: "exceptions" },
          ...(!extracted ? waiting : toReview ? { state: "attention" as const, count: toReview, note: `${toReview} to review` } : { state: "done" as const, count: null, note: "All reviewed" }),
        },
      ],
    },
    {
      href: "/comparison",
      label: "Comparison",
      stages: [
        { key: "prices", label: "Normalised comparison", target: { path: "/comparison", view: "prices" }, ...(!extracted ? waiting : { state: "done" as const, count: null, note: `${lineCount} lines, ₹ per piece` }) },
        {
          key: "compliance",
          label: "Compliance",
          target: { path: "/comparison", view: "compliance" },
          ...(!extracted
            ? waiting
            : substitutes
              ? { state: "attention" as const, count: substitutes, note: `${plural(substitutes, "substitute")} to sign off` }
              : { state: failing ? ("open" as const) : ("done" as const), count: null, note: failing ? `${failing} fail the questionnaire` : "All compliant" }),
        },
        { key: "analyst", label: "AI analyst", target: { path: "/comparison", view: "prices", analyst: true }, state: "open", count: null, note: extracted ? "Ask in plain language" : "Waiting for quotes" },
        {
          key: "freshness",
          label: "Quote Freshness",
          target: { path: "/comparison", view: "freshness" },
          ...(!extracted
            ? waiting
            : stale + reconfirm
              ? { state: "attention" as const, count: stale + reconfirm, note: [stale && `${stale} Stale`, reconfirm && `${reconfirm} Reconfirm`].filter(Boolean).join(", ") }
              : { state: "done" as const, count: null, note: "All Fresh" }),
        },
        {
          key: "decision",
          label: "Decision-ready scenario",
          target: { path: "/comparison", view: "decision" },
          ...(!ready
            ? waiting
            : uncovered
              ? { state: "attention" as const, count: uncovered, note: `${plural(ready.included.length, "supplier")}; ${uncovered} lines unpriced` }
              : { state: "done" as const, count: null, note: `${plural(ready.included.length, "supplier")}; all lines priced` }),
        },
      ],
    },
    {
      href: "/award",
      label: "Award",
      stages: [
        {
          key: "readiness",
          label: "Decision readiness",
          target: { path: "/award", section: "readiness" },
          ...(!readiness || blockers === null
            ? waiting
            : blockers
              ? { state: "attention" as const, count: blockers, note: `${readiness.ready} of ${readiness.total} lines ready` }
              : { state: "done" as const, count: null, note: `${readiness.ready} of ${readiness.total} lines ready` }),
        },
      ],
    },
  ];
  const attention: Progress["attention"] = {
    rfx: draft && draft.status !== "sent" && draft.draft.lines.length ? sendProblems(draft.draft, asOfDate()).length : 0,
    quotes: notExtracted + toReview,
    comparison: extracted ? substitutes + stale + reconfirm : 0,
    award: blockers ?? 0,
    eval: 0,
  };
  const status: EventStatus = !rfx.sent_at
    ? "Draft"
    : award?.award?.status === "exported"
      ? "Awarded"
      : extracted && received === rail.length
        ? "Evaluating"
        : "Collecting quotes";
  return {
    rfxTitle: rfx.title,
    status,
    steps,
    awardBlockers: blockers,
    attention,
    search: { suppliers: rail.map((r) => ({ code: r.supplier.code, name: r.supplier.name })), lines: lineRows.data ?? [] },
  };
}
