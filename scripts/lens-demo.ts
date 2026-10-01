// npm run lens:demo -- --screen <rfx|quotes|comparison|award|eval> [--state file.json] [--selection "..."] [--briefing] "message"
// One Lens turn against the live model. With --state the conversation (and, on the RFx
// screen, the draft) carries over between runs, without touching the saved RFx draft.
// Set TRANSCRIPT=path.md to append the turn as markdown.
import fs from "node:fs";
import { runLens, type LensTurn } from "@/lib/ai/lens/agent";
import { LENS_SCREENS, type LensScreen } from "@/lib/ai/lens/context";
import { db } from "@/lib/db/client";
import { EMPTY_DRAFT, type RfxDraft } from "@/lib/rfx/draft";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const screen = (arg("screen") ?? "comparison") as LensScreen;
  if (!LENS_SCREENS.includes(screen)) throw new Error(`--screen must be one of ${LENS_SCREENS.join(", ")}`);
  const statePath = arg("state");
  const briefing = process.argv.includes("--briefing");
  const flags = new Set(["--screen", "--state", "--selection"]);
  const message = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !flags.has(all[i - 1])).join(" ") || "Brief me.";
  const state: { history: LensTurn[]; draft: RfxDraft | null } = statePath && fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { history: [], draft: screen === "rfx" ? EMPTY_DRAFT : null };

  const started = Date.now();
  const r = await runLens(db(), { ui: { screen, selection: arg("selection") ?? "none", briefing }, message, history: state.history, draft: state.draft });
  if (statePath) fs.writeFileSync(statePath, JSON.stringify({ history: [...state.history, { role: "user", content: message }, { role: "assistant", content: r.answer, tools: r.toolRuns.map((t) => t.name) }], draft: r.draft ?? state.draft }, null, 1));

  const out = [
    `**Priya** (${screen}${briefing ? ", briefing" : ""}): ${message}`,
    "",
    `**Lens:** ${r.answer.replace(/\n/g, "\n> ")}`,
    "",
    `*Tools:* ${r.toolRuns.map((t) => `${t.name}${t.error ? ` (error: ${t.error.slice(0, 120)})` : ""}`).join(", ") || "none"}.` +
      (r.actions.length ? ` *Preview cards:* ${r.actions.map((a) => a.kind).join(", ")}.` : "") +
      ` *Check:* ${r.warnings.length ? r.warnings.map((w) => `${w.text} (${w.reason})`).join("; ") : "every number found in a tool result; every citation resolves"}.` +
      ` *${Math.round((Date.now() - started) / 1000)} s, ${r.rounds} rounds, $${r.costUsd.toFixed(3)}*`,
  ];
  if (r.draft && r.draft.lines.length) {
    out.push("", `<details><summary>Draft: ${r.draft.title}, ${r.draft.lines.length} lines</summary>`, "");
    for (const l of r.draft.lines) out.push(`- ${l.line_no}. ${l.description}: ${l.quantity} ${l.uom}. ${l.spec.map((s) => `${s.attribute}: ${s.value}`).join("; ")}`);
    out.push("", `Terms: validity ${r.draft.terms.validity_days_required} days; ${r.draft.terms.gst_basis}; warranty ${r.draft.terms.warranty}; payment ${r.draft.terms.payment}`, "", "</details>");
  }
  const text = out.join("\n");
  console.log(text);
  if (process.env.TRANSCRIPT) fs.appendFileSync(process.env.TRANSCRIPT, `${text}\n\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
