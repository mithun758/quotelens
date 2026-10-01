// The analyst's action tools. None of them writes anything: each returns a preview
// that the chat shows as a card, and the change happens only when Priya confirms it
// there, through the same server action (and AuditEvent) as the screens.
import { z } from "zod";
import { scenarioBlockers } from "@/lib/blockers/scenario";
import { getAward } from "@/lib/award/store";
import { AwardSpec, SCENARIO_LABEL, toScenarioSpec } from "@/lib/award/spec";
import { describeDelta, formatInr } from "@/lib/format/inr";
import { RECONFIRM_KEY, RECONFIRM_TARGET } from "@/lib/review/queue";
import { inferredGroup } from "@/lib/review/groups";
import { computeScenario } from "@/lib/scenarios/compute";
import type { AnalystData } from "./data";
import { defineTool } from "./define";

const REASONS = {
  same_as_last_year: "prior",
  gst_back_calculated: "step:gst",
  priced_per_pack: "step:pack_size",
  bundle_split: "step:bundle",
  unit_converted: "step:uom",
  judgement: "judgement",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const displayDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

const awaiting = (data: AnalystData, code: string, line: number | null, flagType?: string) =>
  data.clarifications.some((c) => c.supplierCode === code && c.status === "awaiting" && (flagType ? c.target_flag_type === flagType : c.lineNo === line));

function supplierOf(data: AnalystData, code: string) {
  const s = data.suppliers.find((x) => x.code === code.toUpperCase());
  if (!s) throw new Error(`Unknown supplier ${code}. Suppliers: ${data.suppliers.map((x) => x.code).join(", ")}`);
  return s;
}

export const acceptValuesTool = defineTool({
  name: "accept_values",
  action: true,
  description:
    "Prepares, for Priya to confirm, accepting a group of Inferred values from one supplier that share a reason (for example every 'same as last year' price). Changes nothing: it returns a preview card listing each value and its reason, with a Confirm button.",
  input: z.object({
    supplier: z.string(),
    reason: z.enum(Object.keys(REASONS) as [keyof typeof REASONS, ...(keyof typeof REASONS)[]]).describe("Which Inferred values: by the reason they are Inferred"),
    lines: z.array(z.number().int()).optional().describe("Limit to these RFx lines"),
  }),
  output: z.object({
    kind: z.literal("accept_values"),
    supplier: z.string(),
    supplier_name: z.string(),
    reason_title: z.string(),
    count: z.number().describe("How many values the card would accept"),
    items: z.array(z.object({ key: z.string(), line: z.number(), description: z.string(), value_inr: z.number().nullable(), value_display: z.string(), reason: z.string().nullable() })),
    requires_confirmation: z.literal(true),
  }),
  run({ data }, input) {
    const s = supplierOf(data, input.supplier);
    const group = REASONS[input.reason];
    const items = Object.values(data.cells[s.code] ?? {})
      .filter((c) => c.confidence_state === "inferred" && c.status === "needs_review" && c.line_no !== null)
      .filter((c) => !input.lines?.length || input.lines.includes(c.line_no!))
      .filter((c) => !awaiting(data, s.code, c.line_no))
      .filter((c) => inferredGroup(c.reason, c.steps.map((st) => st.kind)).key === group)
      .sort((a, b) => a.line_no! - b.line_no!);
    if (!items.length) throw new Error(`${s.name} has no Inferred values awaiting review for that reason.`);
    const lineDesc = new Map(data.lines.map((l) => [l.line_no, l.description]));
    return {
      kind: "accept_values" as const,
      supplier: s.code,
      supplier_name: s.name,
      reason_title: inferredGroup(items[0].reason, items[0].steps.map((st) => st.kind)).title,
      count: items.length,
      items: items.map((c) => ({
        key: `value:${c.id}`,
        line: c.line_no!,
        description: lineDesc.get(c.line_no!) ?? "",
        value_inr: c.normalised_value_inr,
        value_display: formatInr(c.normalised_value_inr),
        reason: c.reason,
      })),
      requires_confirmation: true as const,
    };
  },
});

export const sendClarificationTool = defineTool({
  name: "send_clarification",
  action: true,
  description:
    "Prepares, for Priya to confirm, a question to a supplier about its open review items (chosen lines, questionnaire failures, quote-level flags) and, with reconfirm_prices, a request to confirm its prices still hold and state its validity. Changes nothing: the question is drafted and shown on a card with a Send question button.",
  input: z.object({
    supplier: z.string(),
    lines: z.array(z.number().int()).optional(),
    include_questionnaire: z.boolean().optional(),
    flag_types: z.array(z.string()).optional().describe("Quote-level flag types, e.g. freight_not_included"),
    reconfirm_prices: z.boolean().optional().describe("Ask the supplier to confirm its prices still hold and state its validity; for Stale or Reconfirm quotes"),
  }),
  output: z.object({
    kind: z.literal("send_clarification"),
    supplier: z.string(),
    supplier_name: z.string(),
    keys: z.array(z.string()),
    count: z.number().describe("How many review items the question covers"),
    items: z.array(z.string()),
    requires_confirmation: z.literal(true),
  }),
  run({ data }, input) {
    const s = supplierOf(data, input.supplier);
    const keys: string[] = [];
    const labels: string[] = [];
    for (const line of input.lines ?? []) {
      const c = data.cells[s.code]?.[line];
      if (c && (c.status === "needs_review" || c.openFlags.length) && !awaiting(data, s.code, line)) {
        keys.push(`value:${c.id}`);
        labels.push(`Line ${line}: ${data.lines.find((l) => l.line_no === line)?.description ?? ""}`);
      }
    }
    for (const f of s.responseFlags.filter((x) => x.status === "open" && x.type !== "clarification_requested" && input.flag_types?.includes(x.type))) {
      if (awaiting(data, s.code, null, f.type)) continue;
      keys.push(`flag:${f.id}`);
      labels.push(f.message);
    }
    if (input.include_questionnaire && s.questionnaireFailures.length && !awaiting(data, s.code, null, "questionnaire")) {
      keys.push("questionnaire");
      labels.push(`Questionnaire: fails ${s.questionnaireFailures.length} of ${s.questionnaireTotal}`);
    }
    if (input.reconfirm_prices && !awaiting(data, s.code, null, RECONFIRM_TARGET)) {
      keys.push(RECONFIRM_KEY);
      labels.push(`Reconfirm prices${s.quoteDate ? ` dated ${displayDay(s.quoteDate)}` : ""} and state validity`);
    }
    if (!keys.length) throw new Error(`Nothing open to ask ${s.name} about with those choices (items already awaiting a reply are skipped).`);
    return { kind: "send_clarification" as const, supplier: s.code, supplier_name: s.name, keys, count: keys.length, items: labels, requires_confirmation: true as const };
  },
});

export const setViewTool = defineTool({
  name: "set_view",
  action: true,
  description:
    "Switches what the Quote Comparison shows: the view (prices, compliance, freshness), Quoted or Decision-ready, and the basket. Applies at once; it changes no data.",
  input: z.object({
    view: z.enum(["prices", "compliance", "freshness"]).optional(),
    quotes: z.enum(["quoted", "decision_ready"]).optional().describe("Decision-ready counts only qualified suppliers whose quote is not Stale"),
    basket: z.enum(["common", "all"]).optional(),
  }),
  output: z.object({
    kind: z.literal("set_view"),
    view: z.enum(["prices", "compliance", "freshness"]).nullable(),
    quotes: z.enum(["quoted", "decision_ready"]).nullable(),
    basket: z.enum(["common", "all"]).nullable(),
  }),
  run(_ctx, input) {
    return { kind: "set_view" as const, view: input.view ?? null, quotes: input.quotes ?? null, basket: input.basket ?? null };
  },
});

export const chooseScenarioTool = defineTool({
  name: "choose_scenario_and_draft_memo",
  action: true,
  description:
    "Prepares, for Priya to confirm, choosing an award scenario (with the current eligibility settings) and generating the memo for Meera. Changes nothing: it returns the scenario's totals and open blockers on a card. The memo is blocked while blockers remain; overrides need Priya's own typed reason on the Award screen.",
  input: z.object({ scenario: z.enum(["best_quote", "best_supplier", "incumbent", "best_quote_without_incumbent"]) }),
  output: z.object({
    kind: z.literal("choose_scenario"),
    spec: AwardSpec,
    scenario_label: z.string(),
    total_display: z.string(),
    vs_last_cycle: z.string(),
    suppliers: z.array(z.string()),
    lines_awarded: z.number(),
    lines_not_covered: z.array(z.number()),
    eligibility_note: z.string(),
    open_blockers: z.array(z.object({ type: z.string(), supplier: z.string().nullable(), line: z.number().nullable(), detail: z.string() })),
    memo_blocked: z.boolean(),
    requires_confirmation: z.literal(true),
  }),
  async run({ data, client }, input) {
    const { award, spec } = await getAward(client);
    const next = { ...spec, scenario: input.scenario };
    const result = computeScenario(data, toScenarioSpec(next));
    const overrides = award?.overrides ?? [];
    const open = scenarioBlockers(data, result).filter((b) => !overrides.some((o) => o.key === b.key));
    return {
      kind: "choose_scenario" as const,
      spec: next,
      scenario_label: SCENARIO_LABEL[input.scenario],
      total_display: result.total_display,
      vs_last_cycle: describeDelta(result.saving_vs_last_cycle_inr, "last cycle"),
      suppliers: result.by_supplier.map((b) => `${b.supplier}. ${data.suppliers.find((s) => s.code === b.supplier)?.name ?? ""}`),
      lines_awarded: result.allocation.length,
      lines_not_covered: result.unallocated.map((u) => u.line),
      eligibility_note: [spec.require_questionnaire && "questionnaire passed only", spec.exclude_stale && "Stale quotes excluded", spec.exclude_reconfirm && "quotes needing reconfirmation excluded"].filter(Boolean).join(", ") || "all suppliers eligible",
      open_blockers: open.map((b) => ({ type: b.type, supplier: b.supplier, line: b.line, detail: b.detail })),
      memo_blocked: open.length > 0,
      requires_confirmation: true as const,
    };
  },
});

// What the chat receives for each action tool that ran: the preview, plus the drafted
// question for send_clarification, and the card's state once Priya acts on it.
export type AcceptPreview = z.infer<typeof acceptValuesTool.output>;
export type SendPreview = z.infer<typeof sendClarificationTool.output> & { draft?: { subject: string; body: string }; draft_error?: string };
export type ViewPreview = z.infer<typeof setViewTool.output>;
export type ScenarioPreview = z.infer<typeof chooseScenarioTool.output>;
export type ChatAction = (AcceptPreview | SendPreview | ViewPreview | ScenarioPreview) & { status?: "done"; done_note?: string };
