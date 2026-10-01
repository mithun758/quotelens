// Deterministic normalisation of one supplier response to INR, per piece, ex-GST.
// Pure: takes the model's extracted items and returns values, ledger steps and flags.
// Unknown freight is never added and conditional discounts are never applied here.
// Any value that depends on a code-derived conversion (pack size, bundle split,
// GST-inclusive back-calculation) is Inferred, with the conversion as its reason.
// FX is not: it applies a seeded rate to a stated price and is shown in the ledger.
import type { ExtractedItem, ExtractionSource } from "@/lib/ai/extraction/schema";
import type { ConfidenceState, FxRateRow, LineItemRow, NormalisationKind, Severity, SubstituteCheck } from "@/lib/db/types";
import { parseAmount, round2 } from "./amount";
import { rateOn } from "./fx";

export const EXPECTED_GST_PERCENT = 18;

export type SourcedItem = ExtractedItem & { documentId: string | null };

export type LedgerStep = {
  kind: NormalisationKind;
  input: number;
  output: number;
  rate: number | null;
  rate_source: string;
  rate_date: string | null;
};

export type ValueFlag = { type: string; severity: Severity; message: string };

export type NormalisedValue = {
  line_no: number | null;
  raw_value: string | null;
  raw_unit: string | null;
  raw_currency: string | null;
  normalised_value_inr: number | null;
  confidence_state: ConfidenceState;
  reason: string | null;
  documentId: string | null;
  source: ExtractionSource | null;
  match_reason: string | null;
  substitute_check: SubstituteCheck | null;
  steps: LedgerStep[];
  flags: ValueFlag[];
};

type Context = { lines: LineItemRow[]; fxRates: FxRateRow[]; asOfDate: string; supplierCode: string };

const BASIS_UNIT: Record<ExtractedItem["price_basis"], string> = {
  per_piece: "per piece",
  per_pack: "per pack",
  per_bundle: "per bundle",
  per_box: "per box",
  unclear: "unclear",
};

function joinReasons(...reasons: (string | null | undefined)[]): string | null {
  const parts = reasons.filter((r): r is string => !!r && !!r.trim());
  return parts.length ? parts.join(" ") : null;
}

function missing(line_no: number, reason: string, item?: SourcedItem): NormalisedValue {
  return {
    line_no,
    raw_value: item?.raw_price ?? null,
    raw_unit: null,
    raw_currency: null,
    normalised_value_inr: null,
    confidence_state: "missing",
    reason,
    documentId: item?.documentId ?? null,
    source: item?.source ?? null,
    match_reason: item?.match_reason ?? null,
    substitute_check: null,
    steps: [],
    flags: [],
  };
}

function substituteNote(item: SourcedItem): string | null {
  if (!item.is_substitute) return null;
  const deviates = item.substitute_check.filter((c) => c.result === "deviates").map((c) => c.attribute);
  return deviates.length
    ? `Substitute model deviates on ${deviates.join(", ")}; needs Arjun's sign-off.`
    : "Substitute model; needs Arjun's sign-off.";
}

