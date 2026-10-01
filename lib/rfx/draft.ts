// The RFx draft built with the co-pilot. Separate from the seeded RFx, which the rest
// of the app keeps using. Pure: schema, the update operations the co-pilot (and Priya's
// edits) apply, and the checks before sending.
import { z } from "zod";

export const SpecAttribute = z.object({ attribute: z.string().min(1), value: z.string().min(1) });

export const DraftLine = z.object({
  line_no: z.number().int().positive(),
  description: z.string().min(1),
  category: z.string().min(1),
  spec: z.array(SpecAttribute),
  quantity: z.number().positive(),
  uom: z.string().min(1),
  memory_exposed: z.boolean(),
});
export type DraftLine = z.infer<typeof DraftLine>;

export const DraftQuestion = z.object({ key: z.string().regex(/^[a-z0-9_]+$/), text: z.string().min(1), evidence_required: z.boolean() });

export const DraftTerms = z.object({
  validity_days_required: z.number().int().nonnegative(),
  gst_basis: z.string(),
  delivery_basis: z.string(),
  delivery_days: z.number().int().nonnegative(),
  warranty: z.string(),
  payment: z.string(),
  currency: z.string(),
});

export const RfxDraft = z.object({
  title: z.string(),
  category: z.string(),
  need_by_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  approval_days: z.number().int().nonnegative(),
  delivery_hubs: z.array(z.string()),
  lines: z.array(DraftLine),
  questionnaire: z.array(DraftQuestion),
  terms: DraftTerms,
});
export type RfxDraft = z.infer<typeof RfxDraft>;

export const EMPTY_DRAFT: RfxDraft = {
  title: "",
  category: "",
  need_by_date: "",
  approval_days: 10,
  delivery_hubs: [],
  lines: [],
  questionnaire: [],
  terms: { validity_days_required: 0, gst_basis: "", delivery_basis: "", delivery_days: 0, warranty: "", payment: "", currency: "INR" },
};

// Lines are always numbered 1..n in order.
const renumber = (lines: DraftLine[]) => lines.map((l, i) => ({ ...l, line_no: i + 1 }));

export function setHeader(d: RfxDraft, h: Partial<Pick<RfxDraft, "title" | "category" | "need_by_date" | "approval_days" | "delivery_hubs">>): RfxDraft {
  return RfxDraft.parse({ ...d, ...Object.fromEntries(Object.entries(h).filter(([, v]) => v !== undefined)) });
}

// Replace lines by line number, or append when the number is past the end.
export function upsertLines(d: RfxDraft, lines: DraftLine[]): RfxDraft {
  const next = [...d.lines];
  for (const l of [...lines].sort((a, b) => a.line_no - b.line_no)) {
    const i = next.findIndex((x) => x.line_no === l.line_no);
    if (i >= 0) next[i] = DraftLine.parse(l);
    else next.push(DraftLine.parse(l));
  }
  return { ...d, lines: renumber(next.sort((a, b) => a.line_no - b.line_no)) };
}

export function removeLines(d: RfxDraft, lineNos: number[]): RfxDraft {
  return { ...d, lines: renumber(d.lines.filter((l) => !lineNos.includes(l.line_no))) };
}

export function setTerms(d: RfxDraft, terms: Partial<RfxDraft["terms"]>): RfxDraft {
  return { ...d, terms: DraftTerms.parse({ ...d.terms, ...Object.fromEntries(Object.entries(terms).filter(([, v]) => v !== undefined)) }) };
}

export function setQuestionnaire(d: RfxDraft, questions: RfxDraft["questionnaire"]): RfxDraft {
  const keys = questions.map((q) => q.key);
  if (new Set(keys).size !== keys.length) throw new Error("Questionnaire keys must be unique");
  return { ...d, questionnaire: questions.map((q) => DraftQuestion.parse(q)) };
}

// What must be true before "Send to suppliers".
export function sendProblems(d: RfxDraft, asOfDate: string): string[] {
  const p: string[] = [];
  if (!d.title.trim()) p.push("Give the RFx a title.");
  if (!d.lines.length) p.push("Add at least one line.");
  d.lines.forEach((l) => {
    if (!l.spec.length) p.push(`Line ${l.line_no} has no specification.`);
  });
  if (!d.need_by_date) p.push("Set a need-by date.");
  else if (d.need_by_date <= asOfDate) p.push("The need-by date must be after the as-of date.");
  if (!d.delivery_hubs.length) p.push("Name at least one delivery hub.");
  if (!d.questionnaire.length) p.push("Add the quality questionnaire.");
  if (!d.terms.warranty.trim() || !d.terms.payment.trim() || !d.terms.gst_basis.trim()) p.push("Complete the terms: GST basis, warranty and payment.");
  if (!d.terms.validity_days_required) p.push("Set the quote validity you require.");
  return p;
}

