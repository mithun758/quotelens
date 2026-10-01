// Lens: the one agent in QuoteLens. A Claude tool-use loop with one system prompt
// (system-prompt.md, filled per turn) and one tool registry, on every screen. It
// drafts the RFx, reviews quotes, analyses the comparison and prepares the award.
// Code computes; every number in an answer is checked against tool results, and
// citations that point at nothing are removed.
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/db/client";
import { missingEssentials, type RfxDraft } from "@/lib/rfx/draft";
import type { ChatAction } from "@/lib/tools/actions";
import { loadAnalystData } from "@/lib/tools/data";
import { anthropicToolDefinitions, runTool, type ToolRun } from "@/lib/tools";
import type { ChartSpec } from "@/lib/tools/make_chart";
import { FALLBACK_BETA, anthropic, modelId } from "../client";
import { collectNumbers, postCheck, type PostCheckWarning } from "../postcheck";
import { costUsd, type Usage } from "../pricing";
import { checkCitations, stripCitations } from "./citations";
import { lensContext, type LensUi } from "./context";
import { renderLensPrompt } from "./prompt";

const MAX_ROUNDS = 10;

// tools: the tools an earlier answer used, so Lens can see it was grounded.
export type LensTurn = { role: "user" | "assistant"; content: string; tools?: string[] };

export type LensAnswer = {
  answer: string;
  toolRuns: ToolRun[];
  charts: ChartSpec[];
  exports: { file_name: string; url: string }[];
  // Previews from action tools; nothing has changed until Priya confirms each card.
  actions: ChatAction[];
  warnings: PostCheckWarning[];
  // The RFx draft after update_rfx_draft, when Lens ran on the RFx screen.
  draft: RfxDraft | null;
  rounds: number;
  costUsd: number;
  model: string;
};

export async function runLens(
  client: Db,
  input: { ui: LensUi; message: string; history?: LensTurn[]; draft?: RfxDraft | null },
): Promise<LensAnswer> {
  const data = await loadAnalystData(client);
  const system = renderLensPrompt(await lensContext(client, data, input.ui));
  const tools = anthropicToolDefinitions();
  const draft = input.draft ? { current: input.draft } : undefined;
  // On the RFx screen the current draft travels with the message, so Lens never re-asks.
  const context = draft ? `\n\n<current_draft>${JSON.stringify(draft.current)}</current_draft>\n<missing_essentials>${missingEssentials(draft.current).join(", ") || "none"}</missing_essentials>` : "";
  const past = (input.history ?? []).map((t) => ({
    role: t.role,
    content: t.role === "assistant" && t.tools?.length ? `${t.content}\n\n<grounding>tools used: ${t.tools.join(", ")}</grounding>` : t.content,
  }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [...past, { role: "user", content: `${input.message}${context}` }];

  const toolRuns: ToolRun[] = [];
  let cost = 0;
  let model = modelId();
  let answer = "";
  let rounds = 0;

  for (; rounds < MAX_ROUNDS; rounds++) {
    const started = Date.now();
    const response = await anthropic().beta.messages.create(
      {
        model: modelId(),
        max_tokens: 32000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system,
        tools,
        tool_choice: { type: "auto" },
        messages,
      },
      { timeout: 120_000, maxRetries: 1 },
    );
    model = response.model;
    const usage: Usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    const callCost = costUsd(response.model, usage);
    cost += callCost;
    await client.from("model_call").insert({ purpose: `lens_${input.ui.screen}`, model: response.model, attempt: rounds + 1, ...usage, cost_usd: callCost, duration_ms: Date.now() - started });

    if (response.stop_reason === "refusal") {
      answer = "I can't help with that request.";
      break;
    }
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason === "tool_use" && toolUses.length) {
      messages.push({ role: "assistant", content: response.content });
      // Sequential, so each draft update applies to the draft the previous one produced.
      const runs: ToolRun[] = [];
      for (const t of toolUses) runs.push(await runTool({ data, client, draft }, t.name, t.input));
      toolRuns.push(...runs);
      messages.push({
        role: "user",
        content: runs.map((run, i) => ({ type: "tool_result" as const, tool_use_id: toolUses[i].id, content: run.error ? `Error: ${run.error}` : JSON.stringify(run.output), is_error: !!run.error })),
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
  if (!answer) answer = "I could not finish this within the step limit. Try a narrower question.";

  // The history note is for Lens, never for Priya.
  answer = answer.replace(/\s*<grounding>[\s\S]*?<\/grounding>\s*/g, "\n").replace(/\s*\[This answer was built from[^\]]*\]\s*/g, "\n").trim();

  // Citations must point at a real cell or document, and a cell citation must sit
  // beside that cell's own figure.
  const docIds = new Set(data.suppliers.flatMap((s) => Object.keys(s.documents)));
  const cited = checkCitations(answer, (s, n) => !!data.cells[s]?.[n], (id) => docIds.has(id), (s, n) => data.cells[s]?.[n]?.normalised_value_inr ?? null);
  answer = cited.text;

  // Number post-check, against tool results, the question and the values the prompt
  // states. Drafting proposals on the RFx screen are suggestions, not data, so only
  // citations are checked there.
  const pool = collectNumbers(toolRuns.filter((r) => !r.modelSuppliedNumbers && !r.error).map((r) => r.output));
  collectNumbers(input.message, pool);
  // Figures in earlier answers were checked when Lens gave them.
  collectNumbers((input.history ?? []).filter((t) => t.role === "assistant").map((t) => t.content), pool);
  collectNumbers([data.rfx.approval_days, data.lines.length, data.asOfDate, data.rfx.need_by_date, data.rfx.sent_at ?? ""], pool);
  const charts = toolRuns.filter((r) => r.name === "make_chart" && !r.error).map((r) => r.input as ChartSpec);
  const exportRuns = toolRuns.filter((r) => r.name === "export" && !r.error);
  const numberWarnings =
    input.ui.screen === "rfx"
      ? []
      : [
          ...postCheck(stripCitations(answer), pool),
          ...charts.flatMap((c) => postCheck(c.series.flatMap((s) => s.values).join(" "), pool, `chart "${c.title}"`)),
          ...exportRuns.flatMap((r) => {
            const e = r.input as { title: string; rows: (string | number | null)[][] };
            return postCheck(e.rows.flat().filter((v) => typeof v === "number").join(" "), pool, `export "${e.title}"`);
          }),
        ];

  return {
    answer,
    toolRuns,
    charts,
    exports: exportRuns.map((r) => r.output as { file_name: string; url: string }),
    actions: toolRuns.filter((r) => r.action && !r.error).map((r) => r.output as ChatAction),
    warnings: [...cited.warnings, ...numberWarnings],
    draft: draft ? draft.current : null,
    rounds: rounds + 1,
    costUsd: cost,
    model,
  };
}
