// Builds seed/ground_truth.json from the price design and checks the demo beats.
// Evaluation only: extraction and analyst code must never read the output.

import { LINE_ITEMS, QUESTIONNAIRE, RFX } from "../data";
import {
  AS_OF_DATE,
  A_NETWORKING_LINES,
  B_FOOTNOTE_DISCOUNT,
  B_WRONG_GST_LINES,
  C_SUBSTITUTES,
  D_HANDWRITTEN,
  D_PACK_LINE,
  D_PACK_SIZE,
  D_RECONFIRMATION,
  E_NOT_QUOTED,
  E_USD,
  GST_RATE,
  LAST_CYCLE,
  QUANTITY,
  SUPPLIER_FACTS,
  USD_INR_AS_OF,
  inr,
  reconfirmedPrice,
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
        notes: `Quoted only as a laptop + backpack bundle at ${inr(laptop + backpack)}. The sheet does not state the backpack's value inside the bundle, so the laptop price is inferred as bundle minus A's standalone backpack price ${inr(backpack)} (Peripherals & Storage sheet).`,
      };
    }
    if (n === 3) return plain(3, backpack, "per piece", "Standalone row for 10 additional backpacks; the other 60 are inside the line 1 bundle.");
    if (A_NETWORKING_LINES.includes(n)) {
      const inclusive = round2(price * (1 + GST_RATE));
      return {
        line_no: n, quoted: true, raw_value: inr(inclusive, 2), raw_unit: n === 25 ? "per box" : "per piece", raw_currency: "INR",
        expected_confidence: "inferred", expected_normalised_inr: price,
        normalisation: [{ kind: "gst", input: inclusive, output: price, rate: 1 + GST_RATE, note: "Networking sheet is GST-inclusive at 18%; divided out" }],
        notes: "Networking sheet header states prices include 18% GST, unlike A's other sheets. Inferred because the ex-GST price is back-calculated by code.",
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
    flags: ["Prior-pricing reference (Medium)", "FX movement: USD/INR +1.8% since 14 Sep (Medium)", "Freight extra", "India warranty not confirmed until clarification", "Questionnaire unanswered until clarification"],
  },
} as const;

// ---------------------------------------------------------------------------
// Questionnaire: expected pass or fail per question, from each supplier's documents.
// E fails before its clarification reply and passes after it is re-extracted.
// ---------------------------------------------------------------------------

type QResult = { result: "pass" | "fail"; evidence: string };
type QKey = (typeof QUESTIONNAIRE)[number]["key"];
type QAnswers = Record<QKey, QResult>;

const pass = (evidence: string): QResult => ({ result: "pass", evidence });
const fail = (evidence: string): QResult => ({ result: "fail", evidence });
const notAnswered = fail("Not answered");

function allNotAnswered(overrides: Partial<QAnswers> = {}): QAnswers {
  return Object.fromEntries(QUESTIONNAIRE.map((q) => [q.key, overrides[q.key] ?? notAnswered])) as QAnswers;
}

export const QUESTIONNAIRE_EXPECTED: Record<"A" | "B" | "C" | "D" | "E_before_clarification" | "E_after_clarification", QAnswers> = {
  A: {
    iso_9001: pass("ISO certificate attached, valid until 9 May 2027"),
    oem_authorisation: pass("Lenovo authorisation letter attached"),
    india_warranty_onsite: pass("3 years OEM onsite, Bengaluru, Chennai and Hyderabad"),
    delivery_21_days: pass("14 days"),
    gst_registration: pass("GSTIN 29AAKCP4821M1ZV"),
    ewaste_takeback: pass("Through authorised recycler"),
    escalation_contact: pass("Ramesh Prakash, Director"),
    healthcare_references: pass("Two references given"),
  },
  B: {
    iso_9001: pass("ISO certificate attached, valid until 19 Nov 2026"),
    oem_authorisation: pass("Dell authorisation letter attached"),
    india_warranty_onsite: pass("Warranty letter: ProSupport onsite in all three cities"),
    delivery_21_days: pass("10 days"),
    gst_registration: pass("GSTIN 29AADCV7390R1Z8"),
    ewaste_takeback: pass("Dell Asset Recovery"),
    escalation_contact: pass("Kavitha Rao, Sales Director"),
    healthcare_references: pass("Two references given"),
  },
  C: {
    iso_9001: fail("Attached ISO certificate expired on 14 Mar 2026"),
    oem_authorisation: fail("Claims HP and Aruba partnership but attaches no authorisation letter"),
    india_warranty_onsite: pass("3 years onsite across all three cities"),
    delivery_21_days: pass("21 days"),
    gst_registration: pass("GSTIN 29AAFCN5563K1ZX"),
    ewaste_takeback: pass("Through a registered recycler"),
    escalation_contact: pass("Deepak Iyer, Head of Sales"),
    healthcare_references: pass("Two references given"),
  },
  D: allNotAnswered({ india_warranty_onsite: fail("Rate card says 'As per OEM' only") }),
  E_before_clarification: allNotAnswered({
    gst_registration: pass("GSTIN 33AAGCL8104H1ZP in email signature"),
    india_warranty_onsite: fail("No India warranty mentioned"),
  }),
  E_after_clarification: {
    iso_9001: pass("ISO certificate attached to clarification reply, valid until 11 Feb 2028"),
    oem_authorisation: pass("HP authorisation letter attached to clarification reply"),
    india_warranty_onsite: pass("Reply confirms 3 years onsite in Bengaluru, Chennai and Hyderabad"),
    delivery_21_days: pass("18 days"),
    gst_registration: pass("GSTIN 33AAGCL8104H1ZP"),
    ewaste_takeback: pass("Authorised recycler in Chennai"),
    escalation_contact: pass("Mei Ling Goh, Country Manager India"),
    healthcare_references: pass("Two references given"),
  },
};