// Price for one non-bundle item, before any bundle split.
function normaliseItem(item: SourcedItem, line: LineItemRow, ctx: Context): NormalisedValue {
  if (item.price_status === "declined") {
    return missing(line.line_no, `Supplier declined to quote: "${item.source.snippet}"`, item);
  }

  const base: Omit<NormalisedValue, "normalised_value_inr" | "confidence_state" | "reason" | "steps" | "flags"> = {
    line_no: line.line_no,
    raw_value: item.raw_price,
    raw_unit: BASIS_UNIT[item.price_basis] + (item.pack_size ? ` of ${item.pack_size}` : ""),
    raw_currency: item.currency,
    documentId: item.documentId,
    source: item.source,
    match_reason: item.match_reason,
    substitute_check: item.is_substitute ? item.substitute_check : null,
  };
  const flags: ValueFlag[] = [];
  const modelReason = item.confidence === "inferred" ? item.reason : null;
  let inferred = item.confidence === "inferred";
  const subNote = substituteNote(item);
  if (subNote) {
    inferred = true;
    flags.push({ type: "substitute_pending_signoff", severity: "medium", message: subNote });
  }

  if (item.price_status === "same_as_previous") {
    const lastCycle = line.last_cycle_price_inr;
    if (lastCycle === null) return missing(line.line_no, "Supplier refers to last year's rates, but no last-cycle price is on file.", item);
    return {
      ...base,
      raw_value: item.source.snippet,
      raw_unit: "per piece",
      raw_currency: "INR",
      normalised_value_inr: lastCycle,
      confidence_state: "inferred",
      reason: joinReasons("Supplier refers to last year's rates; shown at Meridian's last-cycle price.", subNote),
      steps: [],
      flags,
    };
  }

  const amount = parseAmount(item.raw_price);
  if (amount === null) return missing(line.line_no, `Price could not be read from "${item.raw_price ?? ""}".`, item);

  const steps: LedgerStep[] = [];
  let value = amount;
  const reasons: string[] = [];

  const currency = (item.currency ?? "INR").toUpperCase();
  if (currency !== "INR") {
    const rate = rateOn(ctx.fxRates.filter((r) => r.base_currency === currency && r.quote_currency === "INR"), ctx.asOfDate);
    if (!rate) {
      return { ...base, normalised_value_inr: null, confidence_state: "inferred", reason: `No ${currency}/INR rate on file.`, steps, flags };
    }
    const out = round2(value * rate.rate);
    steps.push({ kind: "fx", input: value, output: out, rate: rate.rate, rate_source: `${rate.source} (${currency}/INR)`, rate_date: rate.rate_date });
    value = out;
  }

  if (item.price_basis === "per_pack") {
    const out = round2(value / item.pack_size!);
    steps.push({ kind: "pack_size", input: value, output: out, rate: item.pack_size, rate_source: `Price per pack of ${item.pack_size}`, rate_date: null });
    reasons.push(`Quoted per pack of ${item.pack_size}; per-piece price derived by dividing the pack price by ${item.pack_size}.`);
    value = out;
  } else if (item.price_basis === "unclear" || (item.price_basis === "per_box" && line.uom !== "box")) {
    flags.push({ type: "unit_basis_unclear", severity: "medium", message: "The quoted unit basis is unclear. Ask the supplier before using this price." });
    return {
      ...base,
      normalised_value_inr: null,
      confidence_state: "inferred",
      reason: joinReasons("Unit basis unclear; not converted.", modelReason),
      steps,
      flags,
    };
  }

  if (item.gst === "included") {
    const ratePct = item.gst_rate_percent ?? EXPECTED_GST_PERCENT;
    if (item.gst_rate_percent === null) {
      inferred = true;
      reasons.push(`Price includes GST at an unstated rate; ${EXPECTED_GST_PERCENT}% assumed.`);
    }
    const factor = 1 + ratePct / 100;
    const out = round2(value / factor);
    steps.push({ kind: "gst", input: value, output: out, rate: factor, rate_source: `GST-inclusive at ${ratePct}%; GST removed`, rate_date: null });
    reasons.push(`Quoted GST-inclusive; ex-GST price back-calculated at ${ratePct}%.`);
    value = out;
  }

  if (item.gst_rate_percent !== null && item.gst_rate_percent !== EXPECTED_GST_PERCENT) {
    flags.push({
      type: "gst_rate_mismatch",
      severity: "medium",
      message: `GST printed at ${item.gst_rate_percent}% where ${EXPECTED_GST_PERCENT}% is expected. The comparison is ex-GST, so the price is unaffected.`,
    });
  }

  return {
    ...base,
    normalised_value_inr: round2(value),
    confidence_state: inferred || reasons.length ? "inferred" : "extracted",
    reason: joinReasons(modelReason, ...reasons, subNote),
    steps,
    flags,
  };
}

