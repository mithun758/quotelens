// Quote Freshness: can Priya still rely on this quote today? Six rules from the source
// of truth, rule-based and deterministic. Every rule reports why, with the numbers it
// used, and a recommended action. Freshness reports risk; it never adjusts a price.
import { addDays, daysBetween, isIsoDate } from "@/lib/normalise/dates";

export type FreshnessSeverity = "medium" | "high";
export type FreshnessStatus = "Fresh" | "Reconfirm" | "Stale";

export type RuleKey = "validity_vs_approval" | "validity_missing" | "old_price_basis" | "prior_pricing" | "market_movement" | "fx_movement";

export type RuleResult = {
  key: RuleKey;
  label: string;
  fired: boolean;
  severity: FreshnessSeverity | null;
  reason: string;
  action: string;
  lines: number[];
};

export type SeriesPoint = { date: string; value: number };

export type FreshnessInput = {
  asOfDate: string;
  approvalDays: number;
  quoteDate: string | null;
  validUntil: string | null;
  referencesPriorPricing: boolean;
  priorPricingLines: number[];
  // Currencies the supplier quoted in, other than INR.
  foreignCurrencies: string[];
  fxRates: Record<string, SeriesPoint[]>;
  // Memory-exposed lines this supplier priced.
  memoryExposedLines: number[];
  memoryIndex: SeriesPoint[];
};

export const THRESHOLDS = {
  oldBasisMediumDays: 30,
  oldBasisHighDays: 90,
  marketMediumPct: 5,
  marketHighPct: 10,
  fxMediumPct: 1.5,
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const d = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
};
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// The value on the date, or the latest earlier one.
export function valueOn(series: SeriesPoint[], date: string): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const p of series) if (p.date <= date && (!best || p.date > best.date)) best = p;
  return best;
}

function rule(key: RuleKey, label: string, action: string, r: Partial<RuleResult> & { reason: string }): RuleResult {
  return { key, label, action, fired: false, severity: null, lines: [], ...r };
}

export function validityVsApproval(i: FreshnessInput): RuleResult {
  const approvalDone = addDays(i.asOfDate, i.approvalDays);
  const label = "Validity vs approval";
  const action = "Reconfirm or extend validity before award";
  if (!isIsoDate(i.validUntil)) return rule("validity_vs_approval", label, action, { reason: "No validity date to check against the approval timeline." });
  const fired = i.validUntil < approvalDone;
  return rule("validity_vs_approval", label, action, {
    fired,
    severity: fired ? "high" : null,
    reason: fired
      ? `Valid until ${d(i.validUntil)}, but approval completes ${d(approvalDone)} (as of ${d(i.asOfDate)} plus ${i.approvalDays} days). The quote lapses ${daysBetween(i.validUntil, approvalDone)} days before approval.`
      : `Valid until ${d(i.validUntil)}, after approval completes ${d(approvalDone)}.`,
  });
}

export function validityMissing(i: FreshnessInput): RuleResult {
  const fired = !isIsoDate(i.validUntil);
  return rule("validity_missing", "Validity missing", "Ask supplier for validity", {
    fired,
    severity: fired ? "medium" : null,
    reason: fired ? "No validity is stated anywhere in the quote." : `Validity stated: until ${d(i.validUntil!)}.`,
  });
}

export function oldPriceBasis(i: FreshnessInput): RuleResult {
  const label = "Old price basis";
  const action = "Request a current quote";
  if (!isIsoDate(i.quoteDate)) return rule("old_price_basis", label, action, { reason: "The quote or price list is not dated." });
  const age = daysBetween(i.quoteDate, i.asOfDate);
  const severity: FreshnessSeverity | null = age > THRESHOLDS.oldBasisHighDays ? "high" : age > THRESHOLDS.oldBasisMediumDays ? "medium" : null;
  return rule("old_price_basis", label, action, {
    fired: severity !== null,
    severity,
    reason: severity
      ? `Price basis dated ${d(i.quoteDate)}, ${age} days before the as-of date ${d(i.asOfDate)} (Medium above ${THRESHOLDS.oldBasisMediumDays} days, High above ${THRESHOLDS.oldBasisHighDays}).`
      : `Dated ${d(i.quoteDate)}, ${age} days before the as-of date.`,
  });
}

