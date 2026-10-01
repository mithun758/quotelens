import { ComparisonScreen } from "@/components/comparison/ComparisonScreen";
import { loadComparison } from "@/lib/comparison/load";
import { db } from "@/lib/db/client";

export const metadata = { title: "Quote Comparison · QuoteLens" };
export const dynamic = "force-dynamic";

export default async function ComparisonPage() {
  const view = await loadComparison(db());
  return <ComparisonScreen view={view} />;
}
