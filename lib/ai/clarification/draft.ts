// Drafts one specific clarification email to a supplier from the issues Priya selected.
// Live model call; sending is stubbed.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { FALLBACK_BETA, anthropic, modelId } from "../client";
import { costUsd, type Usage } from "../pricing";

const DraftSchema = z.object({
  subject: z.string().describe("Short email subject"),
  body: z.string().describe("The email body, signed by Priya"),
});

export type DraftIssue = { label: string; detail: string };

const SYSTEM = `You write clarification emails from Priya, category buyer at Meridian Diagnostics, to a supplier who has quoted for an RFx.
Ask only about the issues listed, one short numbered question per issue, specific enough that the supplier can answer in one line each.
Name the RFx line numbers where relevant. Do not invent issues, prices or deadlines. Do not negotiate or hint at competitors.
UK English, polite and brief, no em dashes. Sign off as Priya, Category Buyer, Meridian Diagnostics.`;

export async function draftClarification(
  client: Db,
  args: { supplierName: string; rfxTitle: string; supplierCode: string; issues: DraftIssue[] },
): Promise<{ subject: string; body: string }> {
  const started = Date.now();
  const response = await anthropic().beta.messages.parse({
    model: modelId(),
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(DraftSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Supplier: ${args.supplierName}\nRFx: ${args.rfxTitle}\n\nIssues to ask about:\n${args.issues.map((i, n) => `${n + 1}. ${i.label}: ${i.detail}`).join("\n")}`,
      },
    ],
  }, { timeout: 45_000, maxRetries: 1 });

  const usage: Usage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  await client.from("model_call").insert({
    purpose: "clarification_draft",
    supplier_code: args.supplierCode,
    model: response.model,
    ...usage,
    cost_usd: costUsd(response.model, usage),
    duration_ms: Date.now() - started,
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to draft this clarification.");
  if (!response.parsed_output) throw new Error("The clarification draft did not match the expected format.");
  return response.parsed_output;
}
