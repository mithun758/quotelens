import { db } from "@/lib/db/client";
import { buildComparison } from "@/lib/comparison/build";
import { loadComparison } from "@/lib/comparison/load";
import { loadFreshness } from "@/lib/freshness/load";
import { receiveReply, sendClarification } from "@/lib/review/decisions";
import { RECONFIRM_KEY } from "@/lib/review/queue";
import { uploadSupplierFiles } from "@/seed/upload";

async function snapshot(label: string) {
  const c = db();
  const [view, fresh] = await Promise.all([loadComparison(c), loadFreshness(c)]);
  const d = view.cells.D;
  const terms = view.terms.D;
  const l1 = Object.fromEntries([5, 6, 28].map((n) => [n, view.result.lines.find((l) => l.lineNo === n)!.l1.join("")]));
  console.log(`--- ${label}`);
  console.log("D terms", terms.quoteDate, terms.validUntil, "freshness", fresh.D.status, fresh.D.fired.map((r) => r.key).join(","));
  for (const n of [5, 6, 28, 9]) console.log(`D line ${n}`, d[n]?.normalised_value_inr, d[n]?.confidence_state, d[n]?.steps.map((s) => `${s.kind}:${s.input}->${s.output} (${s.rate_source})`).join(" | "));
  console.log("L1", l1, "D L1 count", view.result.lines.filter((l) => l.l1.includes("D")).length);
  void buildComparison;
}

(async () => {
  const c = db();
  console.log("uploaded", await uploadSupplierFiles(c));
  await snapshot("before");
  await sendClarification(c, "D", [RECONFIRM_KEY], "Price reconfirmation - RFx IT Refresh 2026", "Please confirm your prices dated 4 Jun 2026 still hold, and state your validity.");
  const t = Date.now();
  await receiveReply(c, "D");
  console.log(`reply received and re-extracted in ${Math.round((Date.now() - t) / 1000)} s`);
  await snapshot("after");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
