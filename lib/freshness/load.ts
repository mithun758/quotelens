// Assembles each supplier's freshness inputs from stored extraction and the seeded
// illustrative series, then evaluates the rules. Computed on demand from AS_OF_DATE.
import { asOfDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { PRIOR_PRICING_REASON } from "@/lib/normalise/normaliseResponse";
import { evaluateFreshness, type FreshnessResult, type SeriesPoint } from "./rules";

export const MEMORY_SERIES_KEY = "memory_price_index";

export async function loadFreshness(client: Db): Promise<Record<string, FreshnessResult>> {
  const [rfx, suppliers, responses, terms, values, lines, bench, fx] = await Promise.all([
    client.from("rfx").select("approval_days").single(),
    client.from("supplier").select("id, code"),
    client.from("response").select("id, supplier_id"),
    client.from("quote_terms").select("*"),
    client.from("extracted_value").select("response_id, line_item_id, raw_currency, confidence_state, normalised_value_inr, raw_value, reason").eq("field", "unit_price"),
    client.from("line_item").select("id, line_no, memory_exposed"),
    client.from("benchmark_series").select("observed_on, value").eq("series_key", MEMORY_SERIES_KEY).order("observed_on"),
    client.from("fx_rate").select("base_currency, quote_currency, rate_date, rate").eq("quote_currency", "INR").order("rate_date"),
  ]);
  for (const r of [rfx, suppliers, responses, terms, values, lines, bench, fx]) if (r.error) throw new Error(`freshness: ${r.error.message}`);

  const lineById = new Map((lines.data ?? []).map((l) => [l.id, l]));
  const memoryIndex: SeriesPoint[] = (bench.data ?? []).map((b) => ({ date: b.observed_on, value: Number(b.value) }));
  const fxRates: Record<string, SeriesPoint[]> = {};
  for (const r of fx.data ?? []) (fxRates[r.base_currency] ??= []).push({ date: r.rate_date, value: Number(r.rate) });

  const out: Record<string, FreshnessResult> = {};
  for (const s of suppliers.data ?? []) {
    const response = (responses.data ?? []).find((r) => r.supplier_id === s.id);
    if (!response) continue;
    const t = (terms.data ?? []).find((x) => x.response_id === response.id);
    if (!t) continue; // not extracted yet
    const priced = (values.data ?? []).filter((v) => v.response_id === response.id && v.normalised_value_inr !== null);
    const lineNo = (id: string | null) => (id ? lineById.get(id)?.line_no : undefined);
    const prior = priced.filter((v) => v.raw_currency === "INR" && v.confidence_state === "inferred" && (v.reason ?? "").startsWith(PRIOR_PRICING_REASON)).map((v) => lineNo(v.line_item_id)!);

    out[s.code] = evaluateFreshness({
      asOfDate: asOfDate(),
      approvalDays: rfx.data!.approval_days,
      quoteDate: t.quote_date,
      validUntil: t.valid_until,
      referencesPriorPricing: t.references_prior_pricing,
      priorPricingLines: prior.sort((a, b) => a - b),
      foreignCurrencies: [...new Set(priced.map((v) => (v.raw_currency ?? "INR").toUpperCase()).filter((c) => c !== "INR"))],
      fxRates,
      memoryExposedLines: priced.filter((v) => v.line_item_id && lineById.get(v.line_item_id)?.memory_exposed).map((v) => lineNo(v.line_item_id)!).sort((a, b) => a - b),
      memoryIndex,
    });
  }
  return out;
}
