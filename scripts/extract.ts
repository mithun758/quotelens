// npm run extract [-- A C]: run real extraction for all suppliers (or the codes given),
// then print the eval score against ground truth.
import { runExtractionForAll } from "@/lib/ai/extraction/pipeline";
import { db } from "@/lib/db/client";
import { scoreExtraction } from "@/lib/eval/score";

async function main() {
  const client = db();
  const codes = process.argv.slice(2).map((c) => c.toUpperCase());
  const run = await runExtractionForAll(client, codes);
  for (const s of run.summaries) {
    console.log(`${s.supplier}: coverage ${s.coverage}/30, inferred ${s.inferred}, missing ${s.missing}, value flags ${s.flags} | ${s.documents.map((d) => `${d.file} (${d.items} items, ${d.attempts} attempt${d.attempts > 1 ? "s" : ""})`).join(", ")}`);
  }
  for (const e of run.errors) console.error(`FAILED ${e.supplier}: ${e.error}`);
  console.log(`Run ${run.runId}: ${Math.round(run.durationMs / 1000)}s, $${run.costUsd.toFixed(4)}`);

  const report = await scoreExtraction(client);
  console.log(`\nEval: ${report.overall.correct}/${report.overall.fields} fields (${(report.overall.accuracy * 100).toFixed(1)}%), values ${(report.overall.valueAccuracy * 100).toFixed(1)}%, confidence ${(report.overall.confidenceAccuracy * 100).toFixed(1)}%`);
  for (const s of report.suppliers) {
    const bad = s.lines.filter((l) => !l.valueOk || !l.confidenceOk);
    console.log(`${s.code} ${s.name}: values ${(s.valueAccuracy * 100).toFixed(0)}%, confidence ${(s.confidenceAccuracy * 100).toFixed(0)}%, terms ${s.terms.filter((t) => t.ok).length}/${s.terms.length}, questionnaire ${s.questionnaire.filter((q) => q.ok).length}/${s.questionnaire.length}`);
    for (const l of bad) {
      console.log(`   line ${l.line_no}: expected ${l.expected.value} (${l.expected.confidence}) got ${l.actual.value} (${l.actual.confidence}) raw "${l.actual.raw}"`);
    }
    for (const t of s.terms.filter((t) => !t.ok)) console.log(`   ${t.field}: expected ${t.expected} got ${t.actual}`);
    for (const q of s.questionnaire.filter((q) => !q.ok)) console.log(`   questionnaire ${q.key}: expected ${q.expected} got ${q.actual}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
