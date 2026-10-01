// The RFx co-pilot: a Claude tool-use loop that asks focused follow-ups and writes
// structured updates to the draft through zod-validated tools. Code applies every
// update; the model never edits the draft directly.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { asOfDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { BrandRequirement, DraftLine, DraftQuestion, DraftTerms, missingEssentials, removeLines, setHeader, setQuestionnaire, setTerms, upsertLines, withBrandRule, type RfxDraft } from "@/lib/rfx/draft";
import type { ChatTurn } from "@/lib/rfx/store";
import { FALLBACK_BETA, anthropic, modelId } from "./client";
import { costUsd, type Usage } from "./pricing";

const MAX_ROUNDS = 8;

type Tool = { name: string; description: string; input: z.ZodType; run: (args: { client: Db; draft: RfxDraft; input: never }) => Promise<{ draft?: RfxDraft; result: unknown }> };

const TOOLS: Tool[] = [
  {
    name: "get_purchase_history",
    description: "Meridian's last IT hardware refresh only: each item with its vendor-neutral spec, quantity, unit and last-cycle price (INR per piece, ex-GST). Use it for IT hardware; there is no history for other categories.",
    input: z.object({ category: z.string().optional() }),
    async run({ client, input }) {
      const { category } = input as { category?: string };
      const { data, error } = await client.from("line_item").select("line_no, description, category, spec, quantity, uom, last_cycle_price_inr, memory_exposed").order("line_no");
      if (error) throw new Error(error.message);
      const items = data ?? [];
      if (!category) return { result: { items } };
      // Match the category or the item name loosely; a miss returns everything rather than nothing.
      const words = category.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));
      const hits = items.filter((i) => words.some((w) => `${i.category} ${i.description}`.toLowerCase().includes(w)));
      return hits.length
        ? { result: { items: hits } }
        : { result: { note: `Nothing in the history matches "${category}". Here is the full history; use it only if an item genuinely fits.`, items } };
    },
  },
  {
    name: "get_meridian_standards",
    description: "Meridian's standard supplier quality questionnaire and commercial terms from its IT hardware RFx template. Some questions are IT-specific (OEM authorisation, e-waste, onsite warranty); adapt them for other categories.",
    input: z.object({}),
    async run({ client }) {
      const { data } = await client.from("rfx").select("questionnaire, terms, approval_days").single();
      return { result: data };
    },
  },
  {
    name: "get_suppliers",
    description: "The onboarded suppliers the RFx will be sent to.",
    input: z.object({}),
    async run({ client }) {
      const { data } = await client.from("supplier").select("code, name, state, is_incumbent").order("code");
      return { result: { suppliers: data } };
    },
  },
  {
    name: "set_rfx_header",
    description: "Set the RFx title, category, need-by date (YYYY-MM-DD), approval days and delivery hubs. Omit fields you are not changing.",
    input: z.object({
      title: z.string().optional(),
      category: z.string().optional(),
      need_by_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      approval_days: z.number().int().nonnegative().optional(),
      delivery_hubs: z.array(z.string()).optional(),
    }),
    async run({ draft, input }) {
      const d = setHeader(draft, input);
      return { draft: d, result: { ok: true } };
    },
  },
  {
    name: "upsert_lines",
    description:
      "Add or replace RFx lines. A line_no that exists is replaced; a new number appends. Specs are vendor-neutral, measurable attribute/value pairs. A line that names a brand or model is refused unless brand_requirement carries the reason Priya gave for keeping it; the brand and reason are then recorded in the spec. Lines are renumbered 1..n.",
    input: z.object({
      // The model sometimes sends the array as a JSON string; accept it rather than spend a round.
      lines: z.preprocess(
        (v) => {
          if (typeof v !== "string") return v;
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        },
        z.array(DraftLine.extend({ brand_requirement: BrandRequirement.optional().describe("Only when Priya has said to keep a brand and why; use her reason, never your own") })),
      ),
    }),
    async run({ draft, input }) {
      const lines = (input as { lines: (z.infer<typeof DraftLine> & { brand_requirement?: BrandRequirement })[] }).lines.map(({ brand_requirement, ...l }) => withBrandRule(l, brand_requirement));
      const d = upsertLines(draft, lines);
      return { draft: d, result: { ok: true, line_count: d.lines.length, missing_essentials: missingEssentials(d) } };
    },
  },
  {
    name: "remove_lines",
    description: "Remove RFx lines by number. Remaining lines are renumbered.",
    input: z.object({ line_nos: z.array(z.number().int()) }),
    async run({ draft, input }) {
      const d = removeLines(draft, (input as { line_nos: number[] }).line_nos);
      return { draft: d, result: { ok: true, line_count: d.lines.length } };
    },
  },
  {
    name: "set_terms",
    description: "Set commercial terms: quote validity required (days), GST basis, delivery basis, delivery days, warranty, payment, currency. Omit fields you are not changing.",
    input: DraftTerms.partial(),
    async run({ draft, input }) {
      return { draft: setTerms(draft, input), result: { ok: true } };
    },
  },
  {
    name: "set_questionnaire",
    description: "Replace the supplier quality questionnaire. Keys are snake_case and unique.",
    input: z.object({ questions: z.array(DraftQuestion) }),
    async run({ draft, input }) {
      return { draft: setQuestionnaire(draft, (input as { questions: z.infer<typeof DraftQuestion>[] }).questions), result: { ok: true } };
    },
  },
];

