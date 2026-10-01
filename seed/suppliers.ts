// Typed access to seed/suppliers/manifest.json, written by npm run seed:generate.
import manifestJson from "./suppliers/manifest.json";

export { SUPPLIER_DOCUMENTS_BUCKET } from "@/lib/db/storage";

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

type Manifest = { responses: ManifestResponse[]; clarification_replies: ManifestResponse[] };
const manifest = manifestJson as Manifest;

// Loaded as Response and Document rows at seed time.
export const SUPPLIER_RESPONSES = manifest.responses;
// Uploaded at seed time; rows are created only when the clarification reply arrives.
export const CLARIFICATION_REPLIES = manifest.clarification_replies;
