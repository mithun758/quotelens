import { db, type Db } from "./client";
import {
  TABLE_NAMES,
  type Actor,
  type AuditEventRow,
  type Json,
  type TableName,
} from "./types";

// Throws on any Supabase error so callers never mistake a failure for empty data.
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data`);
  return result.data;
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

async function countRows(table: TableName, client: Db = db()): Promise<number> {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`countRows(${table}): ${error.message}`);
  return count ?? 0;
}

export async function countAllTables(client: Db = db()): Promise<Record<TableName, number>> {
  const counts = await Promise.all(TABLE_NAMES.map((t) => countRows(t, client)));
  return Object.fromEntries(TABLE_NAMES.map((t, i) => [t, counts[i]])) as Record<TableName, number>;
}