// When the model reports more than one item for a line, a standalone stated price wins,
// then a bundle, then a "same as last year" reference, then a decline. Order-independent,
// so a bundle reported from both sides never displaces the standalone price it needs.
function itemRank(item: SourcedItem): number {
  if (item.price_status === "stated") return item.price_basis === "per_bundle" ? 1 : 0;
  return item.price_status === "same_as_previous" ? 2 : 3;
}

export type NormalisedResponse = { values: NormalisedValue[]; unmatched: SourcedItem[]; coverage: number };

export function normaliseResponse(items: SourcedItem[], ctx: Context): NormalisedResponse {
  const byLine = new Map<number, SourcedItem>();
  const unmatched: SourcedItem[] = [];
  const lineNos = new Set(ctx.lines.map((l) => l.line_no));

  for (const item of items) {
    if (item.rfx_line_no === null || !lineNos.has(item.rfx_line_no)) {
      unmatched.push(item);
      continue;
    }
    const existing = byLine.get(item.rfx_line_no);
    if (!existing || itemRank(item) < itemRank(existing)) byLine.set(item.rfx_line_no, item);
  }

  // Pass 1: everything except bundles.
  const results = new Map<number, NormalisedValue>();
  for (const line of ctx.lines) {
    const item = byLine.get(line.line_no);
    if (!item) {
      results.set(line.line_no, missing(line.line_no, "Not quoted."));
    } else if (item.price_basis !== "per_bundle") {
      results.set(line.line_no, normaliseItem(item, line, ctx));
    }
  }

  // Pass 2: bundles, split using the supplier's own standalone prices for the other lines.
  for (const line of ctx.lines) {
    const item = byLine.get(line.line_no);
    if (!item || item.price_basis !== "per_bundle") continue;
    const bundle = normaliseItem({ ...item, price_basis: "per_piece" }, line, ctx);
    if (bundle.normalised_value_inr === null) {
      results.set(line.line_no, bundle);
      continue;
    }
    const components = item.bundle_rfx_lines.filter((n) => n !== line.line_no);
    const componentValues = components.map((n) => ({ n, v: results.get(n)?.normalised_value_inr ?? null }));
    const unknown = componentValues.filter((c) => c.v === null).map((c) => c.n);
    if (!components.length || unknown.length) {
      results.set(line.line_no, {
        ...bundle,
        raw_unit: "per bundle",
        normalised_value_inr: null,
        confidence_state: "inferred",
        reason: `Quoted only as a bundle${unknown.length ? ` with line ${unknown.join(", ")}, which has no standalone price` : ""}; cannot split.`,
        flags: [...bundle.flags, { type: "bundle_unsplit", severity: "medium", message: "Bundle price could not be split. Ask the supplier for a line price." }],
      });
      continue;
    }
    let value = bundle.normalised_value_inr;
    const steps = [...bundle.steps];
    for (const c of componentValues) {
      const out = round2(value - c.v!);
      steps.push({
        kind: "bundle",
        input: value,
        output: out,
        rate: c.v,
        rate_source: `Bundle price minus ${ctx.supplierCode}'s standalone price for line ${c.n}`,
        rate_date: null,
      });
      value = out;
    }
    results.set(line.line_no, {
      ...bundle,
      raw_unit: `per bundle (with line ${components.join(", ")})`,
      normalised_value_inr: value,
      confidence_state: "inferred",
      reason: joinReasons(
        `Quoted only as a bundle with line ${components.join(", ")}, and the quote does not state how the bundle price splits. Line price derived as the bundle price minus ${ctx.supplierCode}'s standalone price for ${componentValues.map((c) => `line ${c.n} (₹${c.v!.toLocaleString("en-IN")})`).join(", ")}.`,
        bundle.reason,
      ),
      steps,
    });
  }

  const values = ctx.lines.map((l) => results.get(l.line_no)!);
  const coverage = values.filter((v) => v.confidence_state !== "missing").length;
  return { values, unmatched, coverage };
}
