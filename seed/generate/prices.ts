// The price design for the five supplier responses. Seed tooling only: the
// generator renders these into supplier files and ground_truth.json. App code
// never imports this file; it only ever sees the rendered documents.
//
// Every true price is INR per piece, ex-GST, delivered, before any conditional
// discount. It is last-cycle price x (1 + pct/100), rounded as a supplier would.

import { LINE_ITEMS } from "../data";

export type SupplierCode = "A" | "B" | "C" | "D" | "E";

export const AS_OF_DATE = "2026-09-30";
export const USD_INR_AS_OF = 84.6; // illustrative rate on the as-of date, from seed/data.ts

export const LAST_CYCLE: Record<number, number> = Object.fromEntries(
  LINE_ITEMS.map((l) => [l.line_no, l.last_cycle_price_inr]),
);
export const QUANTITY: Record<number, number> = Object.fromEntries(
  LINE_ITEMS.map((l) => [l.line_no, l.quantity]),
);

// Percent change against last cycle. A missing key means the line is not quoted.
const PCT: Record<Exclude<SupplierCode, "E">, Record<number, number>> = {
  // Incumbent: comfortable, raises memory-heavy lines.
  A: { 1: 5, 2: 6, 3: 4, 4: 2, 5: 4, 6: 3, 7: 0, 8: 2, 9: 5, 10: 3, 11: 2, 12: 1, 13: -1, 14: 0, 15: -2, 16: 2, 17: -3, 18: -2, 19: 6, 20: 3, 21: 4, 22: 1, 23: -2, 24: 8, 25: 2, 26: 6, 27: 3, 28: 10, 29: -1, 30: 2 },
  // Dell partner: sharp on almost everything. No firewall (23), no NAS (29).
  B: { 1: -6, 2: -4, 3: -3, 4: -7, 5: -4, 6: -3, 7: -6, 8: -5, 9: -2, 10: -3, 11: -5, 12: -6, 13: -5, 14: -4, 15: -3, 16: -6, 17: -4, 18: -5, 19: -2, 20: -5, 21: -3, 22: -4, 24: -2, 25: -5, 26: -2, 27: -6, 28: -2, 30: -4 },
  // Integrator: cheap on print, power and networking; substitutes on lines 1 and 22.
  C: { 1: -7, 2: 2, 3: 0, 4: -3, 5: 1, 6: 2, 7: -2, 8: -3, 9: 4, 10: 1, 11: -1, 12: -3, 13: -6, 14: -7, 15: -6, 16: -2, 17: -6, 18: -7, 19: 3, 20: -6, 21: 2, 22: -8, 23: -5, 24: 5, 25: -3, 26: 3, 27: -2, 28: 5, 29: -4, 30: -6 },
  // Local shop, June rate card: cheap on desktops, SSDs and small items, 20 lines only.
  D: { 1: 8, 3: 5, 4: 6, 5: -7, 6: -6, 7: 3, 8: 4, 9: -6, 10: -7.3, 11: 6, 12: 8, 13: 5, 16: 7, 19: -7, 21: -7, 24: -6.7, 25: 6, 26: -7, 27: 8, 28: -8 },
};

// E quotes six lines in USD; every other line it covers is "same as last year's rates".
export const E_USD: Record<number, number> = { 1: 740, 2: 1160, 4: 162, 7: 111, 8: 243, 12: 51.5 };
export const E_NOT_QUOTED = [17, 18, 23];

// A quotes lines 1 and 3 as a laptop + backpack bundle for 60, plus 10 extra backpacks.
export const A_BUNDLE_QTY = 60;
export const A_EXTRA_BACKPACKS = 10;
// A's networking sheet is GST-inclusive at 18%.
export const A_NETWORKING_LINES = [20, 21, 22, 23, 24, 25, 30];
export const GST_RATE = 0.18;

// B prints 28% GST on the UPS lines where 18% is expected.
export const B_WRONG_GST_LINES = [17, 18];
export const B_WRONG_GST_RATE = 0.28;
export const B_FOOTNOTE_DISCOUNT = 0.04;
export const B_FOOTNOTE_THRESHOLD_INR = 25_00_000;

