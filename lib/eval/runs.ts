// Run history for /eval: cost per supplier and per run, and run-to-run variance.
// Variance compares stored snapshots only; it does not read the ground truth.
import type { Db } from "@/lib/db/client";
import type { ExtractionRunRow } from "@/lib/db/types";

export type CostRow = { supplier: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number };
export type Variation = { supplier: string; line: number; values: (number | null)[]; confidences: string[] };

export type RunHistory = {
  latest: ExtractionRunRow | null;
  latestCosts: CostRow[];
  recentRuns: Pick<ExtractionRunRow, "id" | "started_at" | "duration_ms" | "cost_usd" | "status">[];
  variance: { runsCompared: number; valueVariations: Variation[]; confidenceVariations: Variation[] };
};

const VARIANCE_WINDOW = 10;

export async function runHistory(client: Db): Promise<RunHistory> {
  const { data: runs, error } = await client
    .from("extraction_run")
    .select("*")
    .eq("scope", "all")
    .in("status", ["succeeded", "partial"])
    .order("started_at", { ascending: false })
    .limit(VARIANCE_WINDOW);
  if (error) throw new Error(error.message);
  const latest = runs?.[0] ?? null;

  let latestCosts: CostRow[] = [];
  if (latest) {
    const { data: calls } = await client.from("model_call").select("*").eq("run_id", latest.id);
    const bySupplier = new Map<string, CostRow>();
    for (const c of calls ?? []) {
      const key = c.supplier_code ?? "?";
      const row = bySupplier.get(key) ?? { supplier: key, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      row.calls++;
      row.inputTokens += c.input_tokens + c.cache_read_input_tokens + c.cache_creation_input_tokens;
      row.outputTokens += c.output_tokens;
      row.costUsd += Number(c.cost_usd);
      bySupplier.set(key, row);
    }
    latestCosts = [...bySupplier.values()].sort((a, b) => a.supplier.localeCompare(b.supplier));
  }

  const snapshots = (runs ?? []).map((r) => r.snapshot).filter((s): s is NonNullable<typeof s> => !!s);
  const valueVariations: Variation[] = [];
  const confidenceVariations: Variation[] = [];
  if (snapshots.length > 1) {
    const keys = new Set(snapshots.flatMap((snap) => Object.entries(snap).flatMap(([sup, lines]) => Object.keys(lines).map((l) => `${sup}|${l}`))));
    for (const key of [...keys].sort()) {
      const [supplier, line] = key.split("|");
      const cells = snapshots.map((snap) => snap[supplier]?.[line]);
      const values = cells.map((c) => c?.value ?? null);
      const confidences = cells.map((c) => c?.confidence ?? "none");
      const v: Variation = { supplier, line: Number(line), values, confidences };
      if (new Set(values).size > 1) valueVariations.push(v);
      if (new Set(confidences).size > 1) confidenceVariations.push(v);
    }
  }

  return {
    latest,
    latestCosts,
    recentRuns: (runs ?? []).map(({ id, started_at, duration_ms, cost_usd, status }) => ({ id, started_at, duration_ms, cost_usd, status })),
    variance: { runsCompared: snapshots.length, valueVariations, confidenceVariations },
  };
}