const SYSTEM = `You are the RFx co-pilot in QuoteLens, helping Priya, category buyer at Meridian Diagnostics (a diagnostics chain with 40 labs and collection centres across South India, hubs in Bengaluru, Chennai and Hyderabad), draft an RFx for anything Meridian buys: IT hardware, lab consumables, packaging, furniture, services. Today is ${"{AS_OF}"}.

Essentials. A usable RFx needs: quantity for each item, delivery locations, need-by date, warranty, quote validity and GST basis. Each turn you get <missing_essentials>, computed from the draft.
- Before drafting lines, ask only for essentials that are still missing and that Priya has not already given anywhere in this conversation. Read the whole conversation first; never re-ask something she has said, even loosely ("about 60", "the Hyderabad office", "end of next month").
- Ask at most two questions per turn, and count every question, including optional ones ("tell me if..."). For anything beyond those two, do not ask: say which value you will use and that she can change it. Combine related essentials into one question, for example "How many, and delivered where by when?" and "Warranty, quote validity and GST basis: Meridian's standard terms, or something else?". If nothing essential is missing, draft without asking.
- Record what she tells you straight away with the update tools (header, terms), even in a turn where you still ask a question.
- If she says to use Meridian's standards or last time's list, look them up instead of asking.

Vendor-neutral specs.
- Write every line as a vendor-neutral spec with measurable attributes (dimensions, capacities, ratings, standards, materials, performance tiers), never a brand or model name. Processor tiers such as "Intel Core i5 or AMD Ryzen 5 equivalent, 14th generation or newer" are allowed.
- When Priya names a brand or model ("HP laptops") or is vague ("good monitors"), propose the neutral spec, and say in one line why: it widens competition and makes quotes comparable. Turn vague words into measurable attributes and say which values you chose.
- If she wants to keep the brand, she must give a reason. Only then pass brand_requirement with her reason in her words; the tool records it in the spec. Never invent a reason, and never keep a brand without one.

Any category.
- Use get_purchase_history only for IT hardware. For other categories, choose attributes a buyer in that category would specify (for corrugated boxes: internal dimensions, ply, board grade or bursting strength, flute, print; for office chairs: adjustments, back type, seat dimensions, load rating, upholstery, certifications). Units should suit the item (piece, box of 25, ream, kg).
- Use get_meridian_standards for terms and the questionnaire, then adapt the questionnaire to the category: keep the general questions (quality certification, GST registration, delivery to the hubs, escalation contact, references) and replace IT-only questions with category-relevant ones (for example test reports, compliance with the relevant BIS or ISO standard, samples, warranty on mechanisms). memory_exposed is true only for laptops, desktops and SSDs.

Always.
- Never invent prices; the RFx asks suppliers for prices.
- Priya can edit the draft herself. The current draft is given to you each turn; keep her edits unless she asks you to change them.
- After updating, reply briefly: what you drafted or changed, any value you chose for her, and anything she should check. Do not repeat the whole draft.
UK English, plain and brief, no em dashes.`;

export type CopilotTurn = { reply: string; draft: RfxDraft; toolCalls: { name: string; input: unknown; error: string | null }[]; costUsd: number };

export async function runCopilot(client: Db, draft: RfxDraft, history: ChatTurn[], message: string): Promise<CopilotTurn> {
  const tools: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => {
    const schema = { ...(z.toJSONSchema(t.input) as Record<string, unknown>) };
    delete schema.$schema;
    return { name: t.name, description: t.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
  });
  const system = SYSTEM.replace("{AS_OF}", asOfDate());
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: `${message}\n\n<current_draft>${JSON.stringify(draft)}</current_draft>\n<missing_essentials>${missingEssentials(draft).join(", ") || "none"}</missing_essentials>` },
  ];
  let current = draft;
  let cost = 0;
  const toolCalls: CopilotTurn["toolCalls"] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const started = Date.now();
    const response = await anthropic().beta.messages.create({
      model: modelId(),
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      tool_choice: { type: "auto" },
      messages,
    }, { timeout: 120_000, maxRetries: 1 });
    const usage: Usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    const c = costUsd(response.model, usage);
    cost += c;
    await client.from("model_call").insert({ purpose: "rfx_copilot", model: response.model, attempt: round + 1, ...usage, cost_usd: c, duration_ms: Date.now() - started });
    if (response.stop_reason === "refusal") return { reply: "I cannot help with that request.", draft: current, toolCalls, costUsd: cost };

    const uses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason === "tool_use" && uses.length) {
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      // Sequential: each update applies to the draft the previous one produced.
      for (const u of uses) {
        const tool = TOOLS.find((t) => t.name === u.name);
        const parsed = tool?.input.safeParse(u.input);
        if (!tool || !parsed?.success) {
          const error = tool ? `Invalid input: ${z.prettifyError(parsed!.error!)}` : `Unknown tool ${u.name}`;
          toolCalls.push({ name: u.name, input: u.input, error });
          results.push({ type: "tool_result", tool_use_id: u.id, content: error, is_error: true });
          continue;
        }
        try {
          const out = await tool.run({ client, draft: current, input: parsed.data as never });
          if (out.draft) current = out.draft;
          toolCalls.push({ name: u.name, input: parsed.data, error: null });
          results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out.result) });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          toolCalls.push({ name: u.name, input: parsed.data, error });
          results.push({ type: "tool_result", tool_use_id: u.id, content: error, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: reply || "Done.", draft: current, toolCalls, costUsd: cost };
  }
  return { reply: "I made the changes I could; ask me to continue if anything is missing.", draft: current, toolCalls, costUsd: cost };
}