const qualifies = (answers: QAnswers) => Object.values(answers).every((a) => a.result === "pass");

// Demo question 6: cheapest per line among qualified suppliers, excluding stale quotes.
function q6(lines: Record<SupplierCode, GroundTruthLine[]>, eKey: "E_before_clarification" | "E_after_clarification") {
  const qualified: Record<SupplierCode, boolean> = {
    A: qualifies(QUESTIONNAIRE_EXPECTED.A),
    B: qualifies(QUESTIONNAIRE_EXPECTED.B),
    C: qualifies(QUESTIONNAIRE_EXPECTED.C),
    D: qualifies(QUESTIONNAIRE_EXPECTED.D),
    E: qualifies(QUESTIONNAIRE_EXPECTED[eKey]),
  };
  const eligible = (Object.keys(lines) as SupplierCode[]).filter((c) => qualified[c] && EXPECTED[c].freshness !== "Stale");
  const allocation: Record<number, { supplier: SupplierCode; unit_inr: number; total_inr: number }> = {};
  const unallocated: number[] = [];
  for (const n of LINES) {
    const offers = eligible
      .map((c) => ({ c, v: lines[c][n - 1].expected_normalised_inr }))
      .filter((o): o is { c: SupplierCode; v: number } => o.v !== null)
      .sort((a, b) => a.v - b.v);
    if (!offers.length) { unallocated.push(n); continue; }
    if (offers.length > 1 && offers[0].v === offers[1].v) throw new Error(`Q6 tie on line ${n}`);
    allocation[n] = { supplier: offers[0].c, unit_inr: offers[0].v, total_inr: round2(offers[0].v * QUANTITY[n]) };
  }
  const allocated = Object.keys(allocation).map(Number);
  const total = round2(allocated.reduce((s, n) => s + allocation[n].total_inr, 0));
  const lastCycle = allocated.reduce((s, n) => s + LAST_CYCLE[n] * QUANTITY[n], 0);
  const linesBySupplier: Record<string, number[]> = {};
  for (const n of allocated) (linesBySupplier[allocation[n].supplier] ??= []).push(n);
  return {
    eligible_suppliers: eligible,
    excluded: {
      not_qualified: (Object.keys(qualified) as SupplierCode[]).filter((c) => !qualified[c]),
      stale: (Object.keys(lines) as SupplierCode[]).filter((c) => EXPECTED[c].freshness === "Stale"),
    },
    allocation,
    unallocated_lines: unallocated,
    summary: {
      suppliers: Object.keys(linesBySupplier).sort(),
      lines_by_supplier: linesBySupplier,
      lines_on_prior_pricing: allocated.filter((n) => lines[allocation[n].supplier][n - 1].expected_confidence === "inferred" && lines[allocation[n].supplier][n - 1].raw_currency === null),
      total_inr: total,
      last_cycle_inr: lastCycle,
      saving_vs_last_cycle_inr: round2(lastCycle - total),
    },
  };
}

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
    questionnaire: QUESTIONNAIRE_EXPECTED,
    demo_beats: beats,
  };
}

