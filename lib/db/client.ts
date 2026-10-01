import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type Db = SupabaseClient<Database>;

let cached: Db | null = null;
const DB_TIMEOUT_MS = 30_000;

// Server-side only: uses the service role key, which bypasses RLS.
// Not guarded with "server-only" because the seed script also runs it under plain Node.
export function db(): Db {
  if (typeof window !== "undefined") {
    throw new Error("lib/db must never run in the browser");
  }
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // A slow database must fail with a friendly message, not hang the demo.
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(DB_TIMEOUT_MS) }) },
  });
  return cached;
}
