// Adds a supplier response from an upload: a new supplier when needed, the file in
// Storage, and a document row. Extraction then runs through the existing pipeline.
import { asOfDate } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { recordAuditEvent } from "@/lib/db/queries";
import { SUPPLIER_DOCUMENTS_BUCKET } from "@/lib/db/storage";
import { UserFacingError } from "@/lib/errors";

export const UPLOAD_PREFIX = "uploads";
const MAX_SUPPLIERS = 8;

export type NewResponse = { supplierCode: string; responseId: string; newSupplier: boolean };

export async function addResponse(
  client: Db,
  input: { supplierCode: string | null; newSupplierName: string | null; fileName: string; mime: string; bytes: Uint8Array },
): Promise<NewResponse> {
  const { data: suppliers, error } = await client.from("supplier").select("id, code, name").order("code");
  if (error) throw new Error(`load suppliers: ${error.message}`);
  const { data: rfx } = await client.from("rfx").select("id").single();
  if (!rfx) throw new Error("No RFx found");

  let supplier = input.supplierCode ? suppliers?.find((s) => s.code === input.supplierCode) : undefined;
  let newSupplier = false;
  if (!supplier) {
    if (input.supplierCode) throw new UserFacingError(`There is no supplier ${input.supplierCode}.`);
    const name = input.newSupplierName!;
    if (suppliers?.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new UserFacingError(`${name} is already a supplier. Pick it from the list instead.`);
    if ((suppliers?.length ?? 0) >= MAX_SUPPLIERS) throw new UserFacingError(`This demo takes up to ${MAX_SUPPLIERS} suppliers. Reset the demo to start again.`);
    const used = new Set(suppliers?.map((s) => s.code));
    const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((c) => !used.has(c))!;
    const { data, error: e } = await client.from("supplier").insert({ code, name, gstin: null, state: null, default_currency: "INR", is_incumbent: false }).select("id, code, name").single();
    if (e || !data) throw new Error(`create supplier: ${e?.message}`);
    supplier = data;
    newSupplier = true;
  }

  let { data: response } = await client.from("response").select("id").eq("supplier_id", supplier.id).maybeSingle();
  if (!response) {
    // Received on the as-of date: business dates come from config, never the clock.
    const { data, error: e } = await client.from("response").insert({ rfx_id: rfx.id, supplier_id: supplier.id, received_at: `${asOfDate()}T12:00:00+05:30`, channel: "upload", status: "received" }).select("id").single();
    if (e || !data) throw new Error(`create response: ${e?.message}`);
    response = data;
  }

  const storagePath = `${UPLOAD_PREFIX}/${supplier.code}/${crypto.randomUUID().slice(0, 8)}-${input.fileName}`;
  const { error: upErr } = await client.storage.from(SUPPLIER_DOCUMENTS_BUCKET).upload(storagePath, input.bytes, { contentType: input.mime, upsert: false });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  const { error: docErr } = await client.from("document").insert({ response_id: response.id, file_name: input.fileName, mime_type: input.mime, storage_path: storagePath, page_count: null });
  if (docErr) throw new Error(`save document: ${docErr.message}`);
  await client.from("response").update({ status: "received" }).eq("id", response.id);

  await recordAuditEvent(
    { actor: "priya", action: "add_response", target: `${supplier.code}. ${supplier.name}`, after: { file: input.fileName, bytes: input.bytes.length, new_supplier: newSupplier } },
    client,
  );
  return { supplierCode: supplier.code, responseId: response.id, newSupplier };
}

// Reset removes uploaded files; the seed's own documents live outside this prefix.
export async function removeUploads(client: Db): Promise<number> {
  const bucket = client.storage.from(SUPPLIER_DOCUMENTS_BUCKET);
  const { data: folders } = await bucket.list(UPLOAD_PREFIX, { limit: 100 });
  const paths: string[] = [];
  for (const f of folders ?? []) {
    const { data: files } = await bucket.list(`${UPLOAD_PREFIX}/${f.name}`, { limit: 1000 });
    for (const file of files ?? []) paths.push(`${UPLOAD_PREFIX}/${f.name}/${file.name}`);
  }
  if (paths.length) await bucket.remove(paths);
  return paths.length;
}
