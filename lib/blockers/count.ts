// Open blockers for the header counter: Inferred values Priya has not confirmed or
// corrected, open flags (including clarifications awaiting a supplier), and Stale suppliers.
import type { Db } from "@/lib/db/client";
import { loadFreshness } from "@/lib/freshness/load";

export async function countOpenBlockers(client: Db): Promise<number> {
  const [inferred, flags, freshness] = await Promise.all([
    client.from("extracted_value").select("id", { count: "exact", head: true }).eq("confidence_state", "inferred").eq("status", "needs_review"),
    client.from("flag").select("id", { count: "exact", head: true }).eq("status", "open"),
    loadFreshness(client),
  ]);
  if (inferred.error) throw new Error(`count inferred: ${inferred.error.message}`);
  if (flags.error) throw new Error(`count flags: ${flags.error.message}`);
  const stale = Object.values(freshness).filter((f) => f.status === "Stale").length;
  return (inferred.count ?? 0) + (flags.count ?? 0) + stale;
}