// ---------------------------------------------------------------------------
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

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

  const q6Before = q6(lines, "E_before_clarification");
  const q6After = q6(lines, "E_after_clarification");
  if (q6Before.summary.suppliers.join() !== "A") failures.push(`Q6 before clarification awards to ${q6Before.summary.suppliers.join(", ")}, want A only`);
  if (q6After.summary.suppliers.join() !== "A,E") failures.push(`Q6 after clarification awards to ${q6After.summary.suppliers.join(", ")}, want A and E`);
  if (q6After.allocation[1]?.supplier !== "E" || q6After.allocation[2]?.supplier !== "E") failures.push("Q6 after clarification: E does not win both laptop lines");
  if (q6Before.unallocated_lines.length || q6After.unallocated_lines.length) failures.push("Q6 leaves lines unallocated");
  const eWins = q6After.summary.lines_by_supplier.E ?? [];
  const eOtherWins = eWins.filter((n) => n !== 1 && n !== 2);
  const eInferredWins = eWins.filter((n) => lines.E[n - 1].expected_confidence === "inferred");
  if (eOtherWins.length < 3 || eOtherWins.length > 5) failures.push(`Q6 after clarification: E wins ${eOtherWins.length} lines besides the laptops, want 3 to 5`);
  if (eInferredWins.length > 4) failures.push(`Q6 after clarification: ${eInferredWins.length} of E's winning lines rest on "same as last year" prices, want at most 4`);
  if (q6After.summary.saving_vs_last_cycle_inr <= 0) failures.push("Q6 after clarification: A plus E is not below last cycle");

  // Sri Ganesh's reconfirmation: D loses L1 on every line it reprices, and its new
  // validity covers approval, so its freshness improves.
  const revised = Object.keys(D_RECONFIRMATION.raise_pct).map(Number);
  const valueAfter = (c: SupplierCode, n: number) => (c === "D" && reconfirmedPrice(n) !== null ? reconfirmedPrice(n) : value(c, n));
  const l1After: Record<number, SupplierCode> = {};
  for (const n of revised) {
    const offers = codes.filter((c) => valueAfter(c, n) !== null).map((c) => ({ c, v: valueAfter(c, n)! })).sort((a, b) => a.v - b.v);
    l1After[n] = offers[0].c;
    const rise = (reconfirmedPrice(n)! / value("D", n)! - 1) * 100;
    if (rise < 8 || rise > 12.5) failures.push(`D's reconfirmed line ${n} rises ${rise.toFixed(1)}%, want 8 to 12%`);
    if (l1[n] !== "D") failures.push(`D is not L1 on line ${n} before reconfirmation`);
    if (l1After[n] === "D") failures.push(`D is still L1 on line ${n} after reconfirmation`);
  }
  const reconfirmValidUntil = addDaysIso(D_RECONFIRMATION.date, D_RECONFIRMATION.validity_days);
  const approvalCompletes = addDaysIso(AS_OF_DATE, RFX.approval_days);
  if (reconfirmValidUntil < approvalCompletes) failures.push("D's reconfirmed validity ends before approval completes");

  if (failures.length) throw new Error(`Demo beats not met:\n- ${failures.join("\n- ")}`);

  return {
    l1_by_line: l1,
    d_nominal_l1_lines: dL1,
    common_basket_lines: commonBasket,
    common_basket_totals_inr: basketTotals,
    cheapest_on_common_basket: cheapest,
    e_l1_laptop_lines: [1, 2],
    lines_with_a_price_rise: rising,
    q6: {
      question: "Split it: cheapest per line among qualified suppliers, excluding stale quotes. What's the total and the saving against last cycle?",
      before_clarification: q6Before,
      after_clarification: q6After,
    },
    d_reconfirmation: {
      trigger: "Priya sends Sri Ganesh a price reconfirmation request and the seeded reply arrives (SriGanesh_reconfirmation_reply_2026-09-30.txt).",
      before: {
        quote_date: "2026-06-04",
        valid_until: null,
        expected_freshness: "Stale",
        expected_fired_rules: ["validity_missing", "old_price_basis", "market_movement"],
        prices_inr: Object.fromEntries(revised.map((n) => [n, value("D", n)])),
        l1_by_line: Object.fromEntries(revised.map((n) => [n, l1[n]])),
      },
      after: {
        quote_date: D_RECONFIRMATION.date,
        valid_until: reconfirmValidUntil,
        expected_freshness: "Fresh",
        expected_fired_rules: [],
        prices_inr: Object.fromEntries(revised.map((n) => [n, reconfirmedPrice(n)])),
        revised_lines: revised,
        expected_confidence: "extracted",
        unchanged_lines: "Every other D line keeps its June price, now reconfirmed as of 30 Sep 2026",
        l1_by_line: l1After,
      },
    },
  };
}
