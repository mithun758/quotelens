// "What Lens did": each tool call in plain words, for the activity log and the typing
// indicator. Pure, so the dock can render it from the tool name and input alone.

type Input = Record<string, unknown> | null | undefined;

const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : null);

function basis(input: Input): string {
  const f = (input?.filter ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (f.questionnaire_passed_only) parts.push("qualified suppliers only");
  if (Array.isArray(f.exclude_freshness) && f.exclude_freshness.length) parts.push(`excluding ${(f.exclude_freshness as string[]).join(" and ")}`);
  if (list(f.suppliers)) parts.push(`suppliers ${list(f.suppliers)}`);
  if (list(f.exclude_suppliers)) parts.push(`without ${list(f.exclude_suppliers)}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

const SCENARIO: Record<string, string> = {
  best_quote: "Best Quote",
  best_supplier: "Best Supplier",
  incumbent: "Incumbent",
  best_quote_without_incumbent: "Best Quote Without Incumbent",
  custom: "a custom allocation",
};

// What Lens is doing, for the typing indicator: "Checking Quote Freshness".
export function activityNow(name: string): string {
  const now: Record<string, string> = {
    get_comparison: "Reading the comparison",
    filter_suppliers: "Filtering suppliers",
    rank_lines: "Ranking prices per line",
    supplier_totals: "Totalling each supplier",
    compute_scenario: "Computing a scenario",
    compare_scenarios: "Comparing scenarios",
    compare_last_cycle: "Comparing with last cycle",
    get_freshness: "Checking Quote Freshness",
    list_blockers: "Listing award blockers",
    get_award_status: "Reading the award as you set it",
    get_source: "Opening the source document",
    draft_clarification: "Drafting a question",
    make_chart: "Drawing a chart",
    export: "Preparing a file",
    accept_values: "Preparing values to accept",
    send_clarification: "Drafting a question to send",
    set_view: "Switching the view",
    choose_scenario_and_draft_memo: "Preparing the scenario and memo",
    get_purchase_history: "Reading last cycle's purchases",
    get_meridian_standards: "Reading Meridian's standard terms",
    get_suppliers: "Looking up the suppliers",
    update_rfx_draft: "Updating the RFx draft",
  };
  return now[name] ?? "Working";
}

// One finished step for the activity log, in the past tense.
export function describeToolCall(name: string, input: Input, error?: string | null): string {
  const i = input ?? {};
  const fail = error ? ` (failed: ${error.slice(0, 80)})` : "";
  const s = (k: string) => (typeof i[k] === "string" ? (i[k] as string) : null);
  let text: string;
  switch (name) {
    case "get_comparison":
      text = `Read the comparison${list((i.lines as { lines?: number[] } | undefined)?.lines) ? ` for lines ${list((i.lines as { lines: number[] }).lines)}` : ""}${basis(i)}`;
      break;
    case "filter_suppliers":
      text = `Filtered the suppliers${basis(i)}`;
      break;
    case "rank_lines":
      text = `Ranked L1 and L2 on every line${basis(i)}`;
      break;
    case "supplier_totals":
      text = `Totalled each supplier on the ${s("basket") === "all" ? "all-lines basis" : "common basket"}${basis(i)}`;
      break;
    case "compute_scenario":
      text = `Computed the ${SCENARIO[s("scenario") ?? ""] ?? "chosen"} scenario${basis(i)}`;
      break;
    case "compare_scenarios": {
      const a = (i.a ?? {}) as Record<string, unknown>;
      const b = (i.b ?? {}) as Record<string, unknown>;
      text = `Compared ${SCENARIO[String(b.scenario)] ?? "one scenario"} with ${SCENARIO[String(a.scenario)] ?? "another"}`;
      break;
    }
    case "compare_last_cycle":
      text = "Compared every price with last cycle";
      break;
    case "get_freshness":
      text = `Checked Quote Freshness${list(i.suppliers) ? ` for ${list(i.suppliers)}` : " for every supplier"}`;
      break;
    case "list_blockers":
      text = `Listed what blocks the award${i.scenario ? ` under ${SCENARIO[String((i.scenario as Record<string, unknown>).scenario)] ?? "the scenario"}` : ""}`;
      break;
    case "get_award_status":
      text = "Read the award as set on the Award screen";
      break;
    case "get_source":
      text = `Opened the source for ${s("supplier") ?? "a supplier"}, line ${i.line ?? "?"}`;
      break;
    case "draft_clarification":
    case "send_clarification":
      text = `Drafted a question to ${s("supplier") ?? "a supplier"}${i.reconfirm_prices ? " asking it to reconfirm its prices" : ""}`;
      break;
    case "make_chart":
      text = `Drew a chart${s("title") ? `: ${s("title")}` : ""}`;
      break;
    case "export":
      text = `Prepared ${s("format") === "pdf" ? "a PDF" : "an Excel file"}`;
      break;
    case "accept_values":
      text = `Prepared ${s("supplier") ?? "a supplier"}'s ${String(s("reason") ?? "").replace(/_/g, " ")} values for you to accept`;
      break;
    case "set_view":
      text = "Switched the comparison view";
      break;
    case "choose_scenario_and_draft_memo":
      text = `Prepared the ${SCENARIO[s("scenario") ?? ""] ?? "chosen"} scenario for your confirmation`;
      break;
    case "get_purchase_history":
      text = `Read last cycle's purchases${s("category") ? ` for ${s("category")}` : ""}`;
      break;
    case "get_meridian_standards":
      text = "Read Meridian's standard questionnaire and terms";
      break;
    case "get_suppliers":
      text = "Looked up the onboarded suppliers";
      break;
    case "update_rfx_draft": {
      const parts = ["header", "upsert_lines", "remove_lines", "terms", "questionnaire"].filter((k) => i[k] !== undefined).map((k) => ({ header: "header", upsert_lines: "lines", remove_lines: "removed lines", terms: "terms", questionnaire: "questionnaire" })[k]);
      text = `Updated the RFx draft${parts.length ? ` (${parts.join(", ")})` : ""}`;
      break;
    }
    default:
      text = `Used ${name.replace(/_/g, " ")}`;
  }
  return `${text}${fail}`;
}
