// The analyst: a Claude tool-use loop over the comparison data. The model plans, calls
// tools, reads results and answers. Every number must come from a tool result; a
// post-check verifies that and returns anything unmatched as a warning.
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/db/client";
import { loadAnalystData, type AnalystData } from "@/lib/tools/data";
import { anthropicToolDefinitions, runTool, type ToolRun } from "@/lib/tools";
import type { ChartSpec } from "@/lib/tools/make_chart";
import { FALLBACK_BETA, anthropic, modelId } from "./client";
import { collectNumbers, postCheck, type PostCheckWarning } from "./postcheck";
import { costUsd, type Usage } from "./pricing";

const MAX_ROUNDS = 10;

export type AnalystTurn = { role: "user" | "assistant"; content: string };

export type AnalystAnswer = {
  answer: string;
  toolRuns: ToolRun[];
  charts: ChartSpec[];
  exports: { file_name: string; url: string }[];
  warnings: PostCheckWarning[];
  rounds: number;
  costUsd: number;
  model: string;
};

function systemPrompt(data: AnalystData): string {
  const suppliers = data.suppliers.map((s) => `${s.code}. ${s.name}${s.isIncumbent ? " (incumbent)" : ""}`).join("; ");
  return `You are the procurement analyst inside QuoteLens, working for Priya, category buyer at Meridian Diagnostics, on the RFx "${data.rfx.title}" (30 lines, delivered to Bengaluru, Chennai and Hyderabad). The as-of date is ${data.asOfDate}; approval takes ${data.rfx.approval_days} days. Suppliers: ${suppliers}.

All prices are normalised to INR per piece, ex-GST, delivered to hub. A value is Extracted (read directly), Inferred (a judgement or code-derived conversion) or Missing (never imputed). Substitutes awaiting Arjun's sign-off are not counted. Quote Freshness is Fresh, Reconfirm or Stale. "Qualified" means passing every questionnaire question. "Like-for-like" means the common basket of lines every chosen supplier can be counted on. Benchmarks and FX rates are illustrative.

Rules:
1. Every number in your answer must come from a tool result. Copy numbers and totals exactly as tools return them, preferring the *_display strings for totals (lakh or crore). Never add, subtract, average, multiply, count or estimate numbers yourself, and never work out date differences. If you need a figure no tool returned, call a tool that computes it; if none can, say so.
2. If the answer depends on Inferred values or on Stale or Reconfirm quotes, say so in your first sentence.
3. Then lead with the answer itself in one or two sentences.
4. State the basis: which basket, which scenario, which suppliers were included, and which were excluded and why.
5. If the data cannot answer the question, say exactly what is missing. Never guess. Describe statuses, reasons and failures only in the words tools return; do not add detail they did not give. Never explain why a result came out as it did unless a tool states the reason; if you have not checked, do not speculate.
6. Use a short markdown table when listing several lines or suppliers. Use make_chart when asked for a chart or when a comparison is clearer as one. Use export only when asked for a file.
7. Earlier turns of this conversation are context: "this award" or "it" refers to what was last discussed.
8. UK English, plain and brief. INR with Indian grouping (₹1,05,000). No em dashes.`;
}

function toolResultContent(run: ToolRun): string {
  return run.error ? `Error: ${run.error}` : JSON.stringify(run.output);
}

export async function askAnalyst(client: Db, question: string, history: AnalystTurn[] = []): Promise<AnalystAnswer> {
  const data = await loadAnalystData(client);
  const tools = anthropicToolDefinitions();
  const system = systemPrompt(data);
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history.map((t) => ({ role: t.role, content: t.content })), { role: "user", content: question }];

  const toolRuns: ToolRun[] = [];
  let cost = 0;
  let model = modelId();
  let answer = "";
  let rounds = 0;

  for (; rounds < MAX_ROUNDS; rounds++) {
    const started = Date.now();
    const response = await anthropic().beta.messages.create({
      model: modelId(),
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      tool_choice: { type: "auto" },
      messages,
    }, { timeout: 90_000, maxRetries: 1 });
    model = response.model;
    const usage: Usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    const callCost = costUsd(response.model, usage);
    cost += callCost;
    await client.from("model_call").insert({ purpose: "analyst", model: response.model, attempt: rounds + 1, ...usage, cost_usd: callCost, duration_ms: Date.now() - started });

    if (response.stop_reason === "refusal") {
      answer = "I cannot answer that question.";
      break;
    }
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason === "tool_use" && toolUses.length) {
      messages.push({ role: "assistant", content: response.content });
      const runs = await Promise.all(toolUses.map((t) => runTool({ data, client }, t.name, t.input)));
      toolRuns.push(...runs);
      messages.push({
        role: "user",
        content: runs.map((run, i) => ({ type: "tool_result" as const, tool_use_id: toolUses[i].id, content: toolResultContent(run), is_error: !!run.error })),
      });
      continue;
    }
    answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (response.stop_reason === "max_tokens") answer += "\n\n(The answer was cut off.)";
    break;
  }
  if (!answer) answer = "I could not finish this analysis within the step limit. Try a narrower question.";

  // Post-check: the answer, charts and exports against numbers from data tools and the question.
  const pool = collectNumbers(toolRuns.filter((r) => !r.modelSuppliedNumbers && !r.error).map((r) => r.output));
  collectNumbers(question, pool);
  const charts = toolRuns.filter((r) => r.name === "make_chart" && !r.error).map((r) => r.input as ChartSpec);
  const exportRuns = toolRuns.filter((r) => r.name === "export" && !r.error);
  const warnings = [
    ...postCheck(answer, pool),
    ...charts.flatMap((c) => postCheck(c.series.flatMap((s) => s.values).join(" "), pool, `chart "${c.title}"`)),
    ...exportRuns.flatMap((r) => {
      const input = r.input as { title: string; rows: (string | number | null)[][] };
      return postCheck(input.rows.flat().filter((v) => typeof v === "number").join(" "), pool, `export "${input.title}"`);
    }),
  ];

  return {
    answer,
    toolRuns,
    charts,
    exports: exportRuns.map((r) => r.output as { file_name: string; url: string }),
    warnings,
    rounds: rounds + 1,
    costUsd: cost,
    model,
  };
}
