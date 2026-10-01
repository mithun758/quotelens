// The RFx co-pilot: a Claude tool-use loop that asks focused follow-ups and writes
// structured updates to the draft through zod-validated tools. Code applies every
// update; the model never edits the draft directly.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { asOfDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { DraftLine, DraftQuestion, DraftTerms, removeLines, setHeader, setQuestionnaire, setTerms, upsertLines, type RfxDraft } from "@/lib/rfx/draft";
import type { ChatTurn } from "@/lib/rfx/store";
import { FALLBACK_BETA, anthropic, modelId } from "./client";
import { costUsd, type Usage } from "./pricing";

const MAX_ROUNDS = 8;

type Tool = { name: string; description: string; input: z.ZodType; run: (args: { client: Db; draft: RfxDraft; input: never }) => Promise<{ draft?: RfxDraft; result: unknown }> };

const TOOLS: Tool[] = [
  {
    name: "get_purchase_history",
    description: "Meridian's last IT refresh: each item with its vendor-neutral spec, quantity, unit and last-cycle price (INR per piece, ex-GST). Use it to propose lines and quantities.",
    input: z.object({ category: z.string().optional() }),
    async run({ client, input }) {
      const { category } = input as { category?: string };
      let q = client.from("line_item").select("line_no, description, category, spec, quantity, uom, last_cycle_price_inr, memory_exposed").order("line_no");
      if (category) q = q.ilike("category", category);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { result: { items: data } };
    },
  },
  {
    name: "get_meridian_standards",
    description: "Meridian's standard supplier quality questionnaire and commercial terms from its current RFx template.",
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
      "Add or replace RFx lines. A line_no that exists is replaced; a new number appends. Specs are vendor-neutral attribute/value pairs (no brand or model names). Lines are renumbered 1..n.",
    input: z.object({ lines: z.array(DraftLine) }),
    async run({ draft, input }) {
      const d = upsertLines(draft, (input as { lines: z.infer<typeof DraftLine>[] }).lines);
      return { draft: d, result: { ok: true, line_count: d.lines.length } };
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

const SYSTEM = `You are the RFx co-pilot in QuoteLens, helping Priya, category buyer at Meridian Diagnostics (a diagnostics chain with 40 labs and collection centres across South India), draft an RFx. Today is ${"{AS_OF}"}.

How to work:
- If Priya's request lacks something you need for a usable RFx (what to buy or how much, delivery hubs, need-by date, warranty or payment expectations), ask at most three short, focused follow-up questions in one message and do not draft yet. If she says to use last time's list or Meridian's standards, look them up instead of asking.
- Once you have enough, build the draft with the update tools: header, every line, terms and questionnaire. Use get_purchase_history to propose lines and quantities from Meridian's last refresh when that fits what she asked, and adjust for what she told you. Use get_meridian_standards for the questionnaire and terms unless she asks otherwise.
- Specs are vendor-neutral: no brand or model names. Keep every requirement from purchase history, including processor tier and minimum generation, capacities, sizes and standards (for example "Processor: Intel Core i5 or AMD Ryzen 5 equivalent, 14th generation or newer", "Wi-Fi: Wi-Fi 6 (802.11ax)"). Mark laptops, desktops and SSDs as memory_exposed. Units are "piece" unless sold by the box.
- Never invent prices; the RFx asks suppliers for prices.
- Priya can edit the draft herself. The current draft is given to you each turn; keep her edits unless she asks you to change them.
- After updating, reply briefly: what you drafted or changed, anything you assumed, and anything she should check. Do not repeat the whole draft.
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
    { role: "user", content: `${message}\n\n<current_draft>${JSON.stringify(draft)}</current_draft>` },
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
