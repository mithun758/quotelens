// Award scenarios in Aerchain's Quote Comparison vocabulary, computed by code:
// Best Quote, Best Supplier, Incumbent, Best Quote Without Incumbent, Custom.
// Only countable cells are awarded (priced, and substitutes approved by Arjun).
// A conditional discount applies only when the award meets its condition.
import { counts } from "@/lib/comparison/build";
import { formatInr, formatInrCompact } from "@/lib/format/inr";
import { PRIOR_PRICING_REASON } from "@/lib/normalise/normaliseResponse";
import type { AnalystData } from "@/lib/tools/data";
import { applySupplierFilter, type Basis, type SupplierFilter } from "@/lib/tools/filters";

export const SCENARIOS = ["best_quote", "best_supplier", "incumbent", "best_quote_without_incumbent", "custom"] as const;
export type ScenarioKind = (typeof SCENARIOS)[number];

export type CustomAssignment = { supplier: string; lines?: number[]; category?: string };
export type ScenarioSpec = {
  scenario: ScenarioKind;
  filter?: SupplierFilter;
  assignments?: CustomAssignment[];
  default_supplier?: string;
  apply_conditional_discounts?: boolean;
  // Eligibility toggle: count substitutes still awaiting Arjun's sign-off. Rejected ones never count.
  include_pending_substitutes?: boolean;
};

export type AllocatedLine = {
  line: number;
  description: string;
  supplier: string;
  unit_inr: number;
  quantity: number;
  total_inr: number;
  confidence: string;
  on_prior_pricing: boolean;
  last_cycle_unit_inr: number | null;
  nominal_l1_supplier: string | null;
  nominal_l1_unit_inr: number | null;
};

