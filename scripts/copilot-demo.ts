// npm run copilot:demo -- <state.json> "message"
// One co-pilot turn against the live model, without touching the saved RFx draft:
// the conversation and draft live in the state file, so a test can run turn by turn.
// Set TRANSCRIPT=path.md to append the turn as markdown.
import fs from "node:fs";
import { runCopilot } from "@/lib/ai/copilot";
import { db } from "@/lib/db/client";
import { EMPTY_DRAFT, missingEssentials, type RfxDraft } from "@/lib/rfx/draft";
import type { ChatTurn } from "@/lib/rfx/store";

async function main() {
  const [statePath, message] = process.argv.slice(2);
  if (!statePath || !message) throw new Error('Usage: npm run copilot:demo -- <state.json> "message"');
  const state: { draft: RfxDraft; conversation: ChatTurn[] } = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { draft: EMPTY_DRAFT, conversation: [] };
  const started = Date.now();
  const turn = await runCopilot(db(), state.draft, state.conversation.slice(-20), message);
  const conversation = [...state.conversation, { role: "user" as const, content: message }, { role: "assistant" as const, content: turn.reply }];
  fs.writeFileSync(statePath, JSON.stringify({ draft: turn.draft, conversation }, null, 1));

  const d = turn.draft;
  const out = [
    `**Priya:** ${message}`,
    "",
    `**Co-pilot:** ${turn.reply.replace(/\n/g, "\n> ")}`,
    "",
    `*Tools:* ${turn.toolCalls.map((t) => `${t.name}${t.error ? ` (refused: ${t.error.slice(0, 140)})` : ""}`).join(", ") || "none"}. *Missing essentials after this turn:* ${missingEssentials(d).join(", ") || "none"}. *${Math.round((Date.now() - started) / 1000)} s, $${turn.costUsd.toFixed(3)}*`,
  ];
  if (d.lines.length) {
    out.push("", `<details><summary>Draft: ${d.title} (${d.category}), ${d.lines.length} lines, need by ${d.need_by_date || "not set"}, hubs ${d.delivery_hubs.join(", ") || "not set"}</summary>`, "");
    for (const l of d.lines) out.push(`- ${l.line_no}. ${l.description}: ${l.quantity} ${l.uom}. ${l.spec.map((s) => `${s.attribute}: ${s.value}`).join("; ")}`);
    out.push("", `Terms: validity ${d.terms.validity_days_required} days; GST ${d.terms.gst_basis || "not set"}; delivery ${d.terms.delivery_basis || "not set"}, ${d.terms.delivery_days} days; warranty ${d.terms.warranty || "not set"}; payment ${d.terms.payment || "not set"}`);
    out.push("", `Questionnaire: ${d.questionnaire.map((q) => q.text).join(" | ") || "none"}`, "", "</details>");
  }
  const text = out.join("\n");
  console.log(text);
  if (process.env.TRANSCRIPT) fs.appendFileSync(process.env.TRANSCRIPT, `${text}\n\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