// Vendor-neutral specs. A line may name a brand only when Priya has given a reason;
// the brand and her reason are then written into the spec, so they travel with the RFx.
// The list covers common brands across the categories Meridian buys; processor families
// ("Intel Core i5 or AMD Ryzen 5 equivalent") are performance tiers, not brand locks.
const BRANDS = [
  "Hewlett Packard", "HP", "Dell", "Lenovo", "ThinkPad", "Apple", "MacBook", "iMac", "Asus", "Acer", "Microsoft Surface", "Surface Pro", "EliteBook", "ProBook", "Latitude", "Inspiron",
  "Samsung", "LG", "BenQ", "ViewSonic", "Philips", "Cisco", "Meraki", "Aruba", "Ubiquiti", "TP-Link", "Netgear", "D-Link", "Juniper", "Fortinet", "Sophos",
  "Logitech", "Brother", "Canon", "Epson", "Xerox", "Zebra", "Honeywell", "APC", "Schneider", "Eaton", "Seagate", "Western Digital", "SanDisk", "Kingston",
  "Godrej", "Featherlite", "Herman Miller", "Steelcase", "Haworth", "Wipro", "Durian", "Nilkamal", "Smurfit", "WestRock", "Tetra Pak",
];
const BRAND_RE = new RegExp(`(?<![A-Za-z0-9])(${BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})(?![A-Za-z0-9])`, "i");
const BRAND_ATTRS = ["Brand required", "Reason for brand"];

export const BrandRequirement = z.object({ brand: z.string().min(1), reason: z.string().min(8) });
export type BrandRequirement = z.infer<typeof BrandRequirement>;

// The first brand named in a line's description or spec, ignoring the recorded brand attributes.
export function brandIn(line: Pick<DraftLine, "description" | "spec">): string | null {
  const text = [line.description, ...line.spec.filter((s) => !BRAND_ATTRS.includes(s.attribute)).flatMap((s) => [s.attribute, s.value])].join(" \n ");
  // "HP" as horsepower ("1.5 HP motor") is a unit, not a brand.
  const m = text.replace(/\d+(\.\d+)?\s*HP\b/gi, "").match(BRAND_RE);
  return m ? m[1] : null;
}

// Applies a brand requirement to a line, or refuses a branded line that has none.
export function withBrandRule(line: DraftLine, requirement?: BrandRequirement | null): DraftLine {
  const spec = line.spec.filter((s) => !BRAND_ATTRS.includes(s.attribute));
  if (requirement) {
    // The recorded pair replaces any loose "Brand" or "Make" attribute.
    const rest = spec.filter((s) => !/^(brand|make|manufacturer)$/i.test(s.attribute.trim()));
    return { ...line, spec: [...rest, { attribute: "Brand required", value: requirement.brand }, { attribute: "Reason for brand", value: requirement.reason }] };
  }
  const brand = brandIn(line);
  if (brand) {
    const kept = line.spec.find((s) => s.attribute === "Brand required");
    if (kept) return line;
    throw new Error(
      `Line "${line.description}" names ${brand}. Write a vendor-neutral spec with measurable attributes, or, if Priya has given a reason to keep the brand, pass brand_requirement with her reason.`,
    );
  }
  return { ...line, spec };
}

// The essentials an RFx needs before it can be drafted in full, from what the draft holds.
export const ESSENTIALS = ["quantity", "delivery locations", "need-by date", "warranty", "quote validity", "GST basis"] as const;
export function missingEssentials(d: RfxDraft): (typeof ESSENTIALS)[number][] {
  const out: (typeof ESSENTIALS)[number][] = [];
  if (!d.lines.length || d.lines.some((l) => !l.quantity)) out.push("quantity");
  if (!d.delivery_hubs.length) out.push("delivery locations");
  if (!d.need_by_date) out.push("need-by date");
  if (!d.terms.warranty.trim()) out.push("warranty");
  if (!d.terms.validity_days_required) out.push("quote validity");
  if (!d.terms.gst_basis.trim()) out.push("GST basis");
  return out;
}
