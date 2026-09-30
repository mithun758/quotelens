// Typed access to seed/suppliers/manifest.json, written by npm run seed:generate.
import manifestJson from "./suppliers/manifest.json";

export const SUPPLIER_DOCUMENTS_BUCKET = "supplier-documents";

export type ManifestDocument = {
  file_name: string;
  local_path: string;
  storage_path: string;
  mime_type: string;
  page_count: number | null;
};

export type ManifestResponse = {
  supplier_code: string;
  received_at: string;
  channel: "email";
  body_text: string;
  documents: ManifestDocument[];
};

export const SUPPLIER_RESPONSES = manifestJson as ManifestResponse[];
