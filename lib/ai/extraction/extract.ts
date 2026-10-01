// One model call per document, returning the fixed extraction schema.
// Retries once on schema or rule failure, then surfaces an error.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FALLBACK_BETA, anthropic, modelId } from "../client";
import { costUsd, type Usage } from "../pricing";
import type { PreparedDocument } from "./prepare";
import { extractionUserPrompt } from "./prompt";
import { ExtractionWireSchema, fromWire, validateExtraction, type Extraction } from "./schema";

export type ExtractionResult = { extraction: Extraction; model: string; attempts: number };

export type CallRecord = { model: string; attempt: number; usage: Usage; costUsd: number; durationMs: number };

export class ExtractionError extends Error {}

export async function extractDocument(args: {
  systemPrompt: string;
  document: PreparedDocument;
  supplierName: string;
  fileName: string;
  // Called once per API call, including retried attempts, for token and cost logging.
  onCall?: (call: CallRecord) => Promise<void>;
}): Promise<ExtractionResult> {
  const problems: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const retryNote = problems.length
      ? `\n\nYour previous answer was rejected: ${problems.join("; ")}. Fix these and answer again.`
      : "";

    const started = Date.now();
    const response = await anthropic().beta.messages.parse({
      model: modelId(),
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionWireSchema) },
      system: [{ type: "text", text: args.systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [args.document.block, { type: "text", text: extractionUserPrompt(args.supplierName, args.fileName) + retryNote }],
        },
      ],
    }, { timeout: 150_000, maxRetries: 1 });

    const usage: Usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    await args.onCall?.({ model: response.model, attempt, usage, costUsd: costUsd(response.model, usage), durationMs: Date.now() - started });

    if (response.stop_reason === "refusal") {
      throw new ExtractionError(`Model declined to extract ${args.fileName}: ${response.stop_details?.explanation ?? "no explanation"}`);
    }

    problems.length = 0;
    if (response.stop_reason === "max_tokens") problems.push("the answer was cut off at max_tokens");
    const parsed = response.parsed_output ? fromWire(response.parsed_output) : null;
    if (!parsed) problems.push("the answer did not match the schema");
    else problems.push(...validateExtraction(parsed));

    if (!problems.length && parsed) {
      return { extraction: parsed, model: response.model, attempts: attempt };
    }
  }
  throw new ExtractionError(`Extraction of ${args.fileName} failed schema checks twice: ${problems.join("; ")}`);
}
