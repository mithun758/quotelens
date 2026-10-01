"use server";

import { runLens, type LensTurn } from "@/lib/ai/lens/agent";
import { LENS_SCREENS, type LensUi } from "@/lib/ai/lens/context";
import { basisNotes } from "@/lib/ai/basis";
import { hasValidSession } from "@/lib/auth/gate";
import { asOfDate, formatDisplayDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { recordAuditEvent } from "@/lib/db/queries";
import { markdownToBlocks, type Block } from "@/lib/export/document";
import { documentToPdf } from "@/lib/export/pdf";
import { documentToXlsx } from "@/lib/export/xlsx";
import { draftQuestion } from "@/lib/review/decisions";
import type { ChatAction } from "@/lib/tools/actions";
import type { ChartSpec } from "@/lib/tools/make_chart";

export type AnalystReply = {
  answer: string;
  tools: { name: string; input: unknown; error: string | null }[];
  basis: string[];
  charts: ChartSpec[];
  exports: { file_name: string; url: string }[];
  // Preview cards: nothing has changed until Priya confirms one.
  actions: ChatAction[];
  warnings: { text: string; where: string; reason: string }[];
  costUsd: number;
  seconds: number;
};

// Lens in the chat drawer. ui says which screen Priya is on, what is selected, and
// whether this is a briefing (she has just arrived and not typed).
export async function askAnalystAction(question: string, history: LensTurn[], ui: LensUi = { screen: "comparison", selection: "none", briefing: false }): Promise<{ ok: true; reply: AnalystReply } | { ok: false; error: string }> {
  if (!(await hasValidSession())) return { ok: false, error: "Passcode required" };
  if (!question.trim()) return { ok: false, error: "Ask a question." };
  if (!LENS_SCREENS.includes(ui.screen)) return { ok: false, error: "Unknown screen." };
  const started = Date.now();
  try {
    const client = db();
    await enforceRateLimit(client, "analyst");
    const r = await runLens(client, { ui: { screen: ui.screen, selection: String(ui.selection ?? "none").slice(0, 200), briefing: !!ui.briefing }, message: question.trim(), history: history.slice(-12).map((t) => ({ role: t.role, content: String(t.content), tools: Array.isArray(t.tools) ? t.tools.map(String).slice(0, 20) : undefined })) });
    await recordAuditEvent({ actor: "priya", action: "ask_analyst", target: "analyst", after: { question, tools: r.toolRuns.map((t) => t.name), warnings: r.warnings.length } }, client);
    // A question card shows its drafted text before Priya sends it. Drafting changes no data.
    const actions = await Promise.all(
      r.actions.map(async (a): Promise<ChatAction> => {
        if (a.kind !== "send_clarification") return a;
        try {
          await enforceRateLimit(client, "clarification");
          return { ...a, draft: await draftQuestion(client, a.supplier, a.keys) };
        } catch (error) {
          return { ...a, draft_error: friendlyError(error, "Drafting the question") };
        }
      }),
    );
    return {
      ok: true,
      reply: {
        answer: r.answer,
        tools: r.toolRuns.map((t) => ({ name: t.name, input: t.input, error: t.error })),
        basis: basisNotes(r.toolRuns),
        charts: r.charts,
        exports: r.exports,
        actions,
        warnings: r.warnings,
        costUsd: r.costUsd,
        seconds: Math.round((Date.now() - started) / 1000),
      },
    };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "The analyst") };
  }
}

export type ExportRequest = { format: "xlsx" | "pdf"; question: string; reply: Pick<AnalystReply, "answer" | "charts" | "basis" | "tools" | "warnings"> };

export async function exportAnswerAction(req: ExportRequest): Promise<{ ok: true; fileName: string; base64: string; mime: string } | { ok: false; error: string }> {
  if (!(await hasValidSession())) return { ok: false, error: "Passcode required" };
  try {
    const blocks: Block[] = [
      ...markdownToBlocks(req.reply.answer),
      ...req.reply.charts.map(
        (c): Block => ({
          type: "table",
          title: c.title,
          header: [c.x_label ?? "", ...c.series.map((s) => s.name)],
          rows: c.categories.map((cat, i) => [cat, ...c.series.map((s) => String(s.values[i] ?? ""))]),
        }),
      ),
      { type: "heading", level: 2, text: "How I got this" },
      { type: "list", items: req.reply.basis.length ? req.reply.basis : ["No basis recorded"] },
      { type: "list", items: req.reply.tools.map((t) => `${t.name} ${JSON.stringify(t.input)}${t.error ? ` (error: ${t.error})` : ""}`) },
      req.reply.warnings.length
        ? { type: "paragraph", tone: "warning", text: `Post-check: ${req.reply.warnings.map((w) => `${w.text} in ${w.where} was not found in any tool result`).join("; ")}.` }
        : { type: "paragraph", tone: "muted", text: "Post-check: every number was found in a tool result." },
    ];
    const doc = { title: req.question, subtitle: `QuoteLens analyst, Meridian Diagnostics IT Refresh 2026. As of ${formatDisplayDate(asOfDate())}. INR per piece, ex-GST, delivered. Benchmarks and FX are illustrative.`, blocks };
    const slug = req.question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "answer";
    const bytes = req.format === "pdf" ? Buffer.from(await documentToPdf(doc)) : documentToXlsx(doc);
    await recordAuditEvent({ actor: "priya", action: `export_answer_${req.format}`, target: "analyst", after: { question: req.question } }, db());
    return {
      ok: true,
      fileName: `${slug}.${req.format}`,
      base64: bytes.toString("base64"),
      mime: req.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "The export") };
  }
}
