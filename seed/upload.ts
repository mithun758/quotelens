// Uploads the generated supplier files to Supabase Storage (private bucket).
// Idempotent: creates the bucket if needed and overwrites existing objects.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@/lib/db/client";
import { CLARIFICATION_REPLIES, SUPPLIER_DOCUMENTS_BUCKET, SUPPLIER_RESPONSES } from "./suppliers";

const SUPPLIERS_DIR = path.join(process.cwd(), "seed", "suppliers");

export async function uploadSupplierFiles(client: Db): Promise<number> {
  const { data: bucket } = await client.storage.getBucket(SUPPLIER_DOCUMENTS_BUCKET);
  if (!bucket) {
    const { error } = await client.storage.createBucket(SUPPLIER_DOCUMENTS_BUCKET, { public: false });
    if (error) throw new Error(`create bucket: ${error.message}`);
  }

  let uploaded = 0;
  for (const response of [...SUPPLIER_RESPONSES, ...CLARIFICATION_REPLIES]) {
    for (const doc of response.documents) {
      const body = await readFile(path.join(SUPPLIERS_DIR, doc.local_path));
      const { error } = await client.storage
        .from(SUPPLIER_DOCUMENTS_BUCKET)
        .upload(doc.storage_path, body, { contentType: doc.mime_type, upsert: true });
      if (error) throw new Error(`upload ${doc.storage_path}: ${error.message}`);
      uploaded++;
    }
  }
  return uploaded;
}
