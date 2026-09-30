import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { TABLE_NAMES } from "@/lib/db/types";
import { LINE_ITEMS, QUESTIONNAIRE, RFX, SUPPLIERS } from "@/seed/data";

const dir = path.join(process.cwd(), "supabase", "migrations");
let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  // Roles Supabase provides that the migration grants to.
  await pg.exec("create role anon; create role authenticated; create role service_role;");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(path.join(dir, file), "utf8"));
  }
}, 30_000);

async function seedRfxAndSupplier() {
  await pg.exec("select public.reset_demo_data()");
  const rfx = await pg.query<{ id: string }>(
    `insert into rfx (title, category, need_by_date, approval_days, sent_at, status, terms, questionnaire)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [RFX.title, RFX.category, RFX.need_by_date, RFX.approval_days, RFX.sent_at, RFX.status, RFX.terms, JSON.stringify(QUESTIONNAIRE)],
  );
  const s = SUPPLIERS[0];
  const supplier = await pg.query<{ id: string }>(
    `insert into supplier (code, name, gstin, state, default_currency, is_incumbent)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [s.code, s.name, s.gstin, s.state, s.default_currency, s.is_incumbent],
  );
  const response = await pg.query<{ id: string }>(
    `insert into response (rfx_id, supplier_id, received_at) values ($1, $2, now()) returning id`,
    [rfx.rows[0].id, supplier.rows[0].id],
  );
  return { rfxId: rfx.rows[0].id, responseId: response.rows[0].id };
}

describe("initial schema migration", () => {
  it("creates exactly the fifteen tables the app knows about", async () => {
    const { rows } = await pg.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual([...TABLE_NAMES].sort());
  });

  it("accepts every seed row and every supplier GSTIN", async () => {
    const { rfxId } = await seedRfxAndSupplier();
    for (const l of LINE_ITEMS) {
      await pg.query(
        `insert into line_item (rfx_id, line_no, description, category, spec, quantity, uom, last_cycle_price_inr, memory_exposed)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [rfxId, l.line_no, l.description, l.category, l.spec, l.quantity, l.uom, l.last_cycle_price_inr, l.memory_exposed],
      );
    }
    for (const s of SUPPLIERS.slice(1)) {
      await pg.query(
        `insert into supplier (code, name, gstin, state, default_currency, is_incumbent) values ($1, $2, $3, $4, $5, $6)`,
        [s.code, s.name, s.gstin, s.state, s.default_currency, s.is_incumbent],
      );
    }
    const { rows } = await pg.query<{ n: number }>("select count(*)::int as n from line_item");
    expect(rows[0].n).toBe(30);
  });

  it("rejects a second incumbent", async () => {
    await seedRfxAndSupplier();
    await expect(
      pg.query(`insert into supplier (code, name, is_incumbent) values ('Z', 'Other', true)`),
    ).rejects.toThrow();
  });

  it("rejects an extracted value without a snippet", async () => {
    const { responseId } = await seedRfxAndSupplier();
    await expect(
      pg.query(
        `insert into extracted_value (response_id, field, raw_value, confidence_state, source_locator)
         values ($1, 'unit_price', '68000', 'extracted', '{"page":1}')`,
        [responseId],
      ),
    ).rejects.toThrow(/extracted_value_has_source/);
  });

  it("rejects an Inferred value without a reason", async () => {
    const { responseId } = await seedRfxAndSupplier();
    await expect(
      pg.query(
        `insert into extracted_value (response_id, field, raw_value, confidence_state, source_locator, source_snippet)
         values ($1, 'unit_price', '245', 'inferred', '{"page":1}', '2450 / pack')`,
        [responseId],
      ),
    ).rejects.toThrow(/extracted_value_inferred_reason/);
  });

  it("rejects an imputed Missing value", async () => {
    const { responseId } = await seedRfxAndSupplier();
    await expect(
      pg.query(
        `insert into extracted_value (response_id, field, confidence_state, normalised_value_inr)
         values ($1, 'unit_price', 'missing', 0)`,
        [responseId],
      ),
    ).rejects.toThrow(/extracted_value_missing_not_imputed/);
  });

  it("reset_demo_data empties every table", async () => {
    await seedRfxAndSupplier();
    await pg.exec("select public.reset_demo_data()");
    for (const table of TABLE_NAMES) {
      const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
      expect(rows[0].n, table).toBe(0);
    }
  });
});
