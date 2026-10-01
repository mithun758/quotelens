// "Send to negotiation" (stubbed hand-off): the awarded lines where the chosen supplier
// is more than 5% above L1 or above last cycle, with a target price for each.
import type { ScenarioResult } from "@/lib/scenarios/compute";

export const NEGOTIATION_THRESHOLD_PCT = 5;

export type NegotiationLine = {
  line: number;
  item: string;
  supplier: string;
  unit_inr: number;
  quantity: number;
  l1_supplier: string | null;
  l1_unit_inr: number | null;
  above_l1_pct: number | null;
  last_cycle_unit_inr: number | null;
  above_last_cycle_pct: number | null;
  target_unit_inr: number;
  reason: string;
};

const pct = (v: number, base: number | null) => (base ? Math.round(((v - base) / base) * 10000) / 100 : null);

export function negotiationLines(scenario: ScenarioResult): NegotiationLine[] {
  return scenario.allocation.flatMap((a) => {
    const aboveL1 = a.nominal_l1_supplier && a.nominal_l1_supplier !== a.supplier ? pct(a.unit_inr, a.nominal_l1_unit_inr) : null;
    const aboveLast = pct(a.unit_inr, a.last_cycle_unit_inr);
    const reasons = [
      aboveL1 !== null && aboveL1 > NEGOTIATION_THRESHOLD_PCT ? `${aboveL1}% above L1 (${a.nominal_l1_supplier})` : null,
      aboveLast !== null && aboveLast > NEGOTIATION_THRESHOLD_PCT ? `${aboveLast}% above last cycle` : null,
    ].filter((r): r is string => !!r);
    if (!reasons.length) return [];
    const targets = [a.nominal_l1_unit_inr, a.last_cycle_unit_inr].filter((v): v is number => v !== null && v < a.unit_inr);
    return [
      {
        line: a.line,
        item: a.description,
        supplier: a.supplier,
        unit_inr: a.unit_inr,
        quantity: a.quantity,
        l1_supplier: a.nominal_l1_supplier,
        l1_unit_inr: a.nominal_l1_unit_inr,
        above_l1_pct: aboveL1,
        last_cycle_unit_inr: a.last_cycle_unit_inr,
        above_last_cycle_pct: aboveLast,
        target_unit_inr: targets.length ? Math.min(...targets) : a.unit_inr,
        reason: reasons.join("; "),
      },
    ];
  });
}
