// npm run analyst:demo: asks the seven demo questions as one conversation and prints
// each answer with the tools called, post-check warnings and cost.
import { writeFileSync } from "node:fs";
import { askAnalyst, type AnalystTurn } from "@/lib/ai/analyst";
import { db } from "@/lib/db/client";

const QUESTIONS = [
  "Who is cheapest overall on a like-for-like basis?",
  "Only among suppliers who passed the quality questionnaire?",
  "Are any of those quotes stale or at risk before approval?",
  "If I exclude quotes that need reconfirmation, who becomes L1 per line? Show it as a chart.",
  "Which suppliers raised prices against last cycle, and on which lines?",
  "Split it: cheapest per line among qualified suppliers, excluding stale quotes. What's the total and the saving against last cycle?",
  "What must I resolve before I can send this award to Meera?",
];

async function main() {
  const client = db();
  const history: AnalystTurn[] = [];
  const out: string[] = [];
  const questions = process.argv[2] ? [process.argv.slice(2).join(" ")] : QUESTIONS;
  let total = 0;
  for (const [i, q] of questions.entries()) {
    const started = Date.now();
    const r = await askAnalyst(client, q, history);
    total += r.costUsd;
    history.push({ role: "user", content: q }, { role: "assistant", content: r.answer });
    const tools = r.toolRuns.map((t) => `${t.name}(${JSON.stringify(t.input)})${t.error ? ` ERROR: ${t.error}` : ""}`);
    const block = [
      `## Q${i + 1}. ${q}`,
      "",
      r.answer,
      "",
      `**Tools called (${r.toolRuns.length}):**`,
      ...tools.map((t) => `- \`${t}\``),
      ...r.charts.map((c) => `**Chart:** ${c.type} "${c.title}": ${c.categories.join(", ")} = ${c.series.map((s) => `${s.name} [${s.values.join(", ")}]`).join("; ")}`),
      `**Post-check:** ${r.warnings.length ? r.warnings.map((w) => `${w.text} (${w.where})`).join("; ") : "all numbers found in tool results"}`,
      `*${Math.round((Date.now() - started) / 1000)}s, ${r.rounds} model rounds, $${r.costUsd.toFixed(4)}*`,
      "",
    ].join("\n");
    out.push(block);
    console.log(block);
  }
  console.log(`Total cost: $${total.toFixed(4)}`);
  if (process.env.TRANSCRIPT) writeFileSync(process.env.TRANSCRIPT, out.join("\n"));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
