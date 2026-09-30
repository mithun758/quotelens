// npm run db:migrate: apply supabase/migrations/*.sql in order to DATABASE_URL.
// Each file runs once, in its own transaction, and is recorded in ql_migrations.applied.
// Used instead of the Supabase CLI so no Docker or CLI binary is needed.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set (Supabase session pooler connection string)");

  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    await sql`create schema if not exists ql_migrations`;
    await sql`create table if not exists ql_migrations.applied (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;

    const applied = new Set((await sql`select name from ql_migrations.applied`).map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip   ${file}`);
        continue;
      }
      const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into ql_migrations.applied (name) values (${file})`;
      });
      console.log(`apply  ${file}`);
    }

    // Tell PostgREST to pick up new tables and functions.
    await sql`notify pgrst, 'reload schema'`;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