export function priorPricing(i: FreshnessInput): RuleResult {
  const fired = i.referencesPriorPricing;
  return rule("prior_pricing", "Prior-pricing reference", "Treat these lines as Meridian's last-cycle price (Inferred); market prices have moved since", {
    fired,
    severity: fired ? "medium" : null,
    lines: fired ? i.priorPricingLines : [],
    reason: fired
      ? `Supplier said "same as last year" for ${i.priorPricingLines.length} line${i.priorPricingLines.length === 1 ? "" : "s"}; they are shown at Meridian's last-cycle price, which predates this year's price movements.`
      : "No reference to previous prices.",
  });
}

export function marketMovement(i: FreshnessInput): RuleResult {
  const label = "Market movement";
  const action = "Reconfirm pricing for the memory-exposed lines";
  if (!i.memoryExposedLines.length) return rule("market_movement", label, action, { reason: "No memory-exposed lines quoted." });
  if (!isIsoDate(i.quoteDate)) return rule("market_movement", label, action, { reason: "The quote is not dated, so movement since it cannot be measured." });
  const then = valueOn(i.memoryIndex, i.quoteDate);
  const now = valueOn(i.memoryIndex, i.asOfDate);
  if (!then || !now) return rule("market_movement", label, action, { reason: "No memory benchmark covers the quote date." });
  const move = ((now.value - then.value) / then.value) * 100;
  const severity: FreshnessSeverity | null = move > THRESHOLDS.marketHighPct ? "high" : move > THRESHOLDS.marketMediumPct ? "medium" : null;
  return rule("market_movement", label, action, {
    fired: severity !== null,
    severity,
    lines: severity ? i.memoryExposedLines : [],
    reason: `Illustrative memory index ${then.value} on ${d(then.date)} to ${now.value} on ${d(now.date)}: ${pct(move)} since the quote date (Medium above ${THRESHOLDS.marketMediumPct}%, High above ${THRESHOLDS.marketHighPct}%), affecting line${i.memoryExposedLines.length === 1 ? "" : "s"} ${i.memoryExposedLines.join(", ")}.`,
  });
}

export function fxMovement(i: FreshnessInput): RuleResult {
  const label = "FX movement";
  const action = "Reconfirm the rate or ask for an INR quote";
  if (!i.foreignCurrencies.length) return rule("fx_movement", label, action, { reason: "Quoted in INR." });
  if (!isIsoDate(i.quoteDate)) return rule("fx_movement", label, action, { reason: "The quote is not dated, so FX movement cannot be measured." });
  const moves = i.foreignCurrencies.map((ccy) => {
    const series = i.fxRates[ccy] ?? [];
    const then = valueOn(series, i.quoteDate!);
    const now = valueOn(series, i.asOfDate);
    return { ccy, then, now, move: then && now ? ((now.value - then.value) / then.value) * 100 : null };
  });
  const worst = moves.filter((m) => m.move !== null).sort((a, b) => Math.abs(b.move!) - Math.abs(a.move!))[0];
  if (!worst) return rule("fx_movement", label, action, { reason: `No illustrative rate on file for ${i.foreignCurrencies.join(", ")}.` });
  const fired = Math.abs(worst.move!) > THRESHOLDS.fxMediumPct;
  return rule("fx_movement", label, action, {
    fired,
    severity: fired ? "medium" : null,
    reason: `Illustrative ${worst.ccy}/INR ${worst.then!.value.toFixed(2)} on ${d(worst.then!.date)} to ${worst.now!.value.toFixed(2)} on ${d(worst.now!.date)}: ${pct(worst.move!)} since the quote date (Medium above ${THRESHOLDS.fxMediumPct}%).`,
  });
}

export type FreshnessResult = { status: FreshnessStatus; rules: RuleResult[]; fired: RuleResult[] };

export function evaluateFreshness(i: FreshnessInput): FreshnessResult {
  const rules = [validityVsApproval(i), validityMissing(i), oldPriceBasis(i), priorPricing(i), marketMovement(i), fxMovement(i)];
  const fired = rules.filter((r) => r.fired);
  const status: FreshnessStatus = fired.some((r) => r.severity === "high") ? "Stale" : fired.length ? "Reconfirm" : "Fresh";
  return { status, rules, fired };
}