export type ScenarioResult = {
  scenario: ScenarioKind;
  basis: Basis;
  allocation: AllocatedLine[];
  unallocated: { line: number; description: string; reason: string }[];
  by_supplier: { supplier: string; lines: number[]; subtotal_inr: number; discount_inr: number; total_inr: number; freshness: string | null }[];
  discounts: { supplier: string; percent: number; condition: string | null; applied: boolean; reason: string; amount_inr: number }[];
  total_inr: number;
  total_display: string;
  total_exact_display: string;
  last_cycle_inr: number;
  last_cycle_display: string;
  saving_vs_last_cycle_inr: number;
  saving_vs_last_cycle_display: string;
  saving_vs_last_cycle_pct: number | null;
  nominal_l1_inr: number;
  nominal_l1_display: string;
  premium_vs_nominal_l1_inr: number;
  premium_vs_nominal_l1_display: string;
  inferred_lines: number[];
  prior_pricing_lines: number[];
  stale_suppliers_used: string[];
  reconfirm_suppliers_used: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function countableValue(data: AnalystData, supplier: string, line: number, includePending = false): number | null {
  const c = data.cells[supplier]?.[line];
  if (!c) return null;
  const pendingAllowed = includePending && c.substitute_status === "pending";
  const input = { value: c.normalised_value_inr, confidence: c.confidence_state, isSubstitute: c.substitute_status !== null && !pendingAllowed, substituteStatus: c.substitute_status };
  return counts(input) ? c.normalised_value_inr : null;
}

function cheapestAmong(data: AnalystData, suppliers: string[], line: number, includePending = false) {
  let best: { supplier: string; value: number } | null = null;
  for (const s of suppliers) {
    const v = countableValue(data, s, line, includePending);
    if (v !== null && (!best || v < best.value)) best = { supplier: s, value: v };
  }
  return best;
}

export function computeScenario(data: AnalystData, spec: ScenarioSpec): ScenarioResult {
  const incumbent = data.suppliers.find((s) => s.isIncumbent)?.code ?? null;
  const filter: SupplierFilter = { ...(spec.filter ?? {}) };
  if (spec.scenario === "best_quote_without_incumbent") filter.exclude_incumbent = true;
  const basis = applySupplierFilter(data, filter);
  const pending = spec.include_pending_substitutes ?? false;
  let eligible = basis.included_suppliers;
  if (spec.scenario === "incumbent") {
    if (!incumbent) throw new Error("No incumbent supplier on file.");
    eligible = eligible.includes(incumbent) ? [incumbent] : [];
  }
  const allSuppliers = data.suppliers.map((s) => s.code);
  const choice = new Map<number, string>();
  const unallocated: ScenarioResult["unallocated"] = [];

  if (spec.scenario === "best_quote" || spec.scenario === "best_quote_without_incumbent" || spec.scenario === "incumbent") {
    for (const l of data.lines) {
      const best = cheapestAmong(data, eligible, l.line_no, pending);
      if (best) choice.set(l.line_no, best.supplier);
    }
  } else if (spec.scenario === "best_supplier") {
    const ranked = eligible
      .map((s) => {
        const lines = data.lines.filter((l) => countableValue(data, s, l.line_no, pending) !== null);
        const commonLines = data.lines.filter((l) => eligible.every((e) => countableValue(data, e, l.line_no, pending) !== null));
        const common = commonLines.reduce((sum, l) => sum + (countableValue(data, s, l.line_no, pending) ?? 0) * l.quantity, 0);
        return { s, coverage: lines.length, common };
      })
      .sort((a, b) => b.coverage - a.coverage || a.common - b.common);
    const winner = ranked[0]?.s;
    if (winner) for (const l of data.lines) if (countableValue(data, winner, l.line_no, pending) !== null) choice.set(l.line_no, winner);
  } else {
    const assignments = spec.assignments ?? [];
    for (const l of data.lines) {
      const a = assignments.find((x) => x.lines?.includes(l.line_no)) ?? assignments.find((x) => x.category && x.category.toLowerCase() === l.category.toLowerCase());
      const s = (a?.supplier ?? spec.default_supplier)?.toUpperCase();
      if (!s) continue;
      if (!eligible.includes(s)) unallocated.push({ line: l.line_no, description: l.description, reason: `${s} is not eligible: ${basis.excluded_suppliers.find((e) => e.supplier === s)?.reason ?? "unknown supplier"}` });
      else if (countableValue(data, s, l.line_no, pending) === null) unallocated.push({ line: l.line_no, description: l.description, reason: `${s} has no countable price for this line` });
      else choice.set(l.line_no, s);
    }
  }

  const allocation: AllocatedLine[] = [];
  for (const l of data.lines) {
    const s = choice.get(l.line_no);
    if (!s) {
      if (!unallocated.some((u) => u.line === l.line_no)) {
        unallocated.push({ line: l.line_no, description: l.description, reason: eligible.length ? "No eligible supplier has a countable price for this line" : "No eligible suppliers" });
      }
      continue;
    }
    const cell = data.cells[s][l.line_no];
    const unit = cell.normalised_value_inr!;
    const l1 = cheapestAmong(data, allSuppliers, l.line_no, pending);
    allocation.push({
      line: l.line_no,
      description: l.description,
      supplier: s,
      unit_inr: unit,
      quantity: l.quantity,
      total_inr: round2(unit * l.quantity),
      confidence: cell.confidence_state,
      on_prior_pricing: (cell.reason ?? "").startsWith(PRIOR_PRICING_REASON),
      last_cycle_unit_inr: l.last_cycle_price_inr,
      nominal_l1_supplier: l1?.supplier ?? null,
      nominal_l1_unit_inr: l1?.value ?? null,
    });
  }

  // Discounts: evaluated on each supplier's awarded subtotal (ex-GST).
  const discounts: ScenarioResult["discounts"] = [];
  const bySupplier = new Map<string, { lines: number[]; subtotal: number; discount: number }>();
  for (const a of allocation) {
    const e = bySupplier.get(a.supplier) ?? { lines: [], subtotal: 0, discount: 0 };
    e.lines.push(a.line);
    e.subtotal += a.total_inr;
    bySupplier.set(a.supplier, e);
  }
  const applyDiscounts = spec.apply_conditional_discounts ?? true;
  for (const [s, e] of bySupplier) {
    for (const d of data.suppliers.find((x) => x.code === s)!.discounts) {
      const base = allocation.filter((a) => a.supplier === s && (!d.applies_to_lines.length || d.applies_to_lines.includes(a.line))).reduce((sum, a) => sum + a.total_inr, 0);
      let applied = false;
      let reason: string;
      if (d.threshold_inr !== null) {
        applied = applyDiscounts && e.subtotal > d.threshold_inr;
        reason = `${s}'s awarded subtotal ${formatInrCompact(round2(e.subtotal))} is ${e.subtotal > d.threshold_inr ? "above" : "not above"} the ${formatInrCompact(d.threshold_inr)} threshold${applied || e.subtotal <= d.threshold_inr ? "" : "; not applied on request"}`;
      } else if (d.condition) {
        reason = `Condition "${d.condition}" cannot be checked by code; not applied`;
      } else {
        applied = applyDiscounts;
        reason = "Unconditional discount";
      }
      const amount = applied ? round2((base * d.percent) / 100) : 0;
      e.discount += amount;
      discounts.push({ supplier: s, percent: d.percent, condition: d.condition, applied, reason, amount_inr: amount });
    }
  }

  const fresh = (s: string) => data.suppliers.find((x) => x.code === s)!.freshness?.status ?? null;
  const subtotal = round2(allocation.reduce((sum, a) => sum + a.total_inr, 0));
  const discountTotal = round2([...bySupplier.values()].reduce((sum, e) => sum + e.discount, 0));
  const total = round2(subtotal - discountTotal);
  const lastCycle = round2(allocation.reduce((sum, a) => sum + (a.last_cycle_unit_inr ?? 0) * a.quantity, 0));
  const nominalL1 = round2(allocation.reduce((sum, a) => sum + (a.nominal_l1_unit_inr ?? a.unit_inr) * a.quantity, 0));
  const used = [...bySupplier.keys()];

  return {
    scenario: spec.scenario,
    basis,
    allocation,
    unallocated: unallocated.sort((a, b) => a.line - b.line),
    by_supplier: [...bySupplier.entries()]
      .map(([s, e]) => ({ supplier: s, lines: e.lines, subtotal_inr: round2(e.subtotal), discount_inr: round2(e.discount), total_inr: round2(e.subtotal - e.discount), freshness: fresh(s) }))
      .sort((a, b) => a.supplier.localeCompare(b.supplier)),
    discounts,
    total_inr: total,
    total_display: formatInrCompact(total),
    total_exact_display: formatInr(total, 0),
    last_cycle_inr: lastCycle,
    last_cycle_display: formatInrCompact(lastCycle),
    saving_vs_last_cycle_inr: round2(lastCycle - total),
    saving_vs_last_cycle_display: formatInrCompact(round2(lastCycle - total)),
    saving_vs_last_cycle_pct: lastCycle ? round2(((lastCycle - total) / lastCycle) * 100) : null,
    nominal_l1_inr: nominalL1,
    nominal_l1_display: formatInrCompact(nominalL1),
    premium_vs_nominal_l1_inr: round2(total - nominalL1),
    premium_vs_nominal_l1_display: formatInrCompact(round2(total - nominalL1)),
    inferred_lines: allocation.filter((a) => a.confidence === "inferred").map((a) => a.line),
    prior_pricing_lines: allocation.filter((a) => a.on_prior_pricing).map((a) => a.line),
    stale_suppliers_used: used.filter((s) => fresh(s) === "Stale").sort(),
    reconfirm_suppliers_used: used.filter((s) => fresh(s) === "Reconfirm").sort(),
  };
}
