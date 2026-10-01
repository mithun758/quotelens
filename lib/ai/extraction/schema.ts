// The fixed schema every extraction call returns. The model reads and maps; it never
// converts or computes. Raw prices come back verbatim and code parses them.
//
// Structured outputs allow at most 16 nullable or union parameters, so the wire schema
// uses "" and 0 for "none" and fromWire() turns them into proper nulls for the app.
import { z } from "zod";

export const QUESTION_KEYS = [
  "iso_9001",
  "oem_authorisation",
  "india_warranty_onsite",
  "delivery_21_days",
  "gst_registration",
  "ewaste_takeback",
  "escalation_contact",
  "healthcare_references",
] as const;

const NONE = 'Use "" when not applicable.';
const ZERO = "Use 0 when not applicable.";


const WireSource = z.object({
  ref: z.string().describe('Where the value is: "Sheet!D7" for spreadsheets, "P12" for Word paragraphs, "L5" for text lines, "page 2" for PDFs and images'),
  bbox: z.array(z.number()).describe("For PDFs and images: [x0, y0, x1, y1] as fractions 0-1 of the page around the value; otherwise []"),
  snippet: z.string().describe(`Verbatim text copied from the document that contains the value. ${NONE}`),
});

export const TERM_FIELDS = [
  "quote_ref",
  "quote_date",
  "valid_until",
  "validity_days",
  "gst_treatment",
  "freight_terms",
  "warranty",
  "payment_terms",
  "delivery_days",
  "prior_pricing_reference",
] as const;
export type TermField = (typeof TERM_FIELDS)[number];

const WireItem = z.object({
  rfx_line_no: z.number().int().describe("The RFx line this quoted item maps to; 0 if it maps to none"),
  match_reason: z.string().describe("One line: why this item maps to that RFx line"),
  quoted_description: z.string(),
  price_status: z
    .enum(["stated", "same_as_previous", "declined"])
    .describe("stated: a price is given; same_as_previous: supplier refers to previous or last year's rates; declined: supplier says it will not quote"),
  raw_price: z.string().describe(`The unit price exactly as printed or written, including currency marks and separators. ${NONE}`),
  currency: z.string().describe(`ISO code of the price currency, e.g. INR or USD. ${NONE}`),
  price_basis: z.enum(["per_piece", "per_pack", "per_bundle", "per_box", "unclear"]).describe("What one quoted price buys"),
  pack_size: z.number().int().describe(`Pieces per pack when price_basis is per_pack. ${ZERO}`),
  bundle_rfx_lines: z.array(z.number().int()).describe("For per_bundle: the other RFx lines included in the bundle price; otherwise empty"),
  gst: z.enum(["excluded", "included", "not_stated"]).describe("Whether this price includes GST, resolved from line, column header, sheet note or terms"),
  gst_rate_percent: z.number().describe(`GST rate printed for this line. ${ZERO}`),
  is_substitute: z.boolean().describe("True if the offered model differs from the RFx spec on any attribute"),
  substitute_check: z.array(
    z.object({ attribute: z.string(), required: z.string(), offered: z.string(), result: z.enum(["meets", "exceeds", "deviates"]) }),
  ),
  confidence: z.enum(["extracted", "inferred"]),
  reason: z.string().describe(`Required when inferred: one line saying what judgement was made. ${NONE}`),
  source: WireSource,
});

export const ExtractionWireSchema = z.object({
  document_kind: z.enum(["quotation", "iso_certificate", "oem_authorisation", "warranty_letter", "email", "other"]),
  items: z.array(WireItem),
  discounts: z.array(
    z.object({
      description: z.string(),
      percent: z.number().describe(ZERO),
      condition: z.string().describe(`The condition as written. ${NONE}`),
      threshold_amount: z.number().describe(`Order value threshold as a plain number in rupees. ${ZERO}`),
      applies_to_rfx_lines: z.array(z.number().int()).describe("Empty means the whole order"),
      source: WireSource,
    }),
  ),
  terms: z
    .array(z.object({ field: z.enum(TERM_FIELDS), value: z.string(), source: WireSource }))
    .describe(
      "Only terms the document states. quote_date and valid_until as YYYY-MM-DD (valid_until only for an explicit end date); validity_days and delivery_days as whole numbers; prior_pricing_reference is the phrase if the supplier refers to previous or last year's prices",
    ),
  freight_basis: z.enum(["included", "extra", "partly_extra", "not_stated"]),
  questionnaire: z.array(
    z.object({
      question_key: z.enum(QUESTION_KEYS),
      answered: z.boolean(),
      affirmative: z.boolean().describe("True if the answer meets the requirement as asked; false otherwise"),
      answer_text: z.string(),
      source: WireSource,
    }),
  ),
  certificate: z
    .object({
      standard: z.string().describe("e.g. ISO 9001:2015"),
      holder: z.string(),
      certificate_no: z.string().describe(NONE),
      valid_until: z.string().describe(`YYYY-MM-DD. ${NONE}`),
      source: WireSource,
    })
    .nullable(),
  authorisation: z
    .object({
      oem: z.string(),
      holder: z.string(),
      valid_until: z.string().describe(`YYYY-MM-DD. ${NONE}`),
      source: WireSource,
    })
    .nullable(),
});

type Wire = z.infer<typeof ExtractionWireSchema>;
type WireSourceT = z.infer<typeof WireSource>;

// ---------------------------------------------------------------------------
// Domain types used by the rest of the app: nulls instead of sentinels.
// ---------------------------------------------------------------------------

