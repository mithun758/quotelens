// npm run seed: upload supplier files, wipe the database and load seed inputs, then print row counts.
import { db } from "@/lib/db/client";
import { countAllTables, recordAuditEvent } from "@/lib/db/queries";
import { runSeed } from "./runSeed";
import { uploadSupplierFiles } from "./upload";

async function main() {
  const client = db();
  console.log(`Uploaded ${await uploadSupplierFiles(client)} supplier files to Storage`);
  await runSeed(client);
  await recordAuditEvent({ actor: "system", action: "seed", target: "database", reason: "npm run seed" }, client);

  const counts = await countAllTables(client);
  console.table(Object.entries(counts).map(([table, rows]) => ({ table, rows })));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
