// Stubbed email inbox. Real email is out of scope, so supplier replies to clarifications
// are seeded files. Only delivery is stubbed: the reply is still read by the real model.
import { CLARIFICATION_REPLIES, type ManifestResponse } from "@/seed/suppliers";

export function inboxReplyFor(supplierCode: string): ManifestResponse | null {
  return CLARIFICATION_REPLIES.find((r) => r.supplier_code === supplierCode) ?? null;
}
