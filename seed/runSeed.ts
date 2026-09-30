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
import { SUPPLIER_RESPONSES } from "./suppliers";

function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`seed ${what}: ${error.message}`);
}

// Wipes every table, then loads the seed inputs, including a Response and its
// Document rows for each supplier. The files themselves are already in Storage
// (npm run seed uploads them), so "Reset demo" only rebuilds rows.
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

  const [lineResult, supplierResult, benchmarkResult, fxResult] = await Promise.all([
    client.from("line_item").insert(lineItems),
    client.from("supplier").insert(SUPPLIERS).select("id, code"),
    client.from("benchmark_series").insert(benchmarks),
    client.from("fx_rate").insert(fxRates),
  ]);
  check(lineResult.error, "line_item");
  check(supplierResult.error, "supplier");
  check(benchmarkResult.error, "benchmark_series");
  check(fxResult.error, "fx_rate");

  const supplierIds = new Map(supplierResult.data!.map((s) => [s.code, s.id]));
  for (const response of SUPPLIER_RESPONSES) {
    const supplierId = supplierIds.get(response.supplier_code);
    if (!supplierId) throw new Error(`seed response: unknown supplier ${response.supplier_code}`);

    const { data: row, error } = await client
      .from("response")
      .insert({
        rfx_id: rfx!.id,
        supplier_id: supplierId,
        received_at: response.received_at,
        channel: response.channel,
        body_text: response.body_text,
      })
      .select("id")
      .single();
    check(error, `response ${response.supplier_code}`);

    const documents: Insert<"document">[] = response.documents.map((d) => ({
      response_id: row!.id,
      file_name: d.file_name,
      mime_type: d.mime_type,
      storage_path: d.storage_path,
      page_count: d.page_count,
    }));
    check((await client.from("document").insert(documents)).error, `documents ${response.supplier_code}`);
  }
}