export type ExtractionSource = {
  locator: { page: number | null; sheet: string | null; cell: string | null; paragraph: number | null; line: number | null; bbox: number[] | null };
  snippet: string;
};

export type ExtractedItem = Omit<z.infer<typeof WireItem>, "rfx_line_no" | "raw_price" | "currency" | "pack_size" | "gst_rate_percent" | "reason" | "source"> & {
  rfx_line_no: number | null;
  raw_price: string | null;
  currency: string | null;
  pack_size: number | null;
  gst_rate_percent: number | null;
  reason: string | null;
  source: ExtractionSource;
};

type Term = { value: string | null; source: ExtractionSource | null };

export type Extraction = {
  document_kind: Wire["document_kind"];
  items: ExtractedItem[];
  discounts: { description: string; percent: number | null; condition: string | null; threshold_amount: number | null; applies_to_rfx_lines: number[]; source: ExtractionSource }[];
  terms: Record<TermField, Term> & { freight_basis: Wire["freight_basis"] };
  questionnaire: { question_key: QuestionKey; answered: boolean; affirmative: boolean; answer_text: string; source: ExtractionSource | null }[];
  certificate: { standard: string; holder: string; certificate_no: string | null; valid_until: string | null; source: ExtractionSource } | null;
  authorisation: { oem: string; holder: string; valid_until: string | null; source: ExtractionSource } | null;
};

export type QuestionKey = (typeof QUESTION_KEYS)[number];

const str = (s: string) => (s.trim() ? s.trim() : null);
const num = (n: number) => (n ? n : null);

// "Computing!D7" | "P12" | "L5" | "page 2" -> structured locator.
export function parseRef(ref: string): Omit<ExtractionSource["locator"], "bbox"> {
  const out = { page: null as number | null, sheet: null as string | null, cell: null as string | null, paragraph: null as number | null, line: null as number | null };
  const r = ref.trim();
  let m: RegExpMatchArray | null;
  if ((m = r.match(/^'?(.+?)'?!\$?([A-Z]{1,3})\$?(\d+)$/))) {
    out.sheet = m[1];
    out.cell = `${m[2]}${m[3]}`;
  } else if ((m = r.match(/^\[?P(\d+)\]?$/i))) out.paragraph = Number(m[1]);
  else if ((m = r.match(/^\[?L(\d+)\]?$/i))) out.line = Number(m[1]);
  else if ((m = r.match(/^(?:page|p\.?)\s*(\d+)/i))) out.page = Number(m[1]);
  return out;
}

function source(s: WireSourceT): ExtractionSource {
  return { locator: { ...parseRef(s.ref), bbox: s.bbox.length === 4 ? s.bbox : null }, snippet: s.snippet };
}

export function fromWire(w: Wire): Extraction {
  const terms = Object.fromEntries(TERM_FIELDS.map((f) => [f, { value: null, source: null } as Term])) as Record<TermField, Term>;
  for (const t of w.terms) {
    if (str(t.value) && !terms[t.field].value) terms[t.field] = { value: str(t.value), source: source(t.source) };
  }
  return {
    document_kind: w.document_kind,
    items: w.items.map((i) => ({
      ...i,
      rfx_line_no: num(i.rfx_line_no),
      raw_price: str(i.raw_price),
      currency: str(i.currency),
      pack_size: num(i.pack_size),
      gst_rate_percent: num(i.gst_rate_percent),
      reason: str(i.reason),
      source: source(i.source),
    })),
    discounts: w.discounts.map((d) => ({
      ...d,
      percent: num(d.percent),
      condition: str(d.condition),
      threshold_amount: num(d.threshold_amount),
      source: source(d.source),
    })),
    terms: { ...terms, freight_basis: w.freight_basis },
    questionnaire: w.questionnaire.map((q) => ({ ...q, source: str(q.source.snippet) ? source(q.source) : null })),
    certificate: w.certificate
      ? { ...w.certificate, certificate_no: str(w.certificate.certificate_no), valid_until: str(w.certificate.valid_until), source: source(w.certificate.source) }
      : null,
    authorisation: w.authorisation ? { ...w.authorisation, valid_until: str(w.authorisation.valid_until), source: source(w.authorisation.source) } : null,
  };
}

// Rules the JSON schema cannot express. A violation counts as a schema failure.
export function validateExtraction(e: Extraction): string[] {
  const problems: string[] = [];
  const blank = (s: string | null | undefined) => !s || !s.trim();
  e.items.forEach((item, i) => {
    if (blank(item.source.snippet)) problems.push(`items[${i}] has no source snippet`);
    if (item.confidence === "inferred" && blank(item.reason)) problems.push(`items[${i}] is inferred without a reason`);
    if (item.price_status === "stated" && blank(item.raw_price)) problems.push(`items[${i}] is stated without a raw price`);
    if (item.price_basis === "per_pack" && !item.pack_size) problems.push(`items[${i}] is per_pack without a pack size`);
  });
  e.discounts.forEach((d, i) => blank(d.source.snippet) && problems.push(`discounts[${i}] has no source snippet`));
  for (const [key, field] of Object.entries(e.terms)) {
    if (typeof field === "object" && field.value && blank(field.source?.snippet)) problems.push(`terms.${key} has a value but no snippet`);
  }
  if (e.certificate && blank(e.certificate.source.snippet)) problems.push("certificate has no snippet");
  if (e.authorisation && blank(e.authorisation.source.snippet)) problems.push("authorisation has no snippet");
  return problems;
}
