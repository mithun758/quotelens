import type { Db } from "./client";

export const SUPPLIER_DOCUMENTS_BUCKET = "supplier-documents";

export async function downloadDocument(client: Db, storagePath: string): Promise<Buffer> {
  const { data, error } = await client.storage.from(SUPPLIER_DOCUMENTS_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`download ${storagePath}: ${error?.message ?? "no data"}`);
  return Buffer.from(await data.arrayBuffer());
}
