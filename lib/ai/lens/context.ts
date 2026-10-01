// Fills the Lens system prompt's {{placeholders}} from the database and the UI state.
// Every value is read fresh for each turn; none is hardcoded in the prompt.
import { SCENARIO_LABEL, toScenarioSpec } from "@/lib/award/spec";
import { getAward } from "@/lib/award/store";
import { scenarioBlockers } from "@/lib/blockers/scenario";
import { CUSTOMER_NAME, asOfDate, formatDisplayDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { computeScenario } from "@/lib/scenarios/compute";
import type { AnalystData } from "@/lib/tools/data";
import { loadQuotes } from "@/lib/quotes/load";

export const LENS_SCREENS = ["rfx", "quotes", "comparison", "award", "eval"] as const;
export type LensScreen = (typeof LENS_SCREENS)[number];
// What Priya is looking at: the screen, what is selected on it, and whether she has
// just arrived without typing (a briefing).
export type LensUi = { screen: LensScreen; selection: string; briefing: boolean };

export type LensPlaceholders = {
  as_of_date: string;
  event_name: string;
  customer_name: string;
  rfx_sent_date: string;
  need_by_date: string;
  approval_days: string;
  screen: string;
  selection: string;
  event_state: string;
  briefing_trigger: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function lensContext(client: Db, data: AnalystData, ui: LensUi): Promise<LensPlaceholders> {
  const [{ rail }, { award, spec }, openFlags] = await Promise.all([
    loadQuotes(client, null),
    getAward(client),
    client.from("flag").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const received = rail.filter((r) => r.response).length;
  const read = rail.filter((r) => r.response?.status === "extracted").length;
  const review = rail.filter((r) => r.queueCount > 0).map((r) => `${r.supplier.name} ${r.queueCount}`);
  const toReview = rail.reduce((t, r) => t + r.queueCount, 0);
  const awaiting = data.clarifications.filter((c) => c.status === "awaiting");
  const awaitingSuppliers = [...new Set(awaiting.map((c) => c.supplierCode))];

  let awardState = "no scenario chosen yet";
  if (read > 0) {
    const result = computeScenario(data, toScenarioSpec(spec));
    const overrides = award?.overrides ?? [];
    const open = scenarioBlockers(data, result).filter((b) => !overrides.some((o) => o.key === b.key)).length;
    awardState = `chosen scenario ${SCENARIO_LABEL[spec.scenario]} with ${plural(open, "open award blocker")}${award?.memo_markdown ? ", memo written" : ""}`;
  }
  // The roster ties each letter the tools use to its supplier, so Lens never guesses.
  const roster = data.suppliers
    .map((s) => {
      const r = rail.find((x) => x.supplier.code === s.code);
      const read = r?.response?.status === "extracted";
      return `${s.code} = ${s.name}${s.isIncumbent ? " (incumbent)" : ""}: ${read ? `questionnaire ${s.questionnairePassed}/${s.questionnaireTotal}, ${s.freshness?.status ?? "freshness not checked"}` : "not yet extracted"}`;
    })
    .join("; ");

  const state = [
    `suppliers: ${roster}`,
    `${received} of ${rail.length} responses received`,
    read === rail.length ? "all read" : `${read} read, ${rail.length - read} not yet extracted`,
    toReview ? `${plural(toReview, "item")} needing review (${review.join(", ")})` : "no items needing review",
    plural(openFlags.count ?? 0, "open flag"),
    awaiting.length ? `awaiting replies from ${awaitingSuppliers.join(", ")}` : "no clarifications awaiting a reply",
    awardState,
  ].join("; ");

  return {
    as_of_date: formatDisplayDate(asOfDate()),
    event_name: data.rfx.title,
    customer_name: CUSTOMER_NAME,
    rfx_sent_date: data.rfx.sent_at ? formatDisplayDate(data.rfx.sent_at.slice(0, 10)) : "not sent",
    need_by_date: formatDisplayDate(data.rfx.need_by_date),
    approval_days: String(data.rfx.approval_days),
    screen: ui.screen,
    selection: ui.selection.trim() || "none",
    event_state: state,
    briefing_trigger: String(ui.briefing),
  };
}
