import { NotExtractedNote } from "@/components/ErrorNote";
import { ComparisonScreen } from "@/components/comparison/ComparisonScreen";
import { loadComparison } from "@/lib/comparison/load";
import { asOfDate } from "@/lib/config";
import { db } from "@/lib/db/client";

export const metadata = { title: "Quote Comparison · QuoteLens" };
export const dynamic = "force-dynamic";
// The analyst runs as a server action from this page; a multi-tool answer can take a minute.
export const maxDuration = 300;

export default async function ComparisonPage({ searchParams }: PageProps<"/comparison">) {
  const { cell } = await searchParams;
  const view = await loadComparison(db());
  if (!Object.values(view.cells).some((c) => Object.keys(c).length)) return <NotExtractedNote />;
  // ?cell=B-17 opens that cell's source and ledger (the award memo links here).
  const focus = typeof cell === "string" && /^[A-Z]-\d+$/.test(cell) ? cell.replace("-", ":") : null;
  return <ComparisonScreen view={view} asOf={asOfDate()} focusCell={focus} />;
}
