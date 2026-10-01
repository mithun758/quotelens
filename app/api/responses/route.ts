import { revalidatePath } from "next/cache";
import { runExtractionForResponse } from "@/lib/ai/extraction/pipeline";
import { hasValidSession } from "@/lib/auth/gate";
import { db } from "@/lib/db/client";
import { UserFacingError, friendlyError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { addResponse } from "@/lib/uploads/addResponse";
import { MAX_UPLOAD_BYTES, validateSupplierName, validateUpload } from "@/lib/uploads/validate";

// Add a response from an upload, then read it with the same extraction pipeline as the
// seeded quotes. A route handler (not a server action) so the upload can stream as
// multipart form data and the model call can take its time.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await hasValidSession())) return Response.json({ error: "Passcode required" }, { status: 401 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return Response.json({ error: "The file is larger than 10 MB." }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const supplier = String(form.get("supplier") ?? "");
    if (!(file instanceof File)) throw new UserFacingError("Choose a file to upload.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateUpload(file.name, bytes);
    if (!check.ok) throw new UserFacingError(check.error);
    const isNew = supplier === "new";
    const name = isNew ? validateSupplierName(String(form.get("name") ?? "")) : null;
    if (isNew && !name) throw new UserFacingError("Give the new supplier a name.");
    if (!isNew && !/^[A-Z]$/.test(supplier)) throw new UserFacingError("Pick a supplier.");

    const client = db();
    await enforceRateLimit(client, "upload");
    const added = await addResponse(client, { supplierCode: isNew ? null : supplier, newSupplierName: name, fileName: check.fileName, mime: check.mime, bytes });
    revalidatePath("/", "layout");
    try {
      const s = await runExtractionForResponse(client, added.responseId);
      revalidatePath("/", "layout");
      return Response.json({ supplier: added.supplierCode, coverage: s.coverage, missing: s.missing, inferred: s.inferred });
    } catch (error) {
      // The file is stored; the response shows as not read, with Retry on the Quotes screen.
      revalidatePath("/", "layout");
      return Response.json({ supplier: added.supplierCode, error: `The file was added but could not be read: ${friendlyError(error, "Extraction")}` }, { status: 502 });
    }
  } catch (error) {
    return Response.json({ error: friendlyError(error, "Adding the response") }, { status: error instanceof UserFacingError ? 400 : 502 });
  }
}
