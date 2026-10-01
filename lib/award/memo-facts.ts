// The facts the award memo may use, all computed by code. The memo writer sees only
// this; every figure carries a display string and a link back to where it came from.
import type { Db } from "@/lib/db/client";
import { formatInr, formatInrCompact } from "@/lib/format/inr";
import { rateOn } from "@/lib/normalise/fx";
import { formatDisplayDate } from "@/lib/config";
import { computeScenario } from "@/lib/scenarios/compute";
import { scenarioBlockers } from "@/lib/blockers/scenario";
import type { AwardView } from "./view";
import { SCENARIO_LABEL, toScenarioSpec } from "./spec";

export const cellLink = (supplier: string, line: number) => `/comparison?cell=${supplier}-${line}`;
export const scenarioLink = (scenario: string) => `/award#scenario-${scenario}`;

export async function buildMemoFacts(client: Db, view: AwardView & { data: import("@/lib/tools/data").AnalystData }) {
  const { data, chosen, spec, rows } = view;
  const { data: fx } = await client.from("fx_rate").select("*");
  const usd = rateOn((fx ?? []).filter((r) => r.base_currency === "USD"), data.asOfDate);
  const usdLinesAwarded = chosen.allocation.filter((a) => data.cells[a.supplier][a.line].raw_currency === "USD").map((a) => a.line);
  const chosenRow = rows.find((r) => r.scenario === spec.scenario)!;
  const name = (code: string) => data.suppliers.find((s) => s.code === code)?.name ?? code;

  const alternatives = rows
    .filter((r) => r.scenario !== spec.scenario)
    .map((r) =>
      !r.available
        ? { scenario: r.label, link: scenarioLink(r.scenario), not_available: "No eligible supplier can be awarded any line under the current eligibility settings" }
        : {
      scenario: r.label,
      link: scenarioLink(r.scenario),
      suppliers: r.suppliers.map(name),
      total_display: r.totalDisplay,
      total_inr: r.total,
      difference_vs_recommended_display: formatInrCompact(Math.round((r.total - chosen.total_inr) * 100) / 100),
      difference_vs_recommended_inr: Math.round((r.total - chosen.total_inr) * 100) / 100,
      saving_vs_last_cycle_display: r.savingsVsLastCycleDisplay,
      open_blockers: r.openBlockers,
      stale_suppliers_used: r.staleUsed.map(name),
      lines_not_covered: r.unallocated,
    },
    );

  // What freshness exclusions cost: the same scenario with Stale and Reconfirm quotes allowed.
  let ifFreshnessAllowed = null;
  if (spec.exclude_stale || spec.exclude_reconfirm) {
    const relaxed = computeScenario(data, toScenarioSpec({ ...spec, exclude_stale: false, exclude_reconfirm: false }));
    if (relaxed.allocation.length) {
      ifFreshnessAllowed = {
        scenario: SCENARIO_LABEL[spec.scenario],
        suppliers: relaxed.by_supplier.map((b) => `${name(b.supplier)} (${b.freshness})`),
        total_display: relaxed.total_display,
        difference_vs_recommended_display: formatInrCompact(Math.round((relaxed.total_inr - chosen.total_inr) * 100) / 100),
        difference_vs_recommended_inr: Math.round((relaxed.total_inr - chosen.total_inr) * 100) / 100,
        stale_suppliers_used: relaxed.stale_suppliers_used.map(name),
        open_blockers: scenarioBlockers(data, relaxed).length,
        why_not_recommended: "It relies on quotes excluded by the freshness settings; a Stale quote blocks the memo unless overridden.",
      };
    }
  }

  const freshness = chosen.by_supplier.map((b) => {
    const s = data.suppliers.find((x) => x.code === b.supplier)!;
    return { supplier: s.name, status: s.freshness?.status ?? "unknown", valid_until: s.validUntil ? formatDisplayDate(s.validUntil) : "not stated", fired_rules: (s.freshness?.fired ?? []).map((r) => `${r.label}: ${r.reason}`) };
  });

  const risks: string[] = [];
  const prior = chosen.allocation.filter((a) => a.on_prior_pricing);
  if (prior.length) {
    risks.push(
      `${prior.length} awarded line${prior.length === 1 ? "" : "s"} (${prior.map((a) => a.line).join(", ")}) rest on a "same as last year" price. They may look cheap because they reflect last year's market, not today's; reconfirm before ordering.`,
    );
  }
  for (const s of chosen.reconfirm_suppliers_used) risks.push(`${name(s)} needs reconfirmation: ${data.suppliers.find((x) => x.code === s)!.freshness!.fired.map((r) => r.label).join(", ")}.`);
  for (const d of chosen.discounts) risks.push(d.applied ? `${name(d.supplier)}'s ${d.percent}% conditional discount is applied (${d.reason}); it depends on the order meeting the condition.` : `${name(d.supplier)}'s ${d.percent}% conditional discount is not applied: ${d.reason}.`);
  for (const s of chosen.by_supplier) {
    for (const f of data.suppliers.find((x) => x.code === s.supplier)!.responseFlags.filter((x) => ["freight_not_included", "freight_terms_not_stated"].includes(x.type))) risks.push(`${name(s.supplier)}: ${f.message}`);
  }
  if (usdLinesAwarded.length) risks.push(`Lines ${usdLinesAwarded.join(", ")} are quoted in USD and converted at the illustrative rate; the rupee cost moves with the exchange rate.`);
  if (chosen.unallocated.length) risks.push(`${chosen.unallocated.length} line${chosen.unallocated.length === 1 ? "" : "s"} not covered by this award: ${chosen.unallocated.map((u) => `line ${u.line} (${u.reason})`).join("; ")}.`);

  return {
    rfx: data.rfx.title,
    prepared_for: "Meera, Head of Commercial Finance",
    prepared_by: "Priya, Category Buyer",
    as_of: formatDisplayDate(data.asOfDate),
    recommended: {
      scenario: SCENARIO_LABEL[spec.scenario],
      link: scenarioLink(spec.scenario),
      eligibility: view.eligibility,
      excluded_suppliers: chosen.basis.excluded_suppliers.map((e) => ({ supplier: name(e.supplier), reason: e.reason })),
      suppliers: chosen.by_supplier.map((b) => ({
        supplier: name(b.supplier),
        code: b.supplier,
        lines: b.lines,
        total_display: formatInrCompact(b.total_inr),
        total_inr: b.total_inr,
        discount_display: b.discount_inr ? formatInr(b.discount_inr) : null,
      })),
      total_display: chosen.total_display,
      total_inr: chosen.total_inr,
      saving_vs_last_cycle_display: chosen.saving_vs_last_cycle_display,
      saving_vs_last_cycle_inr: chosen.saving_vs_last_cycle_inr,
      saving_vs_last_cycle_pct: chosen.saving_vs_last_cycle_pct,
      last_cycle_display: chosen.last_cycle_display,
      saving_vs_l1_display: chosenRow.savingsVsL1Display,
      saving_vs_l1_inr: chosenRow.savingsVsL1,
      nominal_l1_display: formatInrCompact(chosen.nominal_l1_inr),
      lines: chosen.allocation.map((a) => ({
        line: a.line,
        item: a.description,
        supplier: a.supplier,
        unit_display: formatInr(a.unit_inr),
        quantity: a.quantity,
        line_total_display: formatInr(a.total_inr),
        confidence: a.confidence,
        on_prior_pricing: a.on_prior_pricing,
        link: cellLink(a.supplier, a.line),
      })),
    },
    alternatives,
    if_freshness_exclusions_were_lifted: ifFreshnessAllowed,
    assumptions: {
      fx: usd ? `USD/INR ${usd.rate} on ${formatDisplayDate(usd.rate_date)} (illustrative)` : "No foreign-currency lines",
      basket: `${chosen.allocation.length} of ${data.lines.length} RFx lines awarded`,
      gst_basis: "All prices ex-GST (input tax credit is recoverable); GST rate errors are flagged separately",
      price_basis: "INR per piece, delivered to hub; unknown freight is never added",
      benchmarks: "Memory price index and FX rates are illustrative",
    },
    freshness,
    overrides: view.overrides.map((o) => ({ blocker: o.detail, supplier: o.supplier ? name(o.supplier) : null, line: o.line, reason: o.reason, at: formatDisplayDate(o.at.slice(0, 10)) })),
    open_risks: risks,
    allowed_links: [...new Set([...chosen.allocation.map((a) => cellLink(a.supplier, a.line)), ...rows.map((r) => scenarioLink(r.scenario))])],
  };
}

export type MemoFacts = Awaited<ReturnType<typeof buildMemoFacts>>;
