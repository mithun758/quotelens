import { describe, expect, it } from "vitest";
import type { FxRateRow, LineItemRow } from "@/lib/db/types";
import { parseAmount } from "@/lib/normalise/amount";
import { validUntil } from "@/lib/normalise/dates";
import { normaliseResponse, type SourcedItem } from "@/lib/normalise/normaliseResponse";

const line = (line_no: number, last: number, uom = "piece"): LineItemRow => ({
  id: `l${line_no}`, rfx_id: "r", line_no, description: `Line ${line_no}`, category: "x", spec: {}, quantity: 10, uom,
  acceptable_equivalents: null, last_cycle_price_inr: last, memory_exposed: false, created_at: "",
});

const LINES = [line(1, 68000), line(3, 1200), line(17, 16000), line(20, 65000), line(24, 120), line(25, 9500, "box")];
const FX: FxRateRow[] = [
  { id: "f1", base_currency: "USD", quote_currency: "INR", rate_date: "2026-09-14", rate: 83.1, source: "Illustrative rate", is_illustrative: true, created_at: "" },
  { id: "f2", base_currency: "USD", quote_currency: "INR", rate_date: "2026-09-30", rate: 84.6, source: "Illustrative rate", is_illustrative: true, created_at: "" },
];
const ctx = { lines: LINES, fxRates: FX, asOfDate: "2026-09-30", supplierCode: "X" };

function item(overrides: Partial<SourcedItem>): SourcedItem {
  return {
    rfx_line_no: 1, match_reason: "matches", quoted_description: "thing", price_status: "stated", raw_price: "100",
    currency: "INR", price_basis: "per_piece", pack_size: null, bundle_rfx_lines: [], gst: "excluded",
    gst_rate_percent: null, is_substitute: false, substitute_check: [], confidence: "extracted", reason: null,
    source: { locator: { page: 1, sheet: null, cell: null, paragraph: null, line: null, bbox: null }, snippet: "100" },
    documentId: "d1",
    ...overrides,
  };
}

const valueFor = (items: SourcedItem[], n: number) => normaliseResponse(items, ctx).values.find((v) => v.line_no === n)!;

describe("parseAmount", () => {
  it("reads prices as suppliers print them", () => {
    expect(parseAmount("₹72,650")).toBe(72650);
    expect(parseAmount("1,00,800.00")).toBe(100800);
    expect(parseAmount("Rs. 1,120/pkt")).toBe(1120);
    expect(parseAmount("USD 1160.00")).toBe(1160);
    expect(parseAmount("2,040/-")).toBe(2040);
    expect(parseAmount("same as last year")).toBeNull();
  });
});

