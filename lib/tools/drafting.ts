// Lens's RFx drafting tools. The read tools look up Meridian's history and standards;
// update_rfx_draft applies structured changes to the draft in memory, and the RFx
// screen's action saves the result. Code applies every change; the model never edits
// the draft directly, and a branded line needs Priya's stated reason.
import { z } from "zod";
import { BrandRequirement, DraftLine, DraftQuestion, DraftTerms, missingEssentials, removeLines, setHeader, setQuestionnaire, setTerms, upsertLines, withBrandRule } from "@/lib/rfx/draft";
import { defineTool } from "./define";

// The model sometimes sends an array as a JSON string; accept it rather than spend a round.
const lenientArray = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, z.array(item));

export const getPurchaseHistory = defineTool({
  name: "get_purchase_history",
  description: "Meridian's last IT hardware refresh only: each item with its vendor-neutral spec, quantity, unit and last-cycle price (INR per piece, ex-GST). Use it for IT hardware; there is no history for other categories.",
  input: z.object({ category: z.string().optional().describe("A category or item name to match loosely, e.g. laptop or networking") }),
  output: z.object({ note: z.string().optional(), items: z.array(z.record(z.string(), z.unknown())) }),
  async run({ client }, input) {
    const { data, error } = await client.from("line_item").select("line_no, description, category, spec, quantity, uom, last_cycle_price_inr, memory_exposed").order("line_no");
    if (error) throw new Error(error.message);
    const items = (data ?? []) as Record<string, unknown>[];
    if (!input.category) return { items };
    const words = input.category.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));
    const hits = items.filter((i) => words.some((w) => `${i.category} ${i.description}`.toLowerCase().includes(w)));
    return hits.length ? { items: hits } : { note: `Nothing in the history matches "${input.category}". Here is the full history; use it only if an item genuinely fits.`, items };
  },
});

export const getMeridianStandards = defineTool({
  name: "get_meridian_standards",
  description: "Meridian's standard supplier quality questionnaire and commercial terms from its IT hardware RFx template. Some questions are IT-specific (OEM authorisation, e-waste, onsite warranty); adapt them for other categories.",
  input: z.object({}),
  output: z.object({ questionnaire: z.unknown(), terms: z.unknown(), approval_days: z.number() }),
  async run({ client }) {
    const { data, error } = await client.from("rfx").select("questionnaire, terms, approval_days").single();
    if (error || !data) throw new Error(`load standards: ${error?.message}`);
    return data;
  },
});

export const getSuppliers = defineTool({
  name: "get_suppliers",
  description: "The onboarded suppliers the RFx will be sent to.",
  input: z.object({}),
  output: z.object({ suppliers: z.array(z.object({ code: z.string(), name: z.string(), state: z.string().nullable(), is_incumbent: z.boolean() })) }),
  async run({ client }) {
    const { data, error } = await client.from("supplier").select("code, name, state, is_incumbent").order("code");
    if (error) throw new Error(error.message);
    return { suppliers: data ?? [] };
  },
});

export const updateRfxDraft = defineTool({
  name: "update_rfx_draft",
  description:
    "Writes structured changes to the RFx draft, applied in this order: header, remove_lines, upsert_lines, terms, questionnaire. Omit any part you are not changing. Lines are vendor-neutral, measurable attribute/value pairs; a line_no that exists is replaced and a new one appends, then lines are renumbered 1..n. A line naming a brand or model is refused unless brand_requirement carries the reason Priya gave; the brand and her reason are then recorded in the spec.",
  input: z.object({
    header: z
      .object({
        title: z.string().optional(),
        category: z.string().optional(),
        need_by_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        approval_days: z.number().int().nonnegative().optional(),
        delivery_hubs: lenientArray(z.string()).optional(),
      })
      .optional(),
    remove_lines: lenientArray(z.number().int()).optional(),
    upsert_lines: lenientArray(DraftLine.extend({ brand_requirement: BrandRequirement.optional().describe("Only when Priya has said to keep a brand and why; use her reason, never your own") })).optional(),
    terms: DraftTerms.partial().optional(),
    questionnaire: lenientArray(DraftQuestion).optional().describe("Replaces the whole questionnaire; keys are snake_case and unique"),
  }),
  output: z.object({ changed: z.array(z.string()), line_count: z.number(), missing_essentials: z.array(z.string()) }),
  run({ draft }, input) {
    if (!draft) throw new Error("The RFx draft is only edited from the RFx screen.");
    let d = draft.current;
    const changed: string[] = [];
    if (input.header) {
      d = setHeader(d, input.header);
      changed.push("header");
    }
    if (input.remove_lines?.length) {
      d = removeLines(d, input.remove_lines);
      changed.push("removed lines");
    }
    if (input.upsert_lines?.length) {
      d = upsertLines(d, input.upsert_lines.map(({ brand_requirement, ...l }) => withBrandRule(l, brand_requirement)));
      changed.push("lines");
    }
    if (input.terms) {
      d = setTerms(d, input.terms);
      changed.push("terms");
    }
    if (input.questionnaire) {
      d = setQuestionnaire(d, input.questionnaire);
      changed.push("questionnaire");
    }
    draft.current = d;
    return { changed, line_count: d.lines.length, missing_essentials: missingEssentials(d) };
  },
});
