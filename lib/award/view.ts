// Everything the Award screen shows, computed in /lib: every scenario under the current
// toggles, the chosen one in detail, its blockers with overrides applied, and the memo.
import { scenarioBlockers, type Blocker } from "@/lib/blockers/scenario";
import type { Db } from "@/lib/db/client";
import type { AwardOverride, AwardRow } from "@/lib/db/types";
import { formatInrCompact } from "@/lib/format/inr";
import { SCENARIOS, computeScenario, type ScenarioResult } from "@/lib/scenarios/compute";
import { loadAnalystData, type AnalystData } from "@/lib/tools/data";
import { SCENARIO_LABEL, describeEligibility, toScenarioSpec, type AwardSpec } from "./spec";
import { getAward } from "./store";

export type ScenarioRow = {
  scenario: AwardSpec["scenario"];
  label: string;
  available: boolean;
  suppliers: string[];
  linesAwarded: number;
  unallocated: number;
  total: number;
  totalDisplay: string;
  savingsVsL1: number;
  savingsVsL1Display: string;
  savingsVsLastCycle: number;
  savingsVsLastCycleDisplay: string;
  savingsVsLastCyclePct: number | null;
  openBlockers: number;
  staleUsed: string[];
};

export type BlockerView = Blocker & { override: AwardOverride | null };

export type AwardView = {
  spec: AwardSpec;
  eligibility: string[];
  rows: ScenarioRow[];
  chosen: ScenarioResult;
  blockers: BlockerView[];
  openBlockers: number;
  overrides: AwardOverride[];
  award: AwardRow | null;
  categories: string[];
  suppliers: { code: string; name: string }[];
};

function row(data: AnalystData, spec: AwardSpec, kind: AwardSpec["scenario"], overrides: AwardOverride[]): ScenarioRow & { result: ScenarioResult } {
  const result = computeScenario(data, toScenarioSpec(spec, kind));
  const blockers = scenarioBlockers(data, result);
  const open = blockers.filter((b) => !overrides.some((o) => o.key === b.key)).length;
  const vsL1 = Math.round((result.nominal_l1_inr - result.total_inr) * 100) / 100;
  return {
    scenario: kind,
    label: SCENARIO_LABEL[kind],
    available: result.allocation.length > 0,
    suppliers: result.by_supplier.map((b) => b.supplier),
    linesAwarded: result.allocation.length,
    unallocated: result.unallocated.length,
    total: result.total_inr,
    totalDisplay: result.total_display,
    savingsVsL1: vsL1,
    savingsVsL1Display: formatInrCompact(vsL1),
    savingsVsLastCycle: result.saving_vs_last_cycle_inr,
    savingsVsLastCycleDisplay: result.saving_vs_last_cycle_display,
    savingsVsLastCyclePct: result.saving_vs_last_cycle_pct,
    openBlockers: open,
    staleUsed: result.stale_suppliers_used,
    result,
  };
}

export async function loadAwardView(client: Db): Promise<AwardView & { data: AnalystData }> {
  const [data, { award, spec }] = await Promise.all([loadAnalystData(client), getAward(client)]);
  const overrides = award?.overrides ?? [];
  const kinds = SCENARIOS.filter((k) => k !== "custom" || (spec.assignments?.length || spec.default_supplier));
  const rows = kinds.map((k) => row(data, spec, k, overrides));
  const chosenRow = rows.find((r) => r.scenario === spec.scenario) ?? row(data, spec, spec.scenario, overrides);
  const blockers = scenarioBlockers(data, chosenRow.result).map((b) => ({ ...b, override: overrides.find((o) => o.key === b.key) ?? null }));
  return {
    data,
    spec,
    eligibility: describeEligibility(spec),
    rows: rows.map((r) => {
      const plainRow: Partial<typeof r> = { ...r };
      delete plainRow.result;
      return plainRow as ScenarioRow;
    }),
    chosen: chosenRow.result,
    blockers,
    openBlockers: blockers.filter((b) => !b.override).length,
    overrides: overrides.filter((o) => blockers.some((b) => b.key === o.key)),
    award,
    categories: [...new Set(data.lines.map((l) => l.category))],
    suppliers: data.suppliers.map((s) => ({ code: s.code, name: s.name })),
  };
}
