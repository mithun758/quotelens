// Open blockers for the header counter: Inferred values Priya has not confirmed or
// corrected, and open flags (including clarifications awaiting a supplier).
// Stale suppliers join this count when Quote Freshness lands.
import type { Db } from "@/lib/db/client";

export async function countOpenBlockers(client: Db): Promise<number> {
  const [inferred, flags] = await Promise.all([
    client.from("extracted_value").select("id", { count: "exact", head: true }).eq("confidence_state", "inferred").eq("status", "needs_review"),
    client.from("flag").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (inferred.error) throw new Error(`count inferred: ${inferred.error.message}`);
  if (flags.error) throw new Error(`count flags: ${flags.error.message}`);
  return (inferred.count ?? 0) + (flags.count ?? 0);
}
