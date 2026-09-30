// npm run seed: wipe the database and load seed inputs, then print row counts.
import { db } from "@/lib/db/client";
import { countAllTables, recordAuditEvent } from "@/lib/db/queries";
import { runSeed } from "./runSeed";

async function main() {
  const client = db();
  await runSeed(client);
  await recordAuditEvent({ actor: "system", action: "seed", target: "database", reason: "npm run seed" }, client);

  const counts = await countAllTables(client);
  console.table(Object.entries(counts).map(([table, rows]) => ({ table, rows })));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
