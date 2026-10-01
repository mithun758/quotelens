import { NotExtractedNote } from "@/components/ErrorNote";
import { AwardScreen } from "@/components/award/AwardScreen";
import { negotiationLines } from "@/lib/award/negotiation";
import { loadAwardView } from "@/lib/award/view";
import { asOfDate, formatDisplayDate } from "@/lib/config";
import { db } from "@/lib/db/client";

export const metadata = { title: "Award · QuoteLens" };
export const dynamic = "force-dynamic";
// Writing the memo is a model call from this page.
export const maxDuration = 120;

export default async function AwardPage() {
  const { data, award, ...view } = await loadAwardView(db());
  if (!Object.values(data.cells).some((c) => Object.keys(c).length)) return <NotExtractedNote />;
  const supplierNames = Object.fromEntries(data.suppliers.map((s) => [s.code, s.name]));
  const freshness = Object.fromEntries(data.suppliers.map((s) => [s.code, s.freshness?.status ?? null]));
  return (
    <AwardScreen
      view={view}
      supplierNames={supplierNames}
      freshness={freshness}
      memo={award?.memo_markdown ? { markdown: award.memo_markdown, warnings: (award.memo_warnings as { text: string; reason: string }[]) ?? [], generatedAt: award.memo_generated_at, status: award.status } : null}
      negotiationCount={negotiationLines(view.chosen).length}
      memoDate={formatDisplayDate(asOfDate())}
      rfxTitle={data.rfx.title}
    />
  );
}
