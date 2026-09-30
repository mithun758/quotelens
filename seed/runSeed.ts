import type { Db } from "@/lib/db/client";
import type { Insert } from "@/lib/db/types";
import {
  ACCEPTABLE_EQUIVALENTS,
  LINE_ITEMS,
  MEMORY_INDEX,
  QUESTIONNAIRE,
  RFX,
  SUPPLIERS,
  USD_INR,
} from "./data";

function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`seed ${what}: ${error.message}`);
}

// Wipes every table, then loads the seed inputs. Shared by `npm run seed`
// and the "Reset demo" server action.
export async function runSeed(client: Db): Promise<void> {
  check((await client.rpc("reset_demo_data")).error, "reset_demo_data");

  const { data: rfx, error: rfxError } = await client
    .from("rfx")
    .insert({ ...RFX, questionnaire: QUESTIONNAIRE })
    .select("id")
    .single();
  check(rfxError, "rfx");

  const lineItems: Insert<"line_item">[] = LINE_ITEMS.map((line) => ({
    ...line,
    rfx_id: rfx!.id,
    acceptable_equivalents: ACCEPTABLE_EQUIVALENTS,
  }));

  const benchmarks: Insert<"benchmark_series">[] = MEMORY_INDEX.points.map(([observed_on, value]) => ({
    series_key: MEMORY_INDEX.series_key,
    label: MEMORY_INDEX.label,
    unit: MEMORY_INDEX.unit,
    source: MEMORY_INDEX.source,
    observed_on,
    value,
  }));

  const fxRates: Insert<"fx_rate">[] = USD_INR.points.map(([rate_date, rate]) => ({
    base_currency: USD_INR.base_currency,
    quote_currency: USD_INR.quote_currency,
    source: USD_INR.source,
    rate_date,
    rate,
  }));

  const results = await Promise.all([
    client.from("line_item").insert(lineItems),
    client.from("supplier").insert(SUPPLIERS),
    client.from("benchmark_series").insert(benchmarks),
    client.from("fx_rate").insert(fxRates),
  ]);
  results.forEach((r, i) => check(r.error, ["line_item", "supplier", "benchmark_series", "fx_rate"][i]));
}