describe("normaliseResponse ledger", () => {
  it("USD: converts at the as-of rate, logs an fx step and stays Extracted", () => {
    const v = valueFor([item({ raw_price: "USD 740.00", currency: "USD" })], 1);
    expect(v.normalised_value_inr).toBe(62604);
    expect(v.confidence_state).toBe("extracted");
    expect(v.steps).toEqual([expect.objectContaining({ kind: "fx", input: 740, output: 62604, rate: 84.6, rate_date: "2026-09-30" })]);
  });

  it("per pack: divides by pack size and logs a pack_size step", () => {
    const v = valueFor([item({ rfx_line_no: 24, raw_price: "1,120/pkt", price_basis: "per_pack", pack_size: 10 })], 24);
    expect(v.normalised_value_inr).toBe(112);
    expect(v.confidence_state).toBe("inferred");
    expect(v.reason).toMatch(/dividing the pack price by 10/);
    expect(v.steps).toEqual([expect.objectContaining({ kind: "pack_size", input: 1120, output: 112, rate: 10 })]);
  });

  it("GST-inclusive: removes 18% and logs a gst step", () => {
    const v = valueFor([item({ rfx_line_no: 20, raw_price: "79,001.00", gst: "included", gst_rate_percent: 18 })], 20);
    expect(v.normalised_value_inr).toBe(66950);
    expect(v.confidence_state).toBe("inferred");
    expect(v.reason).toMatch(/back-calculated at 18%/);
    expect(v.steps).toEqual([expect.objectContaining({ kind: "gst", input: 79001, output: 66950, rate: 1.18 })]);
  });

  it("GST rate mismatch: flags 28% but leaves the ex-GST price alone", () => {
    const v = valueFor([item({ rfx_line_no: 17, raw_price: "15,350.00", gst_rate_percent: 28 })], 17);
    expect(v.normalised_value_inr).toBe(15350);
    expect(v.steps).toEqual([]);
    expect(v.flags.map((f) => f.type)).toEqual(["gst_rate_mismatch"]);
  });

  it("footnote discount: a conditional discount is never applied in normalisation", () => {
    const v = valueFor([item({ raw_price: "63,900.00" })], 1);
    expect(v.normalised_value_inr).toBe(63900);
    expect(v.steps.some((s) => s.kind === "discount")).toBe(false);
  });

  it("bundle: subtracts the supplier's standalone price and marks the result Inferred", () => {
    const values = normaliseResponse(
      [
        item({ rfx_line_no: 1, raw_price: "72650", price_basis: "per_bundle", bundle_rfx_lines: [3] }),
        item({ rfx_line_no: 3, raw_price: "1250" }),
      ],
      ctx,
    ).values;
    const laptop = values.find((v) => v.line_no === 1)!;
    expect(laptop.normalised_value_inr).toBe(71400);
    expect(laptop.confidence_state).toBe("inferred");
    expect(laptop.reason).toMatch(/does not state how the bundle price splits.*line 3 \(₹1,250\)/);
    expect(laptop.steps).toEqual([expect.objectContaining({ kind: "bundle", input: 72650, output: 71400, rate: 1250 })]);
    expect(values.find((v) => v.line_no === 3)!.normalised_value_inr).toBe(1250);
  });

  it("bundle reported from both sides: the standalone price still wins, in any order", () => {
    const bundleOn1 = item({ rfx_line_no: 1, raw_price: "72580", price_basis: "per_bundle", bundle_rfx_lines: [3] });
    const bundleOn3 = item({ rfx_line_no: 3, raw_price: "72580", price_basis: "per_bundle", bundle_rfx_lines: [1] });
    const standalone3 = item({ rfx_line_no: 3, raw_price: "1180" });
    for (const order of [[bundleOn1, bundleOn3, standalone3], [standalone3, bundleOn3, bundleOn1], [bundleOn3, standalone3, bundleOn1]]) {
      const values = normaliseResponse(order, ctx).values;
      expect(values.find((v) => v.line_no === 1)!.normalised_value_inr).toBe(71400);
      expect(values.find((v) => v.line_no === 3)!.normalised_value_inr).toBe(1180);
    }
  });

  it("only a deviating substitute needs sign-off; a meets-or-exceeds equivalent counts as extracted", () => {
    const check = (result: "meets" | "exceeds" | "deviates") => [{ attribute: "fits_laptop_in", required: "14", offered: "15", result }];
    const equivalent = valueFor([item({ rfx_line_no: 3, is_substitute: true, substitute_check: check("exceeds") })], 3);
    expect(equivalent).toMatchObject({ needs_signoff: false, confidence_state: "extracted", flags: [] });
    expect(equivalent.substitute_check).not.toBeNull();
    const deviating = valueFor([item({ rfx_line_no: 3, is_substitute: true, substitute_check: check("deviates") })], 3);
    expect(deviating).toMatchObject({ needs_signoff: true, confidence_state: "inferred" });
    expect(deviating.flags.map((f) => f.type)).toEqual(["substitute_pending_signoff"]);
  });

  it("same as last year: Inferred at the last-cycle price", () => {
    const v = valueFor([item({ rfx_line_no: 3, price_status: "same_as_previous", raw_price: null, source: { locator: { page: null, sheet: null, cell: null, paragraph: null, line: 16, bbox: null }, snippet: "All other items same as last year's rates." } })], 3);
    expect(v.normalised_value_inr).toBe(1200);
    expect(v.confidence_state).toBe("inferred");
    expect(v.reason).toMatch(/^Supplier said same as last year/);
  });

  it("declined and unquoted lines are Missing with no value", () => {
    const result = normaliseResponse([item({ rfx_line_no: 17, price_status: "declined", raw_price: null })], ctx);
    for (const v of result.values) {
      expect(v.confidence_state).toBe("missing");
      expect(v.normalised_value_inr).toBeNull();
    }
    expect(result.coverage).toBe(0);
  });

  it("unclear unit basis is never guessed", () => {
    const v = valueFor([item({ rfx_line_no: 24, raw_price: "1120", price_basis: "unclear" })], 24);
    expect(v.normalised_value_inr).toBeNull();
    expect(v.confidence_state).toBe("inferred");
    expect(v.flags.map((f) => f.type)).toEqual(["unit_basis_unclear"]);
  });

  it("unmatched items are kept, not dropped", () => {
    const result = normaliseResponse([item({ rfx_line_no: null })], ctx);
    expect(result.unmatched).toHaveLength(1);
  });
});

describe("validUntil", () => {
  it("uses an explicit date, else quote date plus days", () => {
    expect(validUntil("2026-09-24", "2026-10-01", null)).toBe("2026-10-01");
    expect(validUntil("2026-09-22", null, 30)).toBe("2026-10-22");
    expect(validUntil("2026-09-14", null, 30)).toBe("2026-10-14");
    expect(validUntil(null, null, 30)).toBeNull();
  });
});

describe("parseRef", () => {
  it("turns model refs into structured locators", async () => {
    const { parseRef } = await import("@/lib/ai/extraction/schema");
    expect(parseRef("Computing!D7")).toMatchObject({ sheet: "Computing", cell: "D7" });
    expect(parseRef("'Print & Power'!E12")).toMatchObject({ sheet: "Print & Power", cell: "E12" });
    expect(parseRef("P12")).toMatchObject({ paragraph: 12 });
    expect(parseRef("[L5]")).toMatchObject({ line: 5 });
    expect(parseRef("page 2")).toMatchObject({ page: 2 });
  });
});

describe("revised prices", () => {
  it("a later-dated document's stated price wins, and the ledger keeps the earlier one", async () => {
    const { normaliseResponse } = await import("@/lib/normalise/normaliseResponse");
    const lines = [{ id: "l5", line_no: 5, quantity: 40, uom: "piece" }] as never;
    const item = (doc: string, raw: string) =>
      ({ rfx_line_no: 5, documentId: doc, price_status: "stated", price_basis: "per_piece", raw_price: raw, currency: "INR", pack_size: null, gst: "excluded", gst_rate_percent: null, is_substitute: false, substitute_check: null, confidence: "extracted", reason: null, bundle_rfx_lines: [], source: { snippet: raw } }) as never;
    const r = normaliseResponse([item("photo", "48,350"), item("reply", "52,700")], {
      lines,
      fxRates: [],
      asOfDate: "2026-09-30",
      supplierCode: "D",
      documentDates: { photo: "2026-06-04", reply: "2026-09-30" },
    });
    const v = r.values[0];
    expect(v.normalised_value_inr).toBe(52700);
    expect(v.confidence_state).toBe("extracted");
    const step = v.steps.at(-1)!;
    expect(step.kind).toBe("revision");
    expect([step.input, step.output]).toEqual([48350, 52700]);
    expect(step.rate_source).toMatch(/30 Sep 2026.*4 Jun 2026/);
  });
});
