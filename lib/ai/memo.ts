// Writes the one-page award memo for Meera from the facts bundle only, then checks it:
// every number must appear in the facts and every link must be one the facts provide.
import type Anthropic from "@anthropic-ai/sdk";
import type { MemoFacts } from "@/lib/award/memo-facts";
import type { Db } from "@/lib/db/client";
import { FALLBACK_BETA, anthropic, modelId } from "./client";
import { collectNumbers, postCheck, type PostCheckWarning } from "./postcheck";
import { costUsd, type Usage } from "./pricing";

const SYSTEM = `You write a one-page award memo from Priya, Category Buyer, to Meera, Head of Commercial Finance at Meridian Diagnostics, for her approval.
Use only the facts given in JSON. Never compute, round differently, estimate or invent a number, date, supplier or reason; copy the display strings exactly.
Every line-level price you cite is a markdown link to its "link". Totals and scenarios link to their scenario "link". Use no other links.

It must fit on one printed page: 280 to 360 words plus one short table. Use exactly these headings (## level), in this order, and nothing else (no greeting, no sign-off, no extra examples):
## Recommendation (scenario, suppliers, total; one or two sentences)
## Totals and savings (total, saving against last cycle, saving against L1; a table of the recommended suppliers with lines and totals)
## Why the alternatives lost (one bullet per alternative; one bullet for if_freshness_exclusions_were_lifted when present, giving its total, its difference and why it is not recommended; one bullet naming the excluded suppliers and their reasons)
## Assumptions (FX rate, basket, GST basis, price basis, illustrative benchmarks; one line each)
## Quote Freshness (status of each awarded supplier and any fired rule)
## Overrides (group overrides that share a reason: give the reason once and list the lines with their linked prices; "None" if empty)
## Open risks (every item in open_risks; if any line rests on a "same as last year" price, say it may look cheap because it reflects last year's market; "None" if empty)
UK English, plain and direct, no em dashes. INR exactly as given.`;

export type MemoResult = { markdown: string; warnings: PostCheckWarning[]; costUsd: number };

export async function writeAwardMemo(client: Db, facts: MemoFacts): Promise<MemoResult> {
  const started = Date.now();
  const response = await anthropic().beta.messages.create({
    model: modelId(),
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Facts:\n${JSON.stringify(facts, null, 1)}` }],
  });
  const usage: Usage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  const cost = costUsd(response.model, usage);
  await client.from("model_call").insert({ purpose: "award_memo", model: response.model, ...usage, cost_usd: cost, duration_ms: Date.now() - started });
  if (response.stop_reason === "refusal") throw new Error("The model declined to write the memo.");

  const markdown = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const warnings = postCheck(markdown, collectNumbers(facts), "memo");
  const allowed = new Set(facts.allowed_links);
  for (const m of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    if (!allowed.has(m[1])) warnings.push({ text: m[1], where: "memo", reason: "Link not provided by the facts" });
  }
  return { markdown, warnings, costUsd: cost };
}
