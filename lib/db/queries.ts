import { db, type Db } from "./client";
import {
  TABLE_NAMES,
  type Actor,
  type AuditEventRow,
  type BenchmarkSeriesRow,
  type FxRateRow,
  type Json,
  type LineItemRow,
  type RfxRow,
  type SupplierRow,
  type TableName,
} from "./types";

// Throws on any Supabase error so callers never mistake a failure for empty data.
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data`);
  return result.data;
}

// The demo has exactly one RFx.
export async function getRfx(client: Db = db()): Promise<RfxRow> {
  return unwrap(await client.from("rfx").select("*").single(), "getRfx");
}

export async function listLineItems(rfxId: string, client: Db = db()): Promise<LineItemRow[]> {
  return unwrap(
    await client.from("line_item").select("*").eq("rfx_id", rfxId).order("line_no"),
    "listLineItems",
  );
}

export async function listSuppliers(client: Db = db()): Promise<SupplierRow[]> {
  return unwrap(await client.from("supplier").select("*").order("code"), "listSuppliers");
}

export async function getBenchmarkSeries(
  seriesKey: string,
  client: Db = db(),
): Promise<BenchmarkSeriesRow[]> {
  return unwrap(
    await client.from("benchmark_series").select("*").eq("series_key", seriesKey).order("observed_on"),
    "getBenchmarkSeries",
  );
}

export async function getFxRates(
  baseCurrency: string,
  quoteCurrency: string,
  client: Db = db(),
): Promise<FxRateRow[]> {
  return unwrap(
    await client
      .from("fx_rate")
      .select("*")
      .eq("base_currency", baseCurrency)
      .eq("quote_currency", quoteCurrency)
      .order("rate_date"),
    "getFxRates",
  );
}

export async function recordAuditEvent(
  event: {
    actor: Actor;
    action: string;
    target?: string;
    before?: Json;
    after?: Json;
    reason?: string;
  },
  client: Db = db(),
): Promise<AuditEventRow> {
  return unwrap(
    await client.from("audit_event").insert(event).select().single(),
    "recordAuditEvent",
  );
}

export async function countRows(table: TableName, client: Db = db()): Promise<number> {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`countRows(${table}): ${error.message}`);
  return count ?? 0;
}

export async function countAllTables(client: Db = db()): Promise<Record<TableName, number>> {
  const counts = await Promise.all(TABLE_NAMES.map((t) => countRows(t, client)));
  return Object.fromEntries(TABLE_NAMES.map((t, i) => [t, counts[i]])) as Record<TableName, number>;
}