// D prices patch cables per pack of 10 and has one handwritten correction.
export const D_PACK_LINE = 24;
export const D_PACK_SIZE = 10;
export const D_HANDWRITTEN = { line: 10, printed: 2190, corrected: 2040 };

// C substitutes.
export const C_SUBSTITUTES: Record<number, { offered: string; attribute: string; required: string | number; given: string | number }> = {
  1: { offered: "HP ProBook 440 G10, Intel Core i5-1335U (13th Gen), 16 GB, 512 GB SSD, 14-inch", attribute: "cpu_generation_min", required: 14, given: 13 },
  22: { offered: "Aruba Instant On AP12 (Wi-Fi 5, 802.11ac Wave 2), ceiling mount", attribute: "wifi_standard", required: "Wi-Fi 6 (802.11ax)", given: "Wi-Fi 5 (802.11ac)" },
};

export function roundPrice(value: number): number {
  if (value >= 10_000) return Math.round(value / 50) * 50;
  if (value >= 1_000) return Math.round(value / 10) * 10;
  return Math.round(value);
}

// True INR per piece ex-GST for A to D, or null when not quoted.
export function truePrice(supplier: Exclude<SupplierCode, "E">, line: number): number | null {
  if (supplier === "D" && line === D_PACK_LINE) return 1120 / D_PACK_SIZE;
  if (supplier === "D" && line === D_HANDWRITTEN.line) return D_HANDWRITTEN.corrected;
  const pct = PCT[supplier][line];
  return pct === undefined ? null : roundPrice(LAST_CYCLE[line] * (1 + pct / 100));
}

export const inr = (n: number, decimals = 0) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ---------------------------------------------------------------------------
// Quote-level facts
// ---------------------------------------------------------------------------

export const SUPPLIER_FACTS = {
  A: {
    quote_ref: "PD/BLR/Q-2026-0412",
    quote_date: "2026-09-22",
    valid_until: "2026-10-22",
    received_at: "2026-09-22T11:40:00+05:30",
    gst_treatment: "Extra at applicable rates, except the Networking sheet, which is GST-inclusive at 18%",
    freight_terms: "Free delivery to Bengaluru, Chennai and Hyderabad hubs",
    warranty: "3 years OEM onsite warranty, serviced in Bengaluru, Chennai and Hyderabad",
    payment_terms: "45 days from invoice",
    delivery_days: 14,
  },
  B: {
    quote_ref: "VS/Q/2026/0917",
    quote_date: "2026-09-24",
    valid_until: "2026-10-01",
    received_at: "2026-09-24T16:05:00+05:30",
    gst_treatment: "Extra, at the rate shown per line",
    freight_terms: "Delivered to all three hubs, freight included",
    warranty: "3 years Dell ProSupport onsite, India (see warranty letter)",
    payment_terms: "30 days from invoice",
    delivery_days: 10,
  },
  C: {
    quote_ref: "NXI/MER/2609",
    quote_date: "2026-09-26",
    valid_until: "2026-10-11",
    received_at: "2026-09-26T10:20:00+05:30",
    gst_treatment: "Extra at 18%",
    freight_terms: "Included for Bengaluru; at actuals for Chennai and Hyderabad",
    warranty: "3 years onsite warranty across all three cities",
    payment_terms: "45 days from invoice",
    delivery_days: 21,
  },
  D: {
    quote_ref: null,
    quote_date: "2026-06-04",
    valid_until: null,
    received_at: "2026-09-18T13:15:00+05:30",
    gst_treatment: null,
    freight_terms: null,
    warranty: "As per OEM",
    payment_terms: null,
    delivery_days: null,
  },
  E: {
    quote_ref: null,
    quote_date: "2026-09-14",
    valid_until: "2026-10-14",
    received_at: "2026-09-14T09:30:00+05:30",
    gst_treatment: "Exclusive of GST",
    freight_terms: "Freight extra",
    warranty: null,
    payment_terms: null,
    delivery_days: null,
  },
} as const;
