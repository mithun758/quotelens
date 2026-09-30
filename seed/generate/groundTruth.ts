// Builds seed/ground_truth.json from the price design and checks the demo beats.
// Evaluation only: extraction and analyst code must never read the output.

import { LINE_ITEMS } from "../data";
import {
  AS_OF_DATE,
  A_NETWORKING_LINES,
  B_FOOTNOTE_DISCOUNT,
  B_WRONG_GST_LINES,
  C_SUBSTITUTES,
  D_HANDWRITTEN,
  D_PACK_LINE,
  D_PACK_SIZE,
  E_NOT_QUOTED,
  E_USD,
  GST_RATE,
  LAST_CYCLE,
  QUANTITY,
  SUPPLIER_FACTS,
  USD_INR_AS_OF,
  inr,
  truePrice,
  type SupplierCode,
} from "./prices";

type Step = { kind: "fx" | "uom" | "pack_size" | "gst" | "discount" | "freight"; input: number; output: number; rate: number; note: string };

export type GroundTruthLine = {
  line_no: number;
  quoted: boolean;
  raw_value: string | null;
  raw_unit: string | null;
  raw_currency: string | null;
  expected_confidence: "extracted" | "inferred" | "missing";
  expected_normalised_inr: number | null;
  normalisation: Step[];
  notes?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const LINES = LINE_ITEMS.map((l) => l.line_no);

function missing(line_no: number, notes: string): GroundTruthLine {
  return { line_no, quoted: false, raw_value: null, raw_unit: null, raw_currency: null, expected_confidence: "missing", expected_normalised_inr: null, normalisation: [], notes };
}

function plain(line_no: number, price: number, unit = "per piece", notes?: string): GroundTruthLine {
  return { line_no, quoted: true, raw_value: inr(price), raw_unit: unit, raw_currency: "INR", expected_confidence: "extracted", expected_normalised_inr: price, normalisation: [], ...(notes ? { notes } : {}) };
}

function supplierA(): GroundTruthLine[] {
  const laptop = truePrice("A", 1)!;
  const backpack = truePrice("A", 3)!;
  return LINES.map((n) => {
    const price = truePrice("A", n)!;
    if (n === 1) {
      return {
        line_no: 1, quoted: true, raw_value: inr(laptop + backpack), raw_unit: "per bundle (laptop + backpack), qty 60", raw_currency: "INR",
        expected_confidence: "inferred", expected_normalised_inr: laptop, normalisation: [],
        notes: `Quoted only as a laptop + backpack bundle at ${inr(laptop + backpack)}. Laptop price inferred as bundle minus A's standalone backpack price ${inr(backpack)}.`,
      };
    }
    if (n === 3) return plain(3, backpack, "per piece", "Standalone row for 10 additional backpacks; the other 60 are inside the line 1 bundle.");
    if (A_NETWORKING_LINES.includes(n)) {
      const inclusive = round2(price * (1 + GST_RATE));
      return {
        line_no: n, quoted: true, raw_value: inr(inclusive, 2), raw_unit: n === 25 ? "per box" : "per piece", raw_currency: "INR",
        expected_confidence: "extracted", expected_normalised_inr: price,
        normalisation: [{ kind: "gst", input: inclusive, output: price, rate: 1 + GST_RATE, note: "Networking sheet is GST-inclusive at 18%; divided out" }],
        notes: "Networking sheet header states prices include 18% GST, unlike A's other sheets.",
      };
    }
    return plain(n, price, n === 25 ? "per box" : "per piece");
  });
}

function supplierB(): GroundTruthLine[] {
  return LINES.map((n) => {
    const price = truePrice("B", n);
    if (price === null) return missing(n, n === 23 ? "No firewall quoted" : "No NAS quoted");
    const line = plain(n, price, n === 25 ? "per box" : "per piece");
    const discounted = round2(price * (1 - B_FOOTNOTE_DISCOUNT));
    line.notes = `Footnote: additional 4% off orders above ₹25 lakh; if the condition is met the price is ${inr(discounted, 2)}.`;
    if (B_WRONG_GST_LINES.includes(n)) line.notes += " GST printed at 28% where 18% is expected: flag, price unaffected ex-GST.";
    return line;
  });
}

function supplierC(): GroundTruthLine[] {
  return LINES.map((n) => {
    const price = truePrice("C", n)!;
    const line = plain(n, price, n === 25 ? "per box" : "per piece");
    const sub = C_SUBSTITUTES[n];
    if (sub) {
      line.expected_confidence = "inferred";
      line.notes = `Substitute: ${sub.offered}. Deviates on ${sub.attribute} (required ${sub.required}, offered ${sub.given}). Needs Arjun's sign-off.`;
    }
    return line;
  });
}

function supplierD(): GroundTruthLine[] {
  return LINES.map((n) => {
    const price = truePrice("D", n);
    if (price === null) return missing(n, "Not on D's rate card");
    if (n === D_PACK_LINE) {
      const pack = price * D_PACK_SIZE;
      return {
        line_no: n, quoted: true, raw_value: inr(pack), raw_unit: "per pkt (10 pcs)", raw_currency: "INR",
        expected_confidence: "inferred", expected_normalised_inr: price,
        normalisation: [{ kind: "pack_size", input: pack, output: price, rate: D_PACK_SIZE, note: "Priced per packet of 10" }],
        notes: "Rate card prices patch cords per packet; pack size appears only in the item text.",
      };
    }
    if (n === D_HANDWRITTEN.line) {
      return {
        ...plain(n, price), expected_confidence: "inferred",
        notes: `Printed ${inr(D_HANDWRITTEN.printed)} is struck through; handwritten correction ${inr(D_HANDWRITTEN.corrected)} is the true price.`,
      };
    }
    return plain(n, price, n === 25 ? "per box" : "per piece");
  });
}

function supplierE(): GroundTruthLine[] {
  return LINES.map((n) => {
    if (E_NOT_QUOTED.includes(n)) return missing(n, "E declines UPS lines 17 and 18 and firewall line 23");
    const usd = E_USD[n];
    if (usd !== undefined) {
      const out = round2(usd * USD_INR_AS_OF);
      return {
        line_no: n, quoted: true, raw_value: usd.toFixed(2), raw_unit: n === 25 ? "per box" : "per piece", raw_currency: "USD",
        expected_confidence: "extracted", expected_normalised_inr: out,
        normalisation: [{ kind: "fx", input: usd, output: out, rate: USD_INR_AS_OF, note: `Illustrative USD/INR on ${AS_OF_DATE}` }],
      };
    }
    return {
      line_no: n, quoted: true, raw_value: "same as last year's rates", raw_unit: null, raw_currency: null,
      expected_confidence: "inferred", expected_normalised_inr: LAST_CYCLE[n], normalisation: [],
      notes: "Prior-pricing reference: shown as Meridian's last-cycle price, Inferred.",
    };
  });
}

const EXPECTED = {
  A: {
    name: "Prakash Distributors", format: "xlsx", coverage: 30, freshness: "Fresh",
    flags: ["Lines 1 and 3 quoted as a bundle", "Networking sheet GST-inclusive"],
  },
  B: {
    name: "Vertex Systems", format: "pdf", coverage: 28, freshness: "Stale",
    flags: ["Validity vs approval (High): valid until 1 Oct, approval completes 10 Oct", "GST rate 28% on UPS lines 17 and 18 (18% expected)", "Conditional 4% discount above ₹25 lakh"],
  },
  C: {
    name: "Nexa Integrators", format: "docx", coverage: 30, freshness: "Fresh",
    flags: ["Substitute on line 1 (13th-gen i5)", "Substitute on line 22 (Wi-Fi 5) deviates", "Freight at actuals for Chennai and Hyderabad", "ISO 9001 certificate expired March 2026"],
  },
  D: {
    name: "Sri Ganesh Computers", format: "jpg", coverage: 20, freshness: "Stale",
    flags: ["Validity missing (Medium)", "Old price basis: rate card 4 Jun 2026, 118 days old (High)", "Market movement: memory index +11.2% since 4 Jun on lines 1, 5, 6, 28 (High)", "Patch cables per packet of 10", "Handwritten correction on line 10", "GST not stated"],
  },
  E: {
    name: "Lionbridge Tech Trading", format: "txt (email body)", coverage: 27, freshness: "Reconfirm",
    flags: ["Prior-pricing reference (Medium)", "FX movement: USD/INR +1.8% since 14 Sep (Medium)", "Freight extra", "India warranty not confirmed"],
  },
} as const;

export function buildGroundTruth() {
  const lines: Record<SupplierCode, GroundTruthLine[]> = {
    A: supplierA(), B: supplierB(), C: supplierC(), D: supplierD(), E: supplierE(),
  };
  const suppliers = Object.fromEntries(
    (Object.keys(lines) as SupplierCode[]).map((code) => {
      const { quote_ref, received_at, ...terms } = SUPPLIER_FACTS[code];
      return [code, { ...EXPECTED[code], quote_ref, received_at, terms, lines: lines[code] }];
    }),
  );
  const beats = checkBeats(lines);
  return {
    _readme: "Evaluation only. Expected extraction and normalisation for every supplier and line. Extraction, normalisation and analyst code must never read this file. Normalised values are INR per piece, ex-GST, before conditional discounts; unknown freight is not added.",
    as_of_date: AS_OF_DATE,
    fx: { pair: "USD/INR", rate: USD_INR_AS_OF, date: AS_OF_DATE, note: "Illustrative; USD lines normalise at the as-of rate" },
    suppliers,
    demo_beats: beats,
  };
}

// ---------------------------------------------------------------------------
// Demo beats: computed from the numbers, never asserted by hand.
// ---------------------------------------------------------------------------

function checkBeats(lines: Record<SupplierCode, GroundTruthLine[]>) {
  const codes = Object.keys(lines) as SupplierCode[];
  const value = (c: SupplierCode, n: number) => lines[c][n - 1].expected_normalised_inr;
  const failures: string[] = [];

  for (const c of codes) {
    for (const l of lines[c]) {
      if (l.expected_normalised_inr === null) continue;
      const pct = (l.expected_normalised_inr / LAST_CYCLE[l.line_no] - 1) * 100;
      if (pct < -8.5 || pct > 12) failures.push(`${c} line ${l.line_no} is ${pct.toFixed(1)}% vs last cycle`);
    }
  }

  const l1: Record<number, SupplierCode> = {};
  for (const n of LINES) {
    const offers = codes.filter((c) => value(c, n) !== null).map((c) => ({ c, v: value(c, n)! })).sort((a, b) => a.v - b.v);
    if (offers.length > 1 && offers[0].v === offers[1].v) failures.push(`tie for L1 on line ${n}`);
    l1[n] = offers[0].c;
  }
  const dL1 = LINES.filter((n) => l1[n] === "D");
  if (dL1.length < 7 || dL1.length > 11) failures.push(`D is L1 on ${dL1.length} lines, want about 9`);

  const commonBasket = LINES.filter((n) => codes.every((c) => value(c, n) !== null));
  const basketTotals = Object.fromEntries(
    codes.map((c) => [c, round2(commonBasket.reduce((s, n) => s + value(c, n)! * QUANTITY[n], 0))]),
  ) as Record<SupplierCode, number>;
  const cheapest = codes.reduce((a, b) => (basketTotals[a] <= basketTotals[b] ? a : b));
  if (cheapest !== "B") failures.push(`cheapest on the common basket is ${cheapest}, want B`);

  if (l1[1] !== "E" || l1[2] !== "E") failures.push("E is not L1 on both laptop lines");

  const rising = LINES.filter((n) => codes.some((c) => (value(c, n) ?? 0) > LAST_CYCLE[n]));
  if (rising.length < 4) failures.push(`only ${rising.length} lines rise against last cycle`);

  if (failures.length) throw new Error(`Demo beats not met:\n- ${failures.join("\n- ")}`);

  return {
    l1_by_line: l1,
    d_nominal_l1_lines: dL1,
    common_basket_lines: commonBasket,
    common_basket_totals_inr: basketTotals,
    cheapest_on_common_basket: cheapest,
    e_l1_laptop_lines: [1, 2],
    lines_with_a_price_rise: rising,
  };
}
